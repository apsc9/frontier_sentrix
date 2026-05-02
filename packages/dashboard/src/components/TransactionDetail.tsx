import { useEffect } from "react";
import { cn } from "../lib/cn";
import { PROGRAM_NAMES } from "../lib/programs";

const statusStyles: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-400",
  sent: "bg-amber-500/15 text-amber-400",
  blocked: "bg-red-500/15 text-red-400",
};

interface TransactionDetailProps {
  tx: any;
  onClose: () => void;
}

export function TransactionDetail({ tx, onClose }: TransactionDetailProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800/80 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center justify-between">
          <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            Transaction Detail
          </h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-lg leading-none transition-colors">
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Signature</label>
            <p className="text-[11px] font-mono text-zinc-300 mt-1 break-all select-all">{tx.signature}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Status</label>
              <div className="mt-1">
                <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", statusStyles[tx.status] ?? "bg-zinc-800 text-zinc-400")}>
                  {tx.status}
                </span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Amount</label>
              <p className="text-lg font-bold font-mono text-zinc-100 mt-1">
                {tx.estimated_sol?.toFixed(4)} <span className="text-sm text-zinc-500">SOL</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Agent</label>
              <p className="text-[11px] font-mono text-zinc-300 mt-1">{tx.agent_id}</p>
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Time</label>
              <p className="text-[11px] text-zinc-300 mt-1">{new Date(tx.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
              Programs ({tx.program_ids?.length ?? 0})
            </label>
            <div className="mt-2 space-y-1">
              {(tx.program_ids ?? []).map((id: string) => {
                const known = PROGRAM_NAMES[id];
                return (
                  <div key={id} className="flex items-center gap-2 bg-zinc-800/50 rounded-md px-3 py-2">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      known ? "bg-emerald-400" : "bg-amber-400"
                    )} />
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-300">{known ?? "Unknown Program"}</p>
                      <p className="text-[10px] font-mono text-zinc-600 truncate">{id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {tx.status === "blocked" && (
            <div className="bg-red-950/30 border border-red-500/20 rounded-md px-4 py-3">
              <p className="text-[11px] text-red-400 font-medium">Transaction Blocked</p>
              <p className="text-[10px] text-red-400/60 mt-1">
                Intercepted by Sentrix guardrails before reaching the chain.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
