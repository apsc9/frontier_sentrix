import { Hono } from "hono";
import { getDb } from "../db/schema.js";
import { broadcast, broadcastToAgent } from "../ws/hub.js";

const agents = new Hono();

agents.get("/", (c) => {
  const db = getDb();
  const rows = db.query("SELECT * FROM agents ORDER BY created_at DESC").all();
  return c.json(
    rows.map((r: any) => ({ ...r, config: JSON.parse(r.config) }))
  );
});

agents.get("/:id", (c) => {
  const db = getDb();
  const row = db
    .query<any, [string]>("SELECT * FROM agents WHERE id = ?")
    .get(c.req.param("id"));

  if (!row) return c.json({ error: "Agent not found" }, 404);
  return c.json({ ...row, config: JSON.parse(row.config) });
});

agents.post("/", async (c) => {
  const body = await c.req.json();
  const db = getDb();
  const now = Date.now();

  const existing = db
    .query<any, [string]>("SELECT id FROM agents WHERE id = ?")
    .get(body.id);

  if (existing) {
    db.query(
      `UPDATE agents SET pubkey = ?, config = ?, status = 'active', updated_at = ? WHERE id = ?`
    ).run(body.pubkey, JSON.stringify(body.config ?? {}), now, body.id);
  } else {
    db.query(
      `INSERT INTO agents (id, pubkey, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(body.id, body.pubkey, JSON.stringify(body.config ?? {}), now, now);
  }

  broadcast({ type: "agent_registered", agentId: body.id });
  return c.json({ ok: true });
});

agents.post("/:id/kill", async (c) => {
  const db = getDb();
  const agentId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const reason = (body as any).reason ?? "Manual kill switch";

  db.query(
    `UPDATE agents SET status = 'killed', updated_at = ? WHERE id = ?`
  ).run(Date.now(), agentId);

  broadcastToAgent(agentId, {
    type: "kill_switch",
    killed: true,
    reason,
  });

  broadcast({
    type: "kill_switch",
    agentId,
    killed: true,
    reason,
    auto: false,
  });

  return c.json({ ok: true, killed: true });
});

agents.delete("/:id/kill", (c) => {
  const db = getDb();
  const agentId = c.req.param("id");

  db.query(
    `UPDATE agents SET status = 'active', updated_at = ? WHERE id = ?`
  ).run(Date.now(), agentId);

  broadcastToAgent(agentId, {
    type: "kill_switch",
    killed: false,
  });

  broadcast({
    type: "kill_switch",
    agentId,
    killed: false,
  });

  return c.json({ ok: true, killed: false });
});

agents.put("/:id/config", async (c) => {
  const db = getDb();
  const agentId = c.req.param("id");
  const config = await c.req.json();

  db.query(
    `UPDATE agents SET config = ?, updated_at = ? WHERE id = ?`
  ).run(JSON.stringify(config), Date.now(), agentId);

  broadcastToAgent(agentId, { type: "config_update", config });
  broadcast({ type: "config_update", agentId, config });

  return c.json({ ok: true });
});

export default agents;
