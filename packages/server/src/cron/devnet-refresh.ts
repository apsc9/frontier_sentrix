import {
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
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

function recordTx(sig: string, agentId: string, sol: number, programs: string[], status: string, ts: number) {
  const db = getDb();
  db.query(
    "INSERT OR IGNORE INTO transactions (signature, agent_id, status, program_ids, estimated_sol, decoded_data, timestamp) VALUES (?, ?, ?, ?, ?, '{}', ?)"
  ).run(sig, agentId, status, JSON.stringify(programs), sol, ts);
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
}

export function startDevnetRefresh() {
  const keypair = getKeypair();
  if (!keypair) {
    console.log("[devnet-refresh] DEMO_AGENT_KEYPAIR not set — auto-refresh disabled");
    return;
  }

  console.log(`[devnet-refresh] Enabled — refreshing every 4h`);
  console.log(`[devnet-refresh] Agent pubkey: ${keypair.publicKey.toBase58()}`);

  // Run first refresh 5 min after server start (let seed complete first)
  setTimeout(() => {
    sendRefreshTxs();
    setInterval(sendRefreshTxs, REFRESH_INTERVAL);
  }, 5 * 60 * 1000);
}
