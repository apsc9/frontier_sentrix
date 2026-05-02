import { cn } from "../lib/cn";

const agentIcons: Record<string, string> = {
  "jupiter-swap-bot": "⟁",
  "dca-accumulator": "◈",
  "arb-scanner-v3": "⬡",
};

const statusConfig = {
  active: { label: "Active", bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  killed: { label: "Killed", bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
  paused: { label: "Paused", bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
};

interface AgentCardProps {
  agent: any;
  selected: boolean;
  onSelect: () => void;
  index: number;
}

export function AgentCard({ agent, selected, onSelect, index }: AgentCardProps) {
  const status = statusConfig[agent.status as keyof typeof statusConfig] ?? statusConfig.active;
  const icon = agentIcons[agent.id] ?? "◆";

  return (
    <button
      onClick={onSelect}
      style={{ animationDelay: `${index * 75}ms` }}
      className={cn(
        "w-full text-left rounded-lg p-3 border transition-all duration-150 animate-fade-up group",
        selected
          ? "bg-zinc-800/60 border-brand-500/50"
          : "bg-transparent border-transparent hover:bg-zinc-800/30 hover:border-zinc-700/50"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg leading-none opacity-50 group-hover:opacity-80 transition-opacity">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm text-zinc-200 truncate">{agent.id}</span>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.dot)} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium",
              status.bg, status.text
            )}>
              {status.label}
            </span>
            <span className="text-[10px] text-zinc-600 font-mono truncate">
              {agent.pubkey?.slice(0, 8)}...{agent.pubkey?.slice(-4)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
