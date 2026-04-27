import { Hono } from "hono";
import { getDb } from "../db/schema.js";
import { broadcast } from "../ws/hub.js";

const webhook = new Hono();

webhook.post("/helius", async (c) => {
  const body = await c.req.json();
  const db = getDb();

  const transactions = Array.isArray(body) ? body : [body];

  for (const tx of transactions) {
    if (!tx.signature) continue;

    const existing = db
      .query<any, [string]>("SELECT agent_id FROM transactions WHERE signature = ?")
      .get(tx.signature);

    if (existing) {
      db.query(
        `UPDATE transactions
         SET status = 'confirmed', decoded_data = ?, timestamp = ?
         WHERE signature = ?`
      ).run(JSON.stringify(tx), tx.timestamp ? tx.timestamp * 1000 : Date.now(), tx.signature);

      broadcast({
        type: "tx_confirmed_helius",
        agentId: existing.agent_id,
        signature: tx.signature,
        decoded: tx,
      });
    }
  }

  return c.json({ ok: true });
});

export default webhook;
