import { Hono } from "hono";
import { cors } from "hono/cors";
import agents from "./routes/agents.js";
import events from "./routes/events.js";
import transactions from "./routes/transactions.js";
import webhook from "./routes/webhook.js";
import anomalies from "./routes/anomalies.js";
import { getDb } from "./db/schema.js";
import { addClient, removeClient, getClientCount } from "./ws/hub.js";
import { startDevnetRefresh } from "./cron/devnet-refresh.js";
import { startDevnetValidation } from "./cron/devnet-validate.js";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  })
);

app.route("/api/agents", agents);
app.route("/api/events", events);
app.route("/api/transactions", transactions);
app.route("/webhook", webhook);
app.route("/api/anomalies", anomalies);

app.get("/", (c) =>
  c.json({
    name: "Sentrix API",
    version: "0.1.0",
    description: "Agent observability for Solana",
    endpoints: ["/health", "/api/agents", "/api/transactions", "/api/events", "/api/anomalies"],
  })
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    clients: getClientCount(),
    uptime: process.uptime(),
  })
);

app.post("/api/admin/cleanup-fake-blocked", (c) => {
  const db = getDb();
  const fakes = db.query(
    "SELECT signature FROM transactions WHERE agent_id = 'devnet-live-agent' AND status = 'blocked' AND signature NOT LIKE 'blocked_%' AND signature NOT LIKE 'seed_%'"
  ).all() as any[];
  for (const row of fakes) {
    db.query("DELETE FROM transactions WHERE signature = ?").run(row.signature);
    db.query("DELETE FROM events WHERE agent_id = 'devnet-live-agent' AND data LIKE ?").run(`%${row.signature}%`);
  }
  return c.json({ deleted: fakes.length, signatures: fakes.map((r: any) => r.signature.slice(0, 30)) });
});

app.post("/api/reseed", async (c) => {
  const seedScript = new URL("./db/seed.ts", import.meta.url).pathname;
  const proc = Bun.spawn(["bun", "run", seedScript], { stdout: "inherit", stderr: "inherit" });
  await proc.exited;
  return c.json({ status: "reseeded", timestamp: Date.now() });
});

const PORT = parseInt(process.env.PORT ?? "4000");

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const agentId = url.searchParams.get("agentId") ?? undefined;
      const upgraded = server.upgrade(req, {
        data: { agentId, type: agentId ? "agent" : "dashboard" },
      });
      if (upgraded) return undefined as any;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      addClient(ws as any);
      console.log(`[ws] client connected (${getClientCount()} total)`);
    },
    message(_ws, _message) {},
    close(ws) {
      removeClient(ws as any);
      console.log(`[ws] client disconnected (${getClientCount()} total)`);
    },
  },
});

console.log(`
  ╔══════════════════════════════════════╗
  ║   SENTRIX SERVER                     ║
  ║   http://localhost:${PORT}              ║
  ║   WebSocket: ws://localhost:${PORT}/ws  ║
  ╚══════════════════════════════════════╝
`);

startDevnetRefresh();
startDevnetValidation();