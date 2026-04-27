import type { ServerWebSocket } from "bun";

interface WsData {
  agentId?: string;
  type: "dashboard" | "agent";
}

const clients = new Set<ServerWebSocket<WsData>>();

export function addClient(ws: ServerWebSocket<WsData>): void {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<WsData>): void {
  clients.delete(ws);
}

export function broadcast(data: Record<string, unknown>): void {
  const message = JSON.stringify(data);
  for (const client of clients) {
    try {
      client.send(message);
    } catch {
      clients.delete(client);
    }
  }
}

export function broadcastToAgent(agentId: string, data: Record<string, unknown>): void {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.data.agentId === agentId) {
      try {
        client.send(message);
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
