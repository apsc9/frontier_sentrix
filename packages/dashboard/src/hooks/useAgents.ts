import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.agents.list();
      setAgents(data);
    } catch (err) {
      console.error("Failed to fetch agents", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { agents, loading, refresh };
}
