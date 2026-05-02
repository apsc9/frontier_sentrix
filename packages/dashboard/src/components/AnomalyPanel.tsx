import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";

const severityStyles: Record<string, { border: string; text: string; dot: string }> = {
  CRITICAL: { border: "border-l-red-500", text: "text-red-400", dot: "bg-red-400" },
  WARNING: { border: "border-l-amber-500", text: "text-amber-400", dot: "bg-amber-400" },
  INFO: { border: "border-l-emerald-500", text: "text-emerald-400", dot: "bg-emerald-400" },
};

const typeLabels: Record<string, string> = {
  spend_velocity: "Spend Velocity",
  unknown_program: "Unknown Program",
  large_transaction: "Large Transaction",
  failed_tx_spike: "Failed TX Spike",
};

export function AnomalyPanel({ agentId, tick }: { agentId?: string; tick: number }) {
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    api.anomalies.list({ agentId, limit: 20 }).then(setAnomalies).catch(() => {});
  }, [agentId, tick]);

  useEffect(() => {
    const interval = setInterval(
      () => api.anomalies.list({ agentId, limit: 20 }).then(setAnomalies).catch(() => {}),
      5000
    );
    return () => clearInterval(interval);
  }, [agentId]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden animate-fade-up stagger-2">
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
          Anomaly Alerts
        </h3>
        {anomalies.length > 0 && (
          <span className="text-[10px] text-zinc-600 font-mono">
            {anomalies.length} detected
          </span>
        )}
      </div>
      {anomalies.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-zinc-600">No anomalies detected</p>
          <p className="text-[10px] text-zinc-700 mt-1">All agents operating within bounds</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/30 max-h-80 overflow-y-auto">
          {anomalies.map((a, i) => {
            const style = severityStyles[a.severity] ?? severityStyles.INFO;
            return (
              <div
                key={a.id}
                style={{ animationDelay: `${i * 50}ms` }}
                className={cn(
                  "px-4 py-2.5 border-l-2 animate-slide-in hover:bg-zinc-800/20 transition-colors",
                  style.border
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", style.text)}>
                      {a.severity}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {typeLabels[a.type] ?? a.type}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {a.type === "spend_velocity" && a.details && (
                    <span>
                      {a.details.currentSpend?.toFixed(2)} SOL in {a.details.windowMinutes}min
                      <span className="text-zinc-600"> · limit {a.details.threshold} SOL</span>
                    </span>
                  )}
                  {a.type === "unknown_program" && a.details?.unknownPrograms && (
                    <span className="font-mono">
                      {a.details.unknownPrograms.length} unknown: {a.details.unknownPrograms[0]?.slice(0, 12)}…
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-700 mt-0.5 font-mono">{a.agent_id}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
