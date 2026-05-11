import { Database } from "bun:sqlite";
import { nanoid } from "nanoid";

const dbPath = process.env.SENTRIX_DB_PATH ?? "sentrix.db";
const db = new Database(dbPath);
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    config TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_agent_ts ON events(agent_id, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  CREATE TABLE IF NOT EXISTS transactions (
    signature TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    program_ids TEXT NOT NULL DEFAULT '[]',
    estimated_sol REAL NOT NULL DEFAULT 0,
    decoded_data TEXT NOT NULL DEFAULT '{}',
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tx_agent_ts ON transactions(agent_id, timestamp DESC);
  CREATE TABLE IF NOT EXISTS anomalies (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    details TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_anomalies_agent ON anomalies(agent_id, timestamp DESC);
`);

db.exec("DELETE FROM anomalies; DELETE FROM transactions; DELETE FROM events; DELETE FROM agents;");

// ── Real Solana program IDs ──
const SYSTEM = "11111111111111111111111111111111";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const RAYDIUM_AMM = "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS";
const ORCA = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const MARINADE = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
const MEMO = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DRIFT = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";
const MARGINFI = "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA";
const KAMINO = "KLend2g3cP87ber41GXWsSZQz1asN7nVjibLGn2RFjh7";

function fakePubkey(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function fakeSig(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 83; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "seed_" + s;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return +(min + Math.random() * (max - min)).toFixed(4);
}

const now = Date.now();
const h1 = 60 * 60 * 1000;
const h24 = 24 * h1;

// ── Prepared statements ──
const insertAgent = db.prepare(
  "INSERT INTO agents (id, pubkey, status, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
);
const insertTx = db.prepare(
  "INSERT INTO transactions (signature, agent_id, status, program_ids, estimated_sol, decoded_data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
const insertEvent = db.prepare(
  "INSERT INTO events (id, agent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?)"
);
const insertAnomaly = db.prepare(
  "INSERT INTO anomalies (id, agent_id, type, severity, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
);

// ══════════════════════════════════════════════════════════════
//  AGENTS
// ══════════════════════════════════════════════════════════════
//
//  Anomaly detection logic:
//    INFO     — spend velocity approaching threshold (>75%)
//    WARNING  — spend velocity exceeded threshold (>100%), tx blocked by guardrails
//    CRITICAL — spend velocity >2x threshold → AUTO-KILL fires
//
//  Guardrails block individual txs that exceed per-tx or hourly limits.
//  Blocked txs = "saved" SOL (money that would've been lost).
//  Kill switch quarantines agent — ALL future txs rejected.
//
//  Active agents: may have a few blocked txs + INFO/WARNING anomalies, never CRITICAL
//  Killed agents: escalation pattern → CRITICAL → auto-kill, large burst of blocked txs

const DEVNET_LIVE_PUBKEY = "Eza2ztUtwPDzS3n6NoZdHRdVHjoMZiWqkbfTBHDdTekB";

const agents = [
  // ── Devnet live agent (main demo agent, always present) ──
  {
    id: "devnet-live-agent",
    pubkey: DEVNET_LIVE_PUBKEY,
    status: "active",
    config: { maxSpendPerTx: 0.08, hourlySpendLimit: 5.0, allowedPrograms: [SYSTEM] },
    createdHoursAgo: 6,
  },
  // ── Active agents (healthy, occasional guardrail hits) ──
  {
    id: "jupiter-swap-bot",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 0.5, hourlySpendLimit: 5, allowedPrograms: [SYSTEM, TOKEN, JUPITER, COMPUTE] },
    createdHoursAgo: 72,
  },
  {
    id: "dca-accumulator",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 0.25, hourlySpendLimit: 2, allowedPrograms: [SYSTEM, TOKEN, JUPITER, COMPUTE] },
    createdHoursAgo: 48,
  },
  {
    id: "liquidation-sentinel",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 2.0, hourlySpendLimit: 15, allowedPrograms: [SYSTEM, TOKEN, MARGINFI, KAMINO, COMPUTE] },
    createdHoursAgo: 96,
  },
  {
    id: "sniper-alpha",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 1.0, hourlySpendLimit: 8, allowedPrograms: [SYSTEM, TOKEN, RAYDIUM, RAYDIUM_AMM, COMPUTE] },
    createdHoursAgo: 24,
  },
  {
    id: "rebalance-engine",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 3.0, hourlySpendLimit: 20, allowedPrograms: [SYSTEM, TOKEN, TOKEN_2022, JUPITER, ORCA, COMPUTE] },
    createdHoursAgo: 120,
  },
  {
    id: "yield-optimizer",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 1.5, hourlySpendLimit: 12, allowedPrograms: [SYSTEM, TOKEN, MARINADE, DRIFT, COMPUTE] },
    createdHoursAgo: 60,
  },
  {
    id: "copy-trader-main",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 0.75, hourlySpendLimit: 6, allowedPrograms: [SYSTEM, TOKEN, JUPITER, COMPUTE, MEMO] },
    createdHoursAgo: 84,
  },
  {
    id: "market-maker-usdc",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 5.0, hourlySpendLimit: 50, allowedPrograms: [SYSTEM, TOKEN, TOKEN_2022, ORCA, RAYDIUM, COMPUTE] },
    createdHoursAgo: 168,
  },
  // ── Killed agents (went rogue, auto-killed by Sentrix) ──
  {
    id: "arb-scanner-v3",
    pubkey: fakePubkey(),
    status: "killed",
    config: { maxSpendPerTx: 1.0, hourlySpendLimit: 10, allowedPrograms: [SYSTEM, TOKEN, JUPITER, RAYDIUM, ORCA, COMPUTE] },
    createdHoursAgo: 36,
  },
  {
    id: "mev-searcher-02",
    pubkey: fakePubkey(),
    status: "killed",
    config: { maxSpendPerTx: 2.0, hourlySpendLimit: 25, allowedPrograms: [SYSTEM, TOKEN, JUPITER, RAYDIUM, ORCA, COMPUTE] },
    createdHoursAgo: 18,
  },
  {
    id: "trading-bot-alpha",
    pubkey: fakePubkey(),
    status: "killed",
    config: { maxSpendPerTx: 2.0, hourlySpendLimit: 10, allowedPrograms: [SYSTEM, JUPITER] },
    createdHoursAgo: 12,
  },
];

for (const a of agents) {
  insertAgent.run(a.id, a.pubkey, a.status, JSON.stringify(a.config), now - a.createdHoursAgo * h1, now);
}

// ══════════════════════════════════════════════════════════════
//  TRANSACTION PROFILES
// ══════════════════════════════════════════════════════════════
//
//  Each agent has:
//    - Normal txs: within guardrail limits, confirmed
//    - Blocked txs: exceeded per-tx or hourly limit, blocked by guardrails
//    - Blocked SOL range: how much the blocked txs tried to spend
//
//  Killed agents have a "rogue burst" near their kill time where
//  many large txs get blocked in rapid succession.

interface AgentTxProfile {
  agentId: string;
  programs: string[][];
  normalSolRange: [number, number];
  normalTxCount: number;
  // Scattered blocked txs (regular guardrail hits, not rogue)
  scatteredBlockedCount: number;
  scatteredBlockedSolRange: [number, number];
  scatteredBlockedReason: string;
  // Rogue burst (only for killed agents): cluster of blocked txs near kill time
  rogueBurst?: {
    txCount: number;
    solRange: [number, number];
    reason: string;
    hoursAgo: number; // when the burst happened (matches kill time)
    durationMinutes: number; // burst window
  };
}

const txProfiles: AgentTxProfile[] = [
  // ── devnet-live-agent excluded: only real devnet txs from demo/auto-refresh ──
  // ── Active agents ──
  {
    agentId: "jupiter-swap-bot",
    programs: [[SYSTEM, TOKEN, JUPITER, COMPUTE]],
    normalSolRange: [0.01, 0.4],
    normalTxCount: 312,
    scatteredBlockedCount: 3,
    scatteredBlockedSolRange: [0.55, 0.9],
    scatteredBlockedReason: "Exceeds max spend per tx (0.5 SOL limit)",
  },
  {
    agentId: "dca-accumulator",
    programs: [[SYSTEM, TOKEN, JUPITER, COMPUTE]],
    normalSolRange: [0.05, 0.2],
    normalTxCount: 96,
    scatteredBlockedCount: 1,
    scatteredBlockedSolRange: [0.3, 0.45],
    scatteredBlockedReason: "Exceeds max spend per tx (0.25 SOL limit)",
  },
  {
    agentId: "liquidation-sentinel",
    programs: [[SYSTEM, TOKEN, MARGINFI, COMPUTE], [SYSTEM, TOKEN, KAMINO, COMPUTE]],
    normalSolRange: [0.1, 1.8],
    normalTxCount: 156,
    scatteredBlockedCount: 3,
    scatteredBlockedSolRange: [2.2, 3.5],
    scatteredBlockedReason: "Exceeds max spend per tx (2.0 SOL limit)",
  },
  {
    agentId: "sniper-alpha",
    programs: [[SYSTEM, TOKEN, RAYDIUM, COMPUTE], [SYSTEM, TOKEN, RAYDIUM, RAYDIUM_AMM, COMPUTE]],
    normalSolRange: [0.1, 0.9],
    normalTxCount: 203,
    scatteredBlockedCount: 4,
    scatteredBlockedSolRange: [1.1, 2.5],
    scatteredBlockedReason: "Exceeds max spend per tx (1.0 SOL limit)",
  },
  {
    agentId: "rebalance-engine",
    programs: [[SYSTEM, TOKEN, JUPITER, COMPUTE], [SYSTEM, TOKEN, TOKEN_2022, ORCA, COMPUTE]],
    normalSolRange: [0.2, 2.5],
    normalTxCount: 84,
    scatteredBlockedCount: 1,
    scatteredBlockedSolRange: [3.2, 4.0],
    scatteredBlockedReason: "Exceeds max spend per tx (3.0 SOL limit)",
  },
  {
    agentId: "yield-optimizer",
    programs: [[SYSTEM, TOKEN, MARINADE, COMPUTE], [SYSTEM, TOKEN, DRIFT, COMPUTE]],
    normalSolRange: [0.1, 1.2],
    normalTxCount: 178,
    scatteredBlockedCount: 2,
    scatteredBlockedSolRange: [1.6, 2.8],
    scatteredBlockedReason: "Exceeds max spend per tx (1.5 SOL limit)",
  },
  {
    agentId: "copy-trader-main",
    programs: [[SYSTEM, TOKEN, JUPITER, COMPUTE], [SYSTEM, TOKEN, JUPITER, COMPUTE, MEMO]],
    normalSolRange: [0.05, 0.6],
    normalTxCount: 142,
    scatteredBlockedCount: 2,
    scatteredBlockedSolRange: [0.8, 1.2],
    scatteredBlockedReason: "Exceeds max spend per tx (0.75 SOL limit)",
  },
  {
    agentId: "market-maker-usdc",
    programs: [[SYSTEM, TOKEN, TOKEN_2022, ORCA, COMPUTE], [SYSTEM, TOKEN, RAYDIUM, COMPUTE]],
    normalSolRange: [0.5, 4.5],
    normalTxCount: 398,
    scatteredBlockedCount: 3,
    scatteredBlockedSolRange: [5.5, 8.0],
    scatteredBlockedReason: "Exceeds max spend per tx (5.0 SOL limit)",
  },
  // ── Killed agents (normal txs + rogue burst) ──
  {
    agentId: "arb-scanner-v3",
    programs: [[SYSTEM, TOKEN, JUPITER, RAYDIUM, COMPUTE], [SYSTEM, TOKEN, ORCA, COMPUTE], [SYSTEM, TOKEN, RAYDIUM, COMPUTE]],
    normalSolRange: [0.05, 0.8],
    normalTxCount: 340,
    scatteredBlockedCount: 3,
    scatteredBlockedSolRange: [1.1, 1.8],
    scatteredBlockedReason: "Exceeds max spend per tx (1.0 SOL limit)",
    rogueBurst: {
      txCount: 15,
      solRange: [3.0, 12.0],
      reason: "Hourly spend limit exceeded — agent attempting rapid drain",
      hoursAgo: 2.0,
      durationMinutes: 3,
    },
  },
  {
    agentId: "mev-searcher-02",
    programs: [[SYSTEM, TOKEN, JUPITER, RAYDIUM, COMPUTE], [SYSTEM, TOKEN, JUPITER, ORCA, COMPUTE]],
    normalSolRange: [0.05, 1.5],
    normalTxCount: 480,
    scatteredBlockedCount: 4,
    scatteredBlockedSolRange: [2.2, 3.5],
    scatteredBlockedReason: "Exceeds max spend per tx (2.0 SOL limit)",
    rogueBurst: {
      txCount: 22,
      solRange: [5.0, 18.0],
      reason: "Hourly spend limit exceeded — agent attempting rapid drain",
      hoursAgo: 3.0,
      durationMinutes: 4,
    },
  },
  {
    agentId: "trading-bot-alpha",
    programs: [[SYSTEM, JUPITER]],
    normalSolRange: [0.6, 1.95],
    normalTxCount: 120,
    scatteredBlockedCount: 2,
    scatteredBlockedSolRange: [2.2, 3.0],
    scatteredBlockedReason: "Exceeds max spend per tx (2.0 SOL limit)",
    rogueBurst: {
      txCount: 8,
      solRange: [3.0, 5.0],
      reason: "Hourly spend limit exceeded — agent attempting rapid drain",
      hoursAgo: 1.5,
      durationMinutes: 2,
    },
  },
];

let totalTx = 0;
let totalBlocked = 0;
let totalSpend = 0;
let totalSaved = 0;
let totalAnomalies = 0;

function emitTx(agentId: string, programs: string[], sol: number, status: string, ts: number, blockReason?: string) {
  const sig = fakeSig();
  const decodedData = blockReason ? JSON.stringify({ blockReason }) : "{}";
  insertTx.run(sig, agentId, status, JSON.stringify(programs), sol, decodedData, ts);

  if (status === "blocked") {
    insertEvent.run(nanoid(), agentId, "tx_blocked", JSON.stringify({
      signature: sig, programIds: programs, estimatedSol: sol,
    }), ts);
    insertEvent.run(nanoid(), agentId, "guardrail_violation", JSON.stringify({
      reason: blockReason, estimatedSol: sol,
    }), ts);
    totalSaved += sol;
    totalBlocked++;
  } else {
    insertEvent.run(nanoid(), agentId, "tx_sent", JSON.stringify({
      signature: sig, programIds: programs, estimatedSol: sol,
    }), ts);
    if (status === "confirmed") {
      insertEvent.run(nanoid(), agentId, "tx_confirmed", JSON.stringify({ signature: sig }), ts + 2000);
    }
    totalSpend += sol;
  }
  totalTx++;
}

for (const p of txProfiles) {
  // For killed agents, normal txs only before the rogue burst (kill time)
  // For active agents, span full 24h
  const txEnd = p.rogueBurst ? now - p.rogueBurst.hoursAgo * h1 : now;
  const txWindow = txEnd - (now - h24);

  const normalTimestamps: number[] = [];
  for (let i = 0; i < p.normalTxCount; i++) {
    normalTimestamps.push(now - h24 + Math.floor(Math.random() * txWindow));
  }
  normalTimestamps.sort();

  // Scatter a few blocked txs randomly among normal txs
  const scatteredBlockedIndices = new Set<number>();
  while (scatteredBlockedIndices.size < p.scatteredBlockedCount) {
    scatteredBlockedIndices.add(Math.floor(Math.random() * p.normalTxCount));
  }

  for (let i = 0; i < p.normalTxCount; i++) {
    const ts = normalTimestamps[i];
    const programs = randomChoice(p.programs);
    const isBlocked = scatteredBlockedIndices.has(i);

    if (isBlocked) {
      const sol = randomFloat(p.scatteredBlockedSolRange[0], p.scatteredBlockedSolRange[1]);
      emitTx(p.agentId, programs, sol, "blocked", ts, p.scatteredBlockedReason);
    } else {
      const sol = randomFloat(p.normalSolRange[0], p.normalSolRange[1]);
      const status = Math.random() > 0.03 ? "confirmed" : "sent";
      emitTx(p.agentId, programs, sol, status, ts);
    }
  }

  // Rogue burst for killed agents
  if (p.rogueBurst) {
    const burstCenter = now - p.rogueBurst.hoursAgo * h1;
    const burstWindow = p.rogueBurst.durationMinutes * 60 * 1000;

    for (let i = 0; i < p.rogueBurst.txCount; i++) {
      const ts = burstCenter - burstWindow / 2 + Math.floor(Math.random() * burstWindow);
      const programs = randomChoice(p.programs);
      const sol = randomFloat(p.rogueBurst.solRange[0], p.rogueBurst.solRange[1]);
      emitTx(p.agentId, programs, sol, "blocked", ts, p.rogueBurst.reason);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  ANOMALIES
// ══════════════════════════════════════════════════════════════
//
//  INFO     = spend velocity > 75% of threshold (heads up, no action)
//  WARNING  = spend velocity > 100% of threshold (elevated risk)
//  CRITICAL = spend velocity > 200% of threshold → AUTO-KILL
//
//  Only killed agents get CRITICAL anomalies.
//  Active agents get at most WARNING (never escalated to kill).

interface AnomalyDef {
  agentId: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  details: Record<string, any>;
  hoursAgo: number;
}

const anomalyDefs: AnomalyDef[] = [
  // ── arb-scanner-v3: clean escalation → CRITICAL → auto-kill at 2h ago ──
  { agentId: "arb-scanner-v3", type: "spend_velocity", severity: "INFO",
    details: { currentSpend: 7.8, threshold: 10, windowMinutes: 5, message: "Spend velocity at 78% of threshold" },
    hoursAgo: 8 },
  { agentId: "arb-scanner-v3", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 12.4, threshold: 10, windowMinutes: 5, message: "Spend velocity exceeded threshold" },
    hoursAgo: 4 },
  { agentId: "arb-scanner-v3", type: "unknown_program", severity: "WARNING",
    details: { unknownPrograms: [fakePubkey()], allPrograms: [{ id: fakePubkey(), name: null }], message: "Agent called unrecognized program" },
    hoursAgo: 3 },
  { agentId: "arb-scanner-v3", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 16.1, threshold: 10, windowMinutes: 5, message: "Spend velocity 161% of threshold" },
    hoursAgo: 2.3 },
  { agentId: "arb-scanner-v3", type: "spend_velocity", severity: "CRITICAL",
    details: { currentSpend: 23.7, threshold: 10, windowMinutes: 5, message: "Spend velocity 237% of threshold — AUTO-KILL triggered" },
    hoursAgo: 2.0 },

  // ── mev-searcher-02: fast escalation → CRITICAL → auto-kill at 3h ago ──
  { agentId: "mev-searcher-02", type: "spend_velocity", severity: "INFO",
    details: { currentSpend: 20.1, threshold: 25, windowMinutes: 5, message: "Spend velocity at 80% of threshold" },
    hoursAgo: 5 },
  { agentId: "mev-searcher-02", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 32.8, threshold: 25, windowMinutes: 5, message: "Spend velocity exceeded threshold" },
    hoursAgo: 3.8 },
  { agentId: "mev-searcher-02", type: "unknown_program", severity: "WARNING",
    details: { unknownPrograms: [fakePubkey(), fakePubkey()], allPrograms: [{ id: fakePubkey(), name: null }, { id: fakePubkey(), name: null }], message: "Agent called 2 unrecognized programs" },
    hoursAgo: 3.4 },
  { agentId: "mev-searcher-02", type: "spend_velocity", severity: "CRITICAL",
    details: { currentSpend: 58.3, threshold: 25, windowMinutes: 5, message: "Spend velocity 233% of threshold — AUTO-KILL triggered" },
    hoursAgo: 3.0 },

  // ── trading-bot-alpha: escalation → unknown program → CRITICAL → auto-kill at 1.5h ago ──
  { agentId: "trading-bot-alpha", type: "spend_velocity", severity: "INFO",
    details: { currentSpend: 8.1, threshold: 10, windowMinutes: 5, message: "Spend velocity at 81% of threshold" },
    hoursAgo: 4 },
  { agentId: "trading-bot-alpha", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 15.4, threshold: 10, windowMinutes: 5, message: "Spend velocity exceeded threshold" },
    hoursAgo: 2.5 },
  { agentId: "trading-bot-alpha", type: "unknown_program", severity: "WARNING",
    details: { unknownPrograms: [fakePubkey()], allPrograms: [{ id: fakePubkey(), name: null }], message: "Agent called unrecognized program" },
    hoursAgo: 1.8 },
  { agentId: "trading-bot-alpha", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (2.0 SOL limit)", estimatedSol: 3.5, message: "Transaction blocked by guardrail" },
    hoursAgo: 1.6 },
  { agentId: "trading-bot-alpha", type: "spend_velocity", severity: "CRITICAL",
    details: { currentSpend: 22.8, threshold: 10, windowMinutes: 5, message: "Spend velocity 228% of threshold — AUTO-KILL triggered" },
    hoursAgo: 1.5 },

  // ── Active agents: INFO or WARNING only, never CRITICAL ──

  // devnet-live-agent excluded: anomalies come from real demo runs only

  // sniper-alpha: occasional velocity spikes from rapid-fire sniping
  { agentId: "sniper-alpha", type: "spend_velocity", severity: "INFO",
    details: { currentSpend: 6.4, threshold: 8, windowMinutes: 5, message: "Spend velocity at 80% of threshold" },
    hoursAgo: 14 },
  { agentId: "sniper-alpha", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 9.1, threshold: 8, windowMinutes: 5, message: "Spend velocity exceeded threshold" },
    hoursAgo: 8 },

  // liquidation-sentinel: spike during liquidation cascade
  { agentId: "liquidation-sentinel", type: "spend_velocity", severity: "INFO",
    details: { currentSpend: 11.8, threshold: 15, windowMinutes: 5, message: "Spend velocity at 79% of threshold" },
    hoursAgo: 16 },
  { agentId: "liquidation-sentinel", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 17.2, threshold: 15, windowMinutes: 5, message: "Spend velocity exceeded threshold" },
    hoursAgo: 7 },

  // market-maker-usdc: high volume triggers velocity check
  { agentId: "market-maker-usdc", type: "spend_velocity", severity: "INFO",
    details: { currentSpend: 41.5, threshold: 50, windowMinutes: 5, message: "Spend velocity at 83% of threshold" },
    hoursAgo: 20 },
  { agentId: "market-maker-usdc", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 54.8, threshold: 50, windowMinutes: 5, message: "Spend velocity exceeded threshold" },
    hoursAgo: 11 },

  // jupiter-swap-bot: one minor blip, healthy agent
  { agentId: "jupiter-swap-bot", type: "spend_velocity", severity: "INFO",
    details: { currentSpend: 4.1, threshold: 5, windowMinutes: 5, message: "Spend velocity at 82% of threshold" },
    hoursAgo: 18 },

  // yield-optimizer: unknown program from new vault contract
  { agentId: "yield-optimizer", type: "unknown_program", severity: "WARNING",
    details: { unknownPrograms: [fakePubkey()], allPrograms: [{ id: fakePubkey(), name: null }], message: "Agent called unrecognized program" },
    hoursAgo: 9 },

  // copy-trader: whale trade copy spiked velocity
  { agentId: "copy-trader-main", type: "spend_velocity", severity: "WARNING",
    details: { currentSpend: 7.2, threshold: 6, windowMinutes: 5, message: "Spend velocity exceeded threshold" },
    hoursAgo: 12 },

  // rebalance-engine: large tx blocked by per-tx guardrail
  { agentId: "rebalance-engine", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (3.0 SOL limit)", estimatedSol: 3.6, message: "Transaction blocked by guardrail" },
    hoursAgo: 10 },

  // jupiter-swap-bot: per-tx limit hit
  { agentId: "jupiter-swap-bot", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (0.5 SOL limit)", estimatedSol: 0.72, message: "Transaction blocked by guardrail" },
    hoursAgo: 15 },

  // dca-accumulator: per-tx limit hit
  { agentId: "dca-accumulator", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (0.25 SOL limit)", estimatedSol: 0.38, message: "Transaction blocked by guardrail" },
    hoursAgo: 12 },

  // sniper-alpha: per-tx limit hit during rapid snipe
  { agentId: "sniper-alpha", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (1.0 SOL limit)", estimatedSol: 1.85, message: "Transaction blocked by guardrail" },
    hoursAgo: 6 },

  // liquidation-sentinel: large liquidation blocked
  { agentId: "liquidation-sentinel", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (2.0 SOL limit)", estimatedSol: 2.9, message: "Transaction blocked by guardrail" },
    hoursAgo: 5 },

  // yield-optimizer: per-tx limit hit on vault deposit
  { agentId: "yield-optimizer", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (1.5 SOL limit)", estimatedSol: 2.1, message: "Transaction blocked by guardrail" },
    hoursAgo: 7 },

  // copy-trader-main: whale copy exceeded limit
  { agentId: "copy-trader-main", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (0.75 SOL limit)", estimatedSol: 0.95, message: "Transaction blocked by guardrail" },
    hoursAgo: 11 },

  // market-maker-usdc: large order blocked
  { agentId: "market-maker-usdc", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (5.0 SOL limit)", estimatedSol: 6.8, message: "Transaction blocked by guardrail" },
    hoursAgo: 14 },

  // arb-scanner-v3: per-tx limit hit before rogue burst
  { agentId: "arb-scanner-v3", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (1.0 SOL limit)", estimatedSol: 1.5, message: "Transaction blocked by guardrail" },
    hoursAgo: 6 },

  // mev-searcher-02: per-tx limit hit before rogue burst
  { agentId: "mev-searcher-02", type: "guardrail_violation", severity: "WARNING",
    details: { reason: "Exceeds max spend per tx (2.0 SOL limit)", estimatedSol: 2.8, message: "Transaction blocked by guardrail" },
    hoursAgo: 8 },
];

for (const a of anomalyDefs) {
  const ts = now - Math.floor(a.hoursAgo * h1);
  insertAnomaly.run(nanoid(), a.agentId, a.type, a.severity, JSON.stringify(a.details), ts);
  insertEvent.run(nanoid(), a.agentId, "anomaly_detected", JSON.stringify({
    anomalyType: a.type, severity: a.severity, ...a.details,
  }), ts);
  totalAnomalies++;
}

// ── Kill switch events (only for agents with CRITICAL anomalies) ──
const killEvents = [
  {
    agentId: "arb-scanner-v3",
    reason: "AUTO-KILL: Spend velocity 237% of threshold (23.7 SOL in 5min, limit 10 SOL)",
    hoursAgo: 2.0,
  },
  {
    agentId: "mev-searcher-02",
    reason: "AUTO-KILL: Spend velocity 233% of threshold (58.3 SOL in 5min, limit 25 SOL)",
    hoursAgo: 3.0,
  },
];

for (const k of killEvents) {
  const ts = now - Math.floor(k.hoursAgo * h1);
  insertEvent.run(nanoid(), k.agentId, "kill_switch_activated", JSON.stringify({
    reason: k.reason, auto: true,
  }), ts);
}

db.close();

const pad = (s: string | number, n: number) => String(s).padEnd(n);

console.log(`
  ╔════════════════════════════════════════════╗
  ║   SENTRIX SEED DATA LOADED                 ║
  ╠════════════════════════════════════════════╣
  ║   Agents:        ${pad(agents.length, 25)}║
  ║   Transactions:  ${pad(totalTx.toLocaleString(), 25)}║
  ║   Blocked:       ${pad(totalBlocked, 25)}║
  ║   Total spend:   ${pad(totalSpend.toFixed(2) + " SOL", 25)}║
  ║   Saved:         ${pad(totalSaved.toFixed(2) + " SOL", 25)}║
  ║   Anomalies:     ${pad(totalAnomalies, 25)}║
  ║   Kill events:   ${pad(killEvents.length, 25)}║
  ╚════════════════════════════════════════════╝
`);
