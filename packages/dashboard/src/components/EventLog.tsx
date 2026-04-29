import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";

const typeColors: Record<string, string> = {
  tx_sent: "bg-yellow-500/20 text-yellow-400",
  tx_confirmed: "bg-success/20 text-success",
  tx_blocked: "bg-danger/20 text-danger",
  anomaly_detected: "bg-warning/20 text-warning",
  kill_switch_activated: "bg-danger/20 text-danger",
  guardrail_violation: "bg-danger/20 text-danger",
};

export function EventLog({ agentId }: { agentId?: string }) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const load = () => api.events.list({ agentId, limit: 50 }).then(setEvents);
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  if (events.length === 0) {
    return (
      <div className="bg-surface-raised rounded-xl p-6 border border-white/5 text-gray-500 text-center">
        No events yet
      </div>
    );
  }

  return (
    <div className="bg-surface-raised rounded-xl border border-white/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-gray-300">Event Log</h3>
      </div>
      <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02]"
          >
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0",
                typeColors[evt.type] ?? "bg-white/10 text-gray-400"
              )}
            >
              {evt.type}
            </span>
            <span className="text-xs text-gray-500 shrink-0">
              {new Date(evt.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-xs text-gray-400 truncate">
              {evt.agent_id}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
