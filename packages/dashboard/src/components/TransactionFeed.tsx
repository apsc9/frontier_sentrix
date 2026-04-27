import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";

const statusColors: Record<string, string> = {
  sent: "text-yellow-400",
  confirmed: "text-success",
  blocked: "text-danger",
};

export function TransactionFeed({ agentId }: { agentId?: string }) {
  const [txs, setTxs] = useState<any[]>([]);

  useEffect(() => {
    const load = () =>
      api.transactions.list({ agentId, limit: 30 }).then(setTxs);
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  if (txs.length === 0) {
    return (
      <div className="bg-surface-raised rounded-xl p-6 border border-white/5 text-gray-500 text-center">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="bg-surface-raised rounded-xl border border-white/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-gray-300">
          Recent Transactions
        </h3>
      </div>
      <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
        {txs.map((tx) => (
          <div
            key={tx.signature}
            className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs truncate text-gray-300">
                {tx.signature}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(tx.timestamp).toLocaleTimeString()} &middot;{" "}
                {tx.program_ids?.length ?? 0} programs
              </p>
            </div>
            <div className="text-right shrink-0">
              <span
                className={cn(
                  "text-xs font-medium",
                  statusColors[tx.status] ?? "text-gray-400"
                )}
              >
                {tx.status}
              </span>
              {tx.estimated_sol > 0 && (
                <p className="text-xs text-gray-500">
                  {tx.estimated_sol.toFixed(4)} SOL
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
