import { Hono } from "hono";
import { cors } from "hono/cors";
import agents from "./routes/agents.js";
import events from "./routes/events.js";
import transactions from "./routes/transactions.js";
import webhook from "./routes/webhook.js";
import anomalies from "./routes/anomalies.js";
import { addClient, removeClient, getClientCount } from "./ws/hub.js";
import { startDevnetRefresh } from "./cron/devnet-refresh.js";

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

// Auto-reseed every 20h to keep demo data fresh (timestamps are relative to seed time)
const seedPath = new URL("./db/seed.ts", import.meta.url).pathname;

async function reseed() {
  console.log("[reseed] Refreshing seed data...");
  const proc = Bun.spawn(["bun", "run", seedPath], { stdout: "inherit", stderr: "inherit" });
  await proc.exited;
  console.log("[reseed] Done.");
}

const RESEED_INTERVAL = 20 * 60 * 60 * 1000;
setInterval(reseed, RESEED_INTERVAL);

startDevnetRefresh();