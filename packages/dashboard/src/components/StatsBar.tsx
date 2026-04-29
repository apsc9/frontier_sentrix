import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function StatsBar({ agentId }: { agentId?: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.transactions.stats(agentId).then(setStats);
    const interval = setInterval(
      () => api.transactions.stats(agentId).then(setStats),
      5000
    );
    return () => clearInterval(interval);
  }, [agentId]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-raised rounded-xl p-4 border border-white/5 animate-pulse">
            <div className="h-3 bg-white/5 rounded w-24 mb-2" />
            <div className="h-7 bg-white/5 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Transactions (24h)",
      value: stats.totalTransactions.toLocaleString(),
      color: "text-brand-500",
    },
    {
      label: "Blocked",
      value: stats.blockedTransactions.toLocaleString(),
      color: stats.blockedTransactions > 0 ? "text-danger" : "text-gray-400",
    },
    {
      label: "Total Spend",
      value: `${stats.totalSpendSol.toFixed(2)} SOL`,
      color: "text-white",
    },
    {
      label: "Saved by Sentrix",
      value: `${stats.savedSpendSol.toFixed(2)} SOL`,
      color: "text-success",
      highlight: stats.savedSpendSol > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            (c as any).highlight
              ? "bg-success/5 rounded-xl p-4 border border-success/20 ring-1 ring-success/10"
              : "bg-surface-raised rounded-xl p-4 border border-white/5"
          }
        >
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            {c.label}
          </p>
          <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
