import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";

const severityStyles: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: "bg-danger/10 border-danger/30", text: "text-danger", dot: "bg-danger" },
  WARNING: { bg: "bg-warning/10 border-warning/30", text: "text-warning", dot: "bg-warning" },
  INFO: { bg: "bg-brand-500/10 border-brand-500/30", text: "text-brand-500", dot: "bg-brand-500" },
};

const typeLabels: Record<string, string> = {
  spend_velocity: "Spend Velocity",
  unknown_program: "Unknown Program",
  large_transaction: "Large Transaction",
  failed_tx_spike: "Failed TX Spike",
};

export function AnomalyPanel({ agentId }: { agentId?: string }) {
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    const load = () => api.anomalies.list({ agentId, limit: 20 }).then(setAnomalies).catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  if (anomalies.length === 0) {
    return (
      <div className="bg-surface-raised rounded-xl p-6 border border-white/5 text-gray-500 text-center">
        No anomalies detected
      </div>
    );
  }

  return (
    <div className="bg-surface-raised rounded-xl border border-white/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Anomaly Alerts</h3>
        <span className="text-xs text-gray-500">{anomalies.length} detected</span>
      </div>
      <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
        {anomalies.map((a) => {
          const style = severityStyles[a.severity] ?? severityStyles.INFO;
          return (
            <div
              key={a.id}
              className={cn("px-4 py-3 border-l-2", style.bg)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
                  <span className={cn("text-xs font-bold uppercase tracking-wide", style.text)}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-gray-400">
                    {typeLabels[a.type] ?? a.type}
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">
                  {new Date(a.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-1.5 text-xs text-gray-400">
                {a.type === "spend_velocity" && a.details && (
                  <span>
                    {a.details.currentSpend?.toFixed(2)} SOL in {a.details.windowMinutes}min
                    (threshold: {a.details.threshold} SOL)
                  </span>
                )}
                {a.type === "unknown_program" && a.details?.unknownPrograms && (
                  <span className="font-mono">
                    {a.details.unknownPrograms.length} unknown program{a.details.unknownPrograms.length > 1 ? "s" : ""}:
                    {" "}{a.details.unknownPrograms[0]?.slice(0, 16)}...
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-600 mt-1 font-mono">
                {a.agent_id}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
