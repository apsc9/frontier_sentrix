import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { TransactionDetail } from "./TransactionDetail";

const statusColors: Record<string, string> = {
  sent: "text-amber-400",
  confirmed: "text-emerald-400",
  blocked: "text-red-400",
};

const statusDots: Record<string, string> = {
  sent: "bg-amber-400",
  confirmed: "bg-emerald-400",
  blocked: "bg-red-400",
};

export function TransactionFeed({ agentId, tick }: { agentId?: string; tick: number }) {
  const [txs, setTxs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    api.transactions.list({ agentId, limit: 30 }).then(setTxs);
  }, [agentId, tick]);

  useEffect(() => {
    const interval = setInterval(
      () => api.transactions.list({ agentId, limit: 30 }).then(setTxs),
      5000
    );
    return () => clearInterval(interval);
  }, [agentId]);

  return (
    <>
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden animate-fade-up stagger-2">
        <div className="px-4 py-3 border-b border-zinc-800/50">
          <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            Recent Transactions
          </h3>
        </div>
        {txs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-600">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/30 max-h-80 overflow-y-auto">
            {txs.map((tx) => (
              <div
                key={tx.signature}
                onClick={() => setSelected(tx)}
                className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-zinc-800/30 cursor-pointer transition-colors duration-150"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    statusDots[tx.status] ?? "bg-zinc-500"
                  )} />
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] truncate text-zinc-300">
                      {tx.signature}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    "text-[10px] font-medium uppercase tracking-wider",
                    statusColors[tx.status] ?? "text-zinc-500"
                  )}>
                    {tx.status}
                  </span>
                  {tx.estimated_sol > 0 && (
                    <p className="text-[11px] text-zinc-400 font-mono">
                      {tx.estimated_sol.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <TransactionDetail tx={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
