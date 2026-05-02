import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";

function AnimatedNumber({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    prev.current = to;

    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}

export function StatsBar({ agentId, tick }: { agentId?: string; tick: number }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.transactions.stats(agentId).then(setStats);
  }, [agentId, tick]);

  useEffect(() => {
    const interval = setInterval(
      () => api.transactions.stats(agentId).then(setStats),
      5000
    );
    return () => clearInterval(interval);
  }, [agentId]);

  if (!stats) {
    return (
      <div className="flex gap-4 animate-fade-up">
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-20 mb-2" />
          <div className="h-6 bg-zinc-800 rounded w-12" />
        </div>
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-20 mb-2" />
          <div className="h-6 bg-zinc-800 rounded w-12" />
        </div>
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-20 mb-2" />
          <div className="h-6 bg-zinc-800 rounded w-12" />
        </div>
        <div className="flex-[1.5] bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-24 mb-2" />
          <div className="h-8 bg-zinc-800 rounded w-20" />
        </div>
      </div>
    );
  }

  const hasSaved = stats.savedSpendSol > 0;

  return (
    <div className="flex gap-4 animate-fade-up">
      <div className="flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
          Transactions
        </p>
        <p className="text-xl font-bold font-mono text-zinc-100 mt-1">
          {stats.totalTransactions.toLocaleString()}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">last 24h</p>
      </div>

      <div className="flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
          Blocked
        </p>
        <p className={cn(
          "text-xl font-bold font-mono mt-1",
          stats.blockedTransactions > 0 ? "text-danger" : "text-zinc-400"
        )}>
          {stats.blockedTransactions.toLocaleString()}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">intercepted</p>
      </div>

      <div className="flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
          Total Spend
        </p>
        <p className="text-xl font-bold font-mono text-zinc-100 mt-1">
          {stats.totalSpendSol.toFixed(2)}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">SOL</p>
      </div>

      <div className={cn(
        "flex-[1.5] rounded-lg p-3 border transition-all duration-500",
        hasSaved
          ? "bg-emerald-950/30 border-emerald-500/30"
          : "bg-zinc-900/50 border-zinc-800/50"
      )}>
        <p className="text-[10px] text-emerald-400/80 uppercase tracking-widest font-semibold">
          Saved by Sentrix
        </p>
        <p className={cn(
          "font-bold font-mono mt-1 transition-colors",
          hasSaved ? "text-3xl text-emerald-400" : "text-xl text-zinc-400"
        )}>
          <AnimatedNumber value={stats.savedSpendSol} />
          <span className="text-lg ml-1 text-emerald-400/60">SOL</span>
        </p>
        {hasSaved && (
          <p className="text-[10px] text-emerald-500/50 mt-0.5">
            {stats.blockedTransactions} threats neutralized
          </p>
        )}
      </div>
    </div>
  );
}
