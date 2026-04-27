import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api";

export function SpendChart({ agentId }: { agentId?: string }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    api.transactions.list({ agentId, limit: 100 }).then((txs) => {
      const buckets = new Map<string, number>();
      for (const tx of txs) {
        if (tx.status === "blocked") continue;
        const d = new Date(tx.timestamp);
        const key = `${d.getHours().toString().padStart(2, "0")}:${(Math.floor(d.getMinutes() / 10) * 10).toString().padStart(2, "0")}`;
        buckets.set(key, (buckets.get(key) ?? 0) + (tx.estimated_sol ?? 0));
      }
      const sorted = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, sol]) => ({ time, sol: +sol.toFixed(4) }));
      setData(sorted);
    });
  }, [agentId]);

  if (data.length === 0) return null;

  return (
    <div className="bg-surface-raised rounded-xl p-4 border border-white/5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        Spend Over Time (SOL)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1d2e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="sol"
            stroke="#6366f1"
            fill="url(#spendGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
