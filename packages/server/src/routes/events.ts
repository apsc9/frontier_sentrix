import { Hono } from "hono";
import { getDb } from "../db/schema.js";
import { broadcast } from "../ws/hub.js";
import { runDetection } from "../detection/engine.js";

const events = new Hono();

events.post("/", async (c) => {
  const event = await c.req.json();
  const db = getDb();

  db.query(
    `INSERT OR IGNORE INTO events (id, agent_id, type, data, timestamp)
     VALUES (?, ?, ?, ?, ?)`
  ).run(event.id, event.agentId, event.type, JSON.stringify(event.data), event.timestamp);

  if (event.type === "tx_sent" || event.type === "tx_intent") {
    const data = event.data;
    if (data.signature) {
      db.query(
        `INSERT OR IGNORE INTO transactions (signature, agent_id, status, program_ids, estimated_sol, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        data.signature,
        event.agentId,
        "sent",
        JSON.stringify(data.programIds ?? []),
        data.estimatedSol ?? 0,
        event.timestamp
      );
    }

    const agent = db
      .query<any, [string]>("SELECT config FROM agents WHERE id = ?")
      .get(event.agentId);

    const config = agent ? JSON.parse(agent.config) : {};

    runDetection({
      agentId: event.agentId,
      programIds: data.programIds ?? [],
      estimatedSol: data.estimatedSol ?? 0,
      allowedPrograms: config.allowedPrograms ?? [],
      spendThreshold: config.hourlySpendLimit ?? 5,
    });
  }

  if (event.type === "tx_confirmed" && event.data.signature) {
    db.query(
      `UPDATE transactions SET status = 'confirmed' WHERE signature = ?`
    ).run(event.data.signature);
  }

  if (event.type === "tx_blocked" || event.type === "guardrail_violation") {
    db.query(
      `INSERT OR IGNORE INTO transactions (signature, agent_id, status, program_ids, estimated_sol, timestamp)
       VALUES (?, ?, 'blocked', ?, ?, ?)`
    ).run(
      `blocked_${event.id}`,
      event.agentId,
      JSON.stringify(event.data.programIds ?? []),
      event.data.estimatedSol ?? 0,
      event.timestamp
    );
  }

  broadcast({ type: "event", event });

  return c.json({ ok: true });
});

events.get("/", (c) => {
  const db = getDb();
  const agentId = c.req.query("agentId");
  const since = c.req.query("since");
  const limit = parseInt(c.req.query("limit") ?? "50");

  let query = "SELECT * FROM events";
  const conditions: string[] = [];
  const params: any[] = [];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }
  if (since) {
    conditions.push("timestamp > ?");
    params.push(parseInt(since));
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit);

  const rows = db.query(query).all(...params);
  return c.json(
    (rows as any[]).map((r) => ({ ...r, data: JSON.parse(r.data) }))
  );
});

export default events;
