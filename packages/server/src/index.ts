import { Hono } from "hono";
import { cors } from "hono/cors";
import agents from "./routes/agents.js";
import events from "./routes/events.js";
import transactions from "./routes/transactions.js";
import webhook from "./routes/webhook.js";
import anomalies from "./routes/anomalies.js";
import { addClient, removeClient, getClientCount } from "./ws/hub.js";

const app = new Hono();

app.use("/*", cors());

app.route("/api/agents", agents);
app.route("/api/events", events);
app.route("/api/transactions", transactions);
app.route("/webhook", webhook);
app.route("/api/anomalies", anomalies);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    clients: getClientCount(),
    uptime: process.uptime(),
  })
);

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

export default app;
