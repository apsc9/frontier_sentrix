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
        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        isKilled
          ? "bg-success/20 text-success hover:bg-success/30"
          : "bg-danger/20 text-danger hover:bg-danger/30",
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      {loading ? "..." : isKilled ? "Revive Agent" : "Kill Agent"}
    </button>
  );
}
