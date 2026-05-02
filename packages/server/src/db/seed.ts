import { Database } from "bun:sqlite";
import { nanoid } from "nanoid";

import { resolve } from "path";
const dbPath = resolve(import.meta.dir, "..", "..", "sentrix.db");
const db = new Database(dbPath);
db.exec("PRAGMA journal_mode = WAL");

// Init tables (same as schema.ts)
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

// Clear existing data
db.exec("DELETE FROM anomalies; DELETE FROM transactions; DELETE FROM events; DELETE FROM agents;");

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const COMPUTE = "ComputeBudget111111111111111111111111111111";

function fakePubkey(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function fakeSig(): string {
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 88);
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const now = Date.now();
const h24 = 24 * 60 * 60 * 1000;

// --- Agents ---
const agents = [
  {
    id: "jupiter-swap-bot",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 0.5, hourlySpendLimit: 5, allowedPrograms: [SYSTEM_PROGRAM, TOKEN_PROGRAM, JUPITER, COMPUTE] },
  },
  {
    id: "dca-accumulator",
    pubkey: fakePubkey(),
    status: "active",
    config: { maxSpendPerTx: 0.25, hourlySpendLimit: 2, allowedPrograms: [SYSTEM_PROGRAM, TOKEN_PROGRAM, JUPITER, COMPUTE] },
  },
  {
    id: "arb-scanner-v3",
    pubkey: fakePubkey(),
    status: "killed",
    config: { maxSpendPerTx: 1.0, hourlySpendLimit: 10, allowedPrograms: [SYSTEM_PROGRAM, TOKEN_PROGRAM, JUPITER, RAYDIUM, ORCA, COMPUTE] },
  },
];

const insertAgent = db.prepare(
  "INSERT INTO agents (id, pubkey, status, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
);

for (const a of agents) {
  const created = now - h24 + Math.floor(Math.random() * 3600_000);
  insertAgent.run(a.id, a.pubkey, a.status, JSON.stringify(a.config), created, now);
}

// --- Transactions + Events ---
const insertTx = db.prepare(
  "INSERT INTO transactions (signature, agent_id, status, program_ids, estimated_sol, decoded_data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
const insertEvent = db.prepare(
  "INSERT INTO events (id, agent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?)"
);
const insertAnomaly = db.prepare(
  "INSERT INTO anomalies (id, agent_id, type, severity, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
);

interface TxProfile {
  agentId: string;
  programs: string[][];
  solRange: [number, number];
  txCount: number;
  blockedCount: number;
}

const profiles: TxProfile[] = [
  {
    agentId: "jupiter-swap-bot",
    programs: [[SYSTEM_PROGRAM, TOKEN_PROGRAM, JUPITER, COMPUTE]],
    solRange: [0.02, 0.35],
    txCount: 87,
    blockedCount: 2,
  },
  {
    agentId: "dca-accumulator",
    programs: [[SYSTEM_PROGRAM, TOKEN_PROGRAM, JUPITER, COMPUTE]],
    solRange: [0.05, 0.2],
    txCount: 48,
    blockedCount: 1,
  },
  {
    agentId: "arb-scanner-v3",
    programs: [
      [SYSTEM_PROGRAM, TOKEN_PROGRAM, JUPITER, RAYDIUM, COMPUTE],
      [SYSTEM_PROGRAM, TOKEN_PROGRAM, ORCA, COMPUTE],
      [SYSTEM_PROGRAM, TOKEN_PROGRAM, RAYDIUM, COMPUTE],
    ],
    solRange: [0.1, 0.8],
    txCount: 124,
    blockedCount: 5,
  },
];

let totalTx = 0;
let totalBlocked = 0;
let totalSpend = 0;
let totalSaved = 0;

for (const profile of profiles) {
  const timestamps: number[] = [];
  for (let i = 0; i < profile.txCount; i++) {
    timestamps.push(now - h24 + Math.floor(Math.random() * h24));
  }
  timestamps.sort();

  for (let i = 0; i < profile.txCount; i++) {
    const ts = timestamps[i];
    const sig = fakeSig();
    const programs = randomChoice(profile.programs);
    const sol = +(profile.solRange[0] + Math.random() * (profile.solRange[1] - profile.solRange[0])).toFixed(4);
    const isBlocked = i < profile.blockedCount;
    const status = isBlocked ? "blocked" : Math.random() > 0.05 ? "confirmed" : "sent";

    insertTx.run(sig, profile.agentId, status, JSON.stringify(programs), sol, "{}", ts);

    insertEvent.run(nanoid(), profile.agentId, isBlocked ? "tx_blocked" : "tx_sent", JSON.stringify({
      signature: sig,
      programIds: programs,
      estimatedSol: sol,
    }), ts);

    if (status === "confirmed") {
      insertEvent.run(nanoid(), profile.agentId, "tx_confirmed", JSON.stringify({ signature: sig }), ts + 2000);
    }

    if (isBlocked) {
      insertEvent.run(nanoid(), profile.agentId, "guardrail_violation", JSON.stringify({
        reason: sol > profile.solRange[1] ? "Exceeds max spend per tx" : "Hourly spend limit exceeded",
        estimatedSol: sol,
      }), ts);
      totalSaved += sol;
      totalBlocked++;
    } else {
      totalSpend += sol;
    }
    totalTx++;
  }
}

// --- Anomalies for arb-scanner (the "rogue" one) ---
const arbAnomalies = [
  {
    type: "spend_velocity",
    severity: "WARNING",
    details: { currentSpend: 4.2, threshold: 5, windowMinutes: 5 },
    hoursAgo: 6,
  },
  {
    type: "spend_velocity",
    severity: "WARNING",
    details: { currentSpend: 6.8, threshold: 5, windowMinutes: 5 },
    hoursAgo: 3,
  },
  {
    type: "unknown_program",
    severity: "WARNING",
    details: { unknownPrograms: [fakePubkey()], allPrograms: [{ id: fakePubkey(), name: null }] },
    hoursAgo: 2.5,
  },
  {
    type: "spend_velocity",
    severity: "CRITICAL",
    details: { currentSpend: 11.3, threshold: 5, windowMinutes: 5 },
    hoursAgo: 2,
  },
];

for (const a of arbAnomalies) {
  const ts = now - Math.floor(a.hoursAgo * 3600_000);
  insertAnomaly.run(nanoid(), "arb-scanner-v3", a.type, a.severity, JSON.stringify(a.details), ts);
  insertEvent.run(nanoid(), "arb-scanner-v3", "anomaly_detected", JSON.stringify({
    anomalyType: a.type,
    severity: a.severity,
    ...a.details,
  }), ts);
}

// Kill switch event for arb-scanner
const killTs = now - Math.floor(1.9 * 3600_000);
insertEvent.run(nanoid(), "arb-scanner-v3", "kill_switch_activated", JSON.stringify({
  reason: "Spend velocity critical: 11.3 SOL in 5min",
  auto: true,
}), killTs);

// One warning anomaly for jupiter-swap-bot (healthy agent with one blip)
insertAnomaly.run(nanoid(), "jupiter-swap-bot", "spend_velocity", "WARNING", JSON.stringify({
  currentSpend: 3.1, threshold: 5, windowMinutes: 5,
}), now - 8 * 3600_000);

db.close();

console.log(`
  ╔══════════════════════════════════════════╗
  ║   SEED DATA LOADED                       ║
  ╠══════════════════════════════════════════╣
  ║   Agents:       ${agents.length}                        ║
  ║   Transactions:  ${totalTx}                      ║
  ║   Blocked:       ${totalBlocked}                        ║
  ║   Total spend:   ${totalSpend.toFixed(2)} SOL               ║
  ║   Saved:         ${totalSaved.toFixed(2)} SOL                ║
  ║   Anomalies:     ${arbAnomalies.length + 1}                        ║
  ╚══════════════════════════════════════════╝
`);
