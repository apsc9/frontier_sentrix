import { Hono } from "hono";
import { getDb } from "../db/schema.js";

const transactions = new Hono();

transactions.get("/", (c) => {
  const db = getDb();
  const agentId = c.req.query("agentId");
  const status = c.req.query("status");
  const limit = parseInt(c.req.query("limit") ?? "50");

  let query = "SELECT * FROM transactions";
  const conditions: string[] = [];
  const params: any[] = [];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit);

  const rows = db.query(query).all(...params);
  return c.json(
    (rows as any[]).map((r: any) => ({
      ...r,
      program_ids: JSON.parse(r.program_ids),
      decoded_data: JSON.parse(r.decoded_data),
    }))
  );
});

transactions.get("/stats", (c) => {
  const db = getDb();
  const agentId = c.req.query("agentId");

  const baseWhere = agentId
    ? "WHERE agent_id = ?"
    : "WHERE 1=1";
  const baseParams = agentId ? [agentId] : [];

  const total = db
    .query<{ count: number }, any[]>(`SELECT COUNT(*) as count FROM transactions ${baseWhere}`)
    .get(...baseParams);

  const blocked = db
    .query<{ count: number }, any[]>(
      `SELECT COUNT(*) as count FROM transactions ${baseWhere} AND status = 'blocked'`
    )
    .get(...baseParams);

  const totalSpend = db
    .query<{ total: number }, any[]>(
      `SELECT COALESCE(SUM(estimated_sol), 0) as total FROM transactions ${baseWhere} AND status != 'blocked'`
    )
    .get(...baseParams);

  const savedSpend = db
    .query<{ total: number }, any[]>(
      `SELECT COALESCE(SUM(estimated_sol), 0) as total FROM transactions ${baseWhere} AND status = 'blocked'`
    )
    .get(...baseParams);

  return c.json({
    totalTransactions: total?.count ?? 0,
    blockedTransactions: blocked?.count ?? 0,
    totalSpendSol: totalSpend?.total ?? 0,
    savedSpendSol: savedSpend?.total ?? 0,
  });
});

export default transactions;
