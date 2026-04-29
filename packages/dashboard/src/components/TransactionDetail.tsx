import { cn } from "../lib/cn";

const statusStyles: Record<string, string> = {
  confirmed: "bg-success/20 text-success",
  sent: "bg-yellow-500/20 text-yellow-400",
  blocked: "bg-danger/20 text-danger",
};

const PROGRAM_NAMES: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token Program",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "Token 2022",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": "Associated Token",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter v6",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM",
  "MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky": "Marinade",
  "ComputeBudget111111111111111111111111111111": "Compute Budget",
};

interface TransactionDetailProps {
  tx: any;
  onClose: () => void;
}

export function TransactionDetail({ tx, onClose }: TransactionDetailProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-raised rounded-2xl border border-white/10 w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Transaction Detail</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Signature</label>
            <p className="text-xs font-mono text-gray-300 mt-1 break-all">{tx.signature}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Status</label>
              <div className="mt-1">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusStyles[tx.status] ?? "bg-white/10 text-gray-400")}>
                  {tx.status}
                </span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Amount</label>
              <p className="text-sm font-bold text-white mt-1">{tx.estimated_sol?.toFixed(4)} SOL</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Agent</label>
              <p className="text-xs font-mono text-gray-300 mt-1">{tx.agent_id}</p>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Time</label>
              <p className="text-xs text-gray-300 mt-1">{new Date(tx.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">
              Programs ({tx.program_ids?.length ?? 0})
            </label>
            <div className="mt-2 space-y-1.5">
              {(tx.program_ids ?? []).map((id: string) => (
                <div key={id} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    PROGRAM_NAMES[id] ? "bg-success" : "bg-warning"
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-300">
                      {PROGRAM_NAMES[id] ?? "Unknown Program"}
                    </p>
                    <p className="text-[10px] font-mono text-gray-600 truncate">{id}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {tx.status === "blocked" && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg px-4 py-3">
              <p className="text-xs text-danger font-medium">Transaction Blocked</p>
              <p className="text-[10px] text-danger/70 mt-1">
                This transaction was intercepted by Sentrix guardrails before reaching the chain.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
