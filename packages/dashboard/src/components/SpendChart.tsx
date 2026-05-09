import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { api } from "../lib/api";

interface SpendChartProps {
  agentId?: string;
  tick: number;
  selectedAgent?: any;
}

export function SpendChart({ agentId, tick, selectedAgent }: SpendChartProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    api.transactions.list({ agentId, limit: 2500 }).then((txs) => {
      const confirmed = txs
        .filter((tx: any) => tx.status !== "blocked")
        .sort((a: any, b: any) => a.timestamp - b.timestamp);

      if (confirmed.length === 0) { setData([]); return; }

      const timeRange = confirmed[confirmed.length - 1].timestamp - confirmed[0].timestamp;
      const targetBuckets = 30;
      const minBucket = timeRange < 120_000 ? 3_000 : 60_000;
      const bucketMs = Math.max(timeRange / targetBuckets, minBucket);

      const buckets = new Map<number, number>();
      for (const tx of confirmed) {
        const key = Math.floor(tx.timestamp / bucketMs) * bucketMs;
        buckets.set(key, (buckets.get(key) ?? 0) + (tx.estimated_sol ?? 0));
      }

      const sorted = [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([ts, sol]) => {
          const d = new Date(ts);
          const label = timeRange < 600_000
            ? `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
            : `${d.getHours().toString().padStart(2, "0")}:${(Math.floor(d.getMinutes() / 10) * 10).toString().padStart(2, "0")}`;
          return { time: label, sol: +sol.toFixed(4) };
        });
      setData(sorted);
    });
  }, [agentId, tick]);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 text-center text-zinc-600 text-sm animate-fade-up">
        No spend data
      </div>
    );
  }

  const config = selectedAgent?.config;
  const threshold = config?.hourlySpendLimit ?? null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-fade-up stagger-1">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-4">
        Spend Over Time
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
              <stop offset="70%" stopColor="#34d399" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: "#52525b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#52525b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid rgba(63, 63, 70, 0.5)",
              borderRadius: 6,
              fontSize: 11,
              color: "#d4d4d8",
            }}
            formatter={(value: number) => [`${value.toFixed(2)} SOL`, "Spend"]}
          />
          {threshold && (
            <ReferenceLine
              y={threshold}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `Limit: ${threshold} SOL/hr`,
                position: "right",
                fill: "#f59e0b",
                fontSize: 9,
                opacity: 0.7,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="sol"
            stroke="#34d399"
            fill="url(#spendGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
