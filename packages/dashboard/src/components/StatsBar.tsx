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

  if (!stats) return null;

  const cards = [
    {
      label: "Transactions (24h)",
      value: stats.totalTransactions,
      color: "text-brand-500",
    },
    {
      label: "Blocked",
      value: stats.blockedTransactions,
      color: "text-danger",
    },
    {
      label: "Total Spend",
      value: `${stats.totalSpendSol.toFixed(4)} SOL`,
      color: "text-white",
    },
    {
      label: "Saved",
      value: `${stats.savedSpendSol.toFixed(4)} SOL`,
      color: "text-success",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-surface-raised rounded-xl p-4 border border-white/5"
        >
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {c.label}
          </p>
          <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
