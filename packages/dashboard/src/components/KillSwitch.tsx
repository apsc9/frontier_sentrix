import { useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";

interface KillSwitchProps {
  agent: any;
  onToggle: () => void;
}

export function KillSwitch({ agent, onToggle }: KillSwitchProps) {
  const [loading, setLoading] = useState(false);
  const isKilled = agent.status === "killed";

  const toggle = async () => {
    setLoading(true);
    try {
      if (isKilled) {
        await api.agents.revive(agent.id);
      } else {
        await api.agents.kill(agent.id, "Manual kill from dashboard");
      }
      onToggle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        "px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border",
        isKilled
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 animate-glow-pulse",
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      {loading ? "..." : isKilled ? "↻ Revive" : "⏻ Kill Agent"}
    </button>
  );
}
