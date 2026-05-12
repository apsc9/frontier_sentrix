import {
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import { getDb } from "../db/schema.js";
import { broadcast } from "../ws/hub.js";
import { nanoid } from "nanoid";

const AGENT_ID = "devnet-live-agent";
const SYSTEM = SystemProgram.programId.toBase58();
const REFRESH_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

function getKeypair(): Keypair | null {
  const raw = process.env.DEMO_AGENT_KEYPAIR;
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return Keypair.fromSecretKey(new Uint8Array(data));
  } catch {
    return null;
  }
}

function getRpcUrl(): string {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://devnet.helius-rpc.com/?api-key=${key}`
    : "https://api.devnet.solana.com";
}

function emitEvent(agentId: string, type: string, data: Record<string, any>, ts: number) {
  const db = getDb();
  const id = nanoid();
  db.query(
    "INSERT OR IGNORE INTO events (id, agent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?)"
  ).run(id, agentId, type, JSON.stringify(data), ts);
  broadcast({ type: "event", event: { id, agentId, type, data, timestamp: ts } });
}

function recordTx(sig: string, agentId: string, sol: number, programs: string[], status: string, ts: number, decodedData?: Record<string, any>) {
  const db = getDb();
  db.query(
    "INSERT OR IGNORE INTO transactions (signature, agent_id, status, program_ids, estimated_sol, decoded_data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(sig, agentId, status, JSON.stringify(programs), sol, JSON.stringify(decodedData ?? {}), ts);
}

async function backfillFromChain() {
  const keypair = getKeypair();
  if (!keypair) return;

  const connection = new Connection(getRpcUrl(), "confirmed");
  const pubkey = keypair.publicKey;

  console.log(`[devnet-backfill] Fetching tx history for ${pubkey.toBase58()}`);

  try {
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 1000 });
    console.log(`[devnet-backfill] Found ${sigs.length} txs on chain`);

    const db = getDb();
    const existing = new Set(
      (db.query("SELECT signature FROM transactions WHERE agent_id = ?").all(AGENT_ID) as any[])
        .map((r: any) => r.signature)
    );

    let imported = 0;

    for (const sigInfo of sigs) {
      if (existing.has(sigInfo.signature)) continue;

      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) continue;

        const programIds = tx.transaction.message.staticAccountKeys
          ? tx.transaction.message.staticAccountKeys.map((k: PublicKey) => k.toBase58())
          : [];

        const programs = programIds.filter((id: string) =>
          tx.transaction.message.compiledInstructions?.some(
            (ix: any) => programIds[ix.programIdIndex] === id
          ) || id === SYSTEM
        );

        const preBalance = tx.meta.preBalances[0] ?? 0;
        const postBalance = tx.meta.postBalances[0] ?? 0;
        const fee = tx.meta.fee ?? 0;
        const sol = Math.abs(preBalance - postBalance - fee) / LAMPORTS_PER_SOL;

        const ts = (sigInfo.blockTime ?? Math.floor(Date.now() / 1000)) * 1000;
        const status = sigInfo.err ? "failed" : "confirmed";

        recordTx(sigInfo.signature, AGENT_ID, +sol.toFixed(6), programs.length > 0 ? programs : [SYSTEM], status, ts);
        emitEvent(AGENT_ID, "tx_sent", {
          signature: sigInfo.signature,
          programIds: programs.length > 0 ? programs : [SYSTEM],
          estimatedSol: +sol.toFixed(6),
        }, ts);
        emitEvent(AGENT_ID, "tx_confirmed", { signature: sigInfo.signature }, ts + 2000);

        imported++;
        console.log(`[devnet-backfill] Imported: ${sigInfo.signature.slice(0, 20)}... ${sol.toFixed(4)} SOL`);

        await new Promise((r) => setTimeout(r, 200));
      } catch (err: any) {
        console.log(`[devnet-backfill] Skip ${sigInfo.signature.slice(0, 20)}...: ${err.message}`);
      }
    }

    console.log(`[devnet-backfill] Done — imported ${imported} txs, ${existing.size} already in DB`);
  } catch (err: any) {
    console.log(`[devnet-backfill] Failed: ${err.message}`);
  }
}

async function sendRefreshTxs() {
  const keypair = getKeypair();
  if (!keypair) {
    console.log("[devnet-refresh] No DEMO_AGENT_KEYPAIR env var — skipping");
    return;
  }

  const connection = new Connection(getRpcUrl(), "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);
  const balSol = balance / LAMPORTS_PER_SOL;

  if (balSol < 0.2) {
    console.log(`[devnet-refresh] Low balance: ${balSol.toFixed(4)} SOL — skipping`);
    return;
  }

  const receiver = Keypair.generate();
  const amounts = [0.01, 0.015, 0.02, 0.005, 0.025];
  let sent = 0;

  for (const amount of amounts) {
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: receiver.publicKey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
      const ts = Date.now();

      recordTx(sig, AGENT_ID, amount, [SYSTEM], "confirmed", ts);
      emitEvent(AGENT_ID, "tx_sent", {
        signature: sig,
        programIds: [SYSTEM],
        estimatedSol: amount,
      }, ts);
      emitEvent(AGENT_ID, "tx_confirmed", { signature: sig }, ts + 2000);

      sent++;
      console.log(`[devnet-refresh] TX ${sent}/5: ${amount} SOL → ${sig.slice(0, 20)}...`);
    } catch (err: any) {
      console.log(`[devnet-refresh] TX failed: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`[devnet-refresh] Done — ${sent} fresh txs on Explorer`);

  // Simulate blocked txs (guardrail violations)
  simulateBlockedTxs();
}

function fakeSig(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 83; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "blocked_" + s;
}

function fakePubkey(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function simulateBlockedTxs() {
  const db = getDb();

  const blockedScenarios = [
    {
      reason: "Exceeds max spend per tx (0.08 SOL limit)",
      sol: +(0.1 + Math.random() * 0.9).toFixed(4),
      programs: [SYSTEM],
      anomalyType: "guardrail_violation",
    },
    {
      reason: "Exceeds max spend per tx (0.08 SOL limit)",
      sol: +(0.2 + Math.random() * 1.5).toFixed(4),
      programs: [SYSTEM],
      anomalyType: "guardrail_violation",
    },
    {
      reason: "Program not in allowlist",
      sol: +(0.01 + Math.random() * 0.05).toFixed(4),
      programs: [SYSTEM, fakePubkey()],
      anomalyType: "unknown_program",
    },
  ];

  // Pick 2-3 random scenarios
  const count = 2 + Math.floor(Math.random() * 2);
  const shuffled = blockedScenarios.sort(() => Math.random() - 0.5).slice(0, count);
  let blocked = 0;

  for (const scenario of shuffled) {
    const sig = fakeSig();
    const ts = Date.now() - Math.floor(Math.random() * 60000);

    recordTx(sig, AGENT_ID, scenario.sol, scenario.programs, "blocked", ts, { blockReason: scenario.reason });

    emitEvent(AGENT_ID, "tx_blocked", {
      signature: sig,
      programIds: scenario.programs,
      estimatedSol: scenario.sol,
    }, ts);

    emitEvent(AGENT_ID, "guardrail_violation", {
      reason: scenario.reason,
      estimatedSol: scenario.sol,
    }, ts);

    // Insert anomaly
    const anomalyId = nanoid();
    const details = scenario.anomalyType === "unknown_program"
      ? {
          unknownPrograms: [scenario.programs[1]],
          allPrograms: [{ id: scenario.programs[1], name: null }],
          message: "Agent called unrecognized program",
        }
      : {
          reason: scenario.reason,
          estimatedSol: scenario.sol,
          message: "Transaction blocked by guardrail",
        };

    db.query(
      "INSERT OR IGNORE INTO anomalies (id, agent_id, type, severity, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(anomalyId, AGENT_ID, scenario.anomalyType, "WARNING", JSON.stringify(details), ts);

    broadcast({ type: "anomaly", anomaly: { id: anomalyId, agentId: AGENT_ID, type: scenario.anomalyType, severity: "WARNING", details, timestamp: ts } });

    blocked++;
    console.log(`[devnet-refresh] BLOCKED ${blocked}/${count}: ${scenario.sol} SOL — ${scenario.reason}`);
  }

  console.log(`[devnet-refresh] Simulated ${blocked} blocked txs + anomalies`);
}

export function startDevnetRefresh() {
  const keypair = getKeypair();
  if (!keypair) {
    console.log("[devnet-refresh] DEMO_AGENT_KEYPAIR not set — auto-refresh disabled");
    return;
  }

  console.log(`[devnet-refresh] Enabled — refreshing every 4h`);
  console.log(`[devnet-refresh] Agent pubkey: ${keypair.publicKey.toBase58()}`);

  // Backfill from chain immediately on startup, then start refresh cycle
  backfillFromChain().then(() => {
    setTimeout(() => {
      sendRefreshTxs();
      setInterval(sendRefreshTxs, REFRESH_INTERVAL);
    }, 5 * 60 * 1000);
  });
}
