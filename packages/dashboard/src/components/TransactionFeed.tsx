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

function TxRow({ tx, onClick }: { tx: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-zinc-800/30 cursor-pointer transition-colors duration-150",
        tx.status === "blocked" && "bg-red-950/20"
      )}
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
          <p className={cn(
            "text-[11px] font-mono",
            tx.status === "blocked" ? "text-red-400/80" : "text-zinc-400"
          )}>
            {tx.estimated_sol.toFixed(4)}
          </p>
        )}
      </div>
    </div>
  );
}

function fetchBoth(agentId?: string) {
  return Promise.all([
    api.transactions.list({ agentId, status: "blocked", limit: 50 }),
    api.transactions.list({ agentId, limit: 30 }),
  ]);
}

export function TransactionFeed({ agentId, tick }: { agentId?: string; tick: number }) {
  const [blocked, setBlocked] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    fetchBoth(agentId).then(([b, r]) => {
      setBlocked(b);
      setRecent(r.filter((tx: any) => tx.status !== "blocked"));
    });
  }, [agentId, tick]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchBoth(agentId).then(([b, r]) => {
        setBlocked(b);
        setRecent(r.filter((tx: any) => tx.status !== "blocked"));
      });
    }, 5000);
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
        {blocked.length === 0 && recent.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-600">No transactions yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {blocked.length > 0 && (
              <>
                <div className="px-4 py-1.5 bg-red-950/30 border-b border-red-900/20">
                  <span className="text-[9px] text-red-400/70 uppercase tracking-widest font-semibold">
                    Blocked — {blocked.length} intercepted
                  </span>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  {blocked.map((tx) => (
                    <TxRow key={tx.signature} tx={tx} onClick={() => setSelected(tx)} />
                  ))}
                </div>
                {recent.length > 0 && (
                  <div className="px-4 py-1.5 bg-zinc-900/80 border-y border-zinc-800/30">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">
                      Confirmed
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="divide-y divide-zinc-800/30">
              {recent.map((tx) => (
                <TxRow key={tx.signature} tx={tx} onClick={() => setSelected(tx)} />
              ))}
            </div>
          </div>
        )}
      </div>
      {selected && (
        <TransactionDetail tx={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
