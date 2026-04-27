const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path}: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path}: ${res.status}`);
  return res.json();
}

export const api = {
  agents: {
    list: () => get<any[]>("/agents"),
    get: (id: string) => get<any>(`/agents/${id}`),
    register: (data: any) => post("/agents", data),
    kill: (id: string, reason?: string) =>
      post(`/agents/${id}/kill`, { reason }),
    revive: (id: string) => del(`/agents/${id}/kill`),
    updateConfig: (id: string, config: any) =>
      put(`/agents/${id}/config`, config),
  },
  events: {
    list: (params?: { agentId?: string; since?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.agentId) qs.set("agentId", params.agentId);
      if (params?.since) qs.set("since", String(params.since));
      if (params?.limit) qs.set("limit", String(params.limit));
      const q = qs.toString();
      return get<any[]>(`/events${q ? `?${q}` : ""}`);
    },
  },
  transactions: {
    list: (params?: { agentId?: string; status?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.agentId) qs.set("agentId", params.agentId);
      if (params?.status) qs.set("status", params.status);
      if (params?.limit) qs.set("limit", String(params.limit));
      const q = qs.toString();
      return get<any[]>(`/transactions${q ? `?${q}` : ""}`);
    },
    stats: (agentId?: string) =>
      get<any>(`/transactions/stats${agentId ? `?agentId=${agentId}` : ""}`),
  },
};
