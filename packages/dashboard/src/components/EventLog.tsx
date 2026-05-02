import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";

const typeStyles: Record<string, string> = {
  tx_sent: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  tx_confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  tx_blocked: "bg-red-500/10 text-red-400 border-red-500/20",
  anomaly_detected: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  kill_switch_activated: "bg-red-500/10 text-red-400 border-red-500/20",
  guardrail_violation: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function EventLog({ agentId, tick }: { agentId?: string; tick: number }) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.events.list({ agentId, limit: 50 }).then(setEvents);
  }, [agentId, tick]);

  useEffect(() => {
    const interval = setInterval(
      () => api.events.list({ agentId, limit: 50 }).then(setEvents),
      5000
    );
    return () => clearInterval(interval);
  }, [agentId]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden animate-fade-up stagger-3">
      <div className="px-4 py-3 border-b border-zinc-800/50">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
          Event Log
        </h3>
      </div>
      {events.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-zinc-600">No events yet</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/30 max-h-80 overflow-y-auto">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="px-4 py-2 flex items-center gap-3 hover:bg-zinc-800/20 transition-colors duration-150"
            >
              <span
                className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded border font-mono shrink-0",
                  typeStyles[evt.type] ?? "bg-zinc-800/50 text-zinc-500 border-zinc-700/50"
                )}
              >
                {evt.type}
              </span>
              <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono truncate">
                {evt.agent_id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
