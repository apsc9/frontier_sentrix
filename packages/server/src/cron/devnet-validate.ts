import { Connection } from "@solana/web3.js";
import { getDb } from "../db/schema.js";

const AGENT_ID = "devnet-live-agent";
const VALIDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const CONSECUTIVE_INVALID_CUTOFF = 2;

function getRpcUrl(): string {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://devnet.helius-rpc.com/?api-key=${key}`
    : "https://api.devnet.solana.com";
}

async function validateDevnetTxs() {
  const db = getDb();
  const connection = new Connection(getRpcUrl(), "confirmed");

  const txs = db.query(
    "SELECT signature, timestamp FROM transactions WHERE agent_id = ? AND signature NOT LIKE 'seed_%' ORDER BY timestamp DESC"
  ).all(AGENT_ID) as { signature: string; timestamp: number }[];

  if (txs.length === 0) {
    console.log("[devnet-validate] No real txs to validate");
    return;
  }

  console.log(`[devnet-validate] Checking ${txs.length} real txs (newest first)`);

  let consecutiveInvalid = 0;
  let cutoffIndex = -1;

  for (let i = 0; i < txs.length; i++) {
    const { signature } = txs[i];

    try {
      const result = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (result) {
        consecutiveInvalid = 0;
        console.log(`[devnet-validate] ✓ ${signature.slice(0, 20)}... valid`);
      } else {
        consecutiveInvalid++;
        console.log(`[devnet-validate] ✗ ${signature.slice(0, 20)}... not found (${consecutiveInvalid}/${CONSECUTIVE_INVALID_CUTOFF})`);

        if (consecutiveInvalid >= CONSECUTIVE_INVALID_CUTOFF) {
          cutoffIndex = i;
          console.log(`[devnet-validate] Cutoff reached at index ${i} — pruning everything from here down`);
          break;
        }
      }
    } catch (err: any) {
      console.log(`[devnet-validate] RPC error for ${signature.slice(0, 20)}...: ${err.message}`);
      break;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  if (cutoffIndex < 0) {
    console.log("[devnet-validate] All txs valid");
    return;
  }

  const sigsToDelete = txs.slice(cutoffIndex).map((t) => t.signature);
  const oldestKept = cutoffIndex > 0 ? new Date(txs[cutoffIndex - 1].timestamp).toISOString() : "none";

  const deleteTx = db.prepare("DELETE FROM transactions WHERE signature = ?");
  const deleteEvents = db.prepare("DELETE FROM events WHERE agent_id = ? AND data LIKE ?");

  let deleted = 0;
  for (const sig of sigsToDelete) {
    deleteTx.run(sig);
    deleteEvents.run(AGENT_ID, `%${sig}%`);
    deleted++;
  }

  console.log(`[devnet-validate] Pruned ${deleted} expired txs + related events. Oldest kept: ${oldestKept}`);
}

export function startDevnetValidation() {
  console.log("[devnet-validate] Enabled — validating every 6h");

  setTimeout(() => {
    validateDevnetTxs();
    setInterval(validateDevnetTxs, VALIDATE_INTERVAL);
  }, 10 * 60 * 1000);
}
