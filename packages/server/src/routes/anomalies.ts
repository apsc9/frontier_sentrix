import { Hono } from "hono";
import { getDb } from "../db/schema.js";

const anomalies = new Hono();

anomalies.get("/", (c) => {
  const db = getDb();
  const agentId = c.req.query("agentId");
  const severity = c.req.query("severity");
  const limit = parseInt(c.req.query("limit") ?? "50");

  let query = "SELECT * FROM anomalies";
  const conditions: string[] = [];
  const params: any[] = [];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }
  if (severity) {
    conditions.push("severity = ?");
    params.push(severity);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit);

  const rows = db.query(query).all(...params);
  return c.json(
    (rows as any[]).map((r) => ({ ...r, details: JSON.parse(r.details) }))
  );
});

export default anomalies;
