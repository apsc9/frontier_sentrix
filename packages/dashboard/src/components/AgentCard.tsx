import { cn } from "../lib/cn";

interface AgentCardProps {
  agent: any;
  selected: boolean;
  onSelect: () => void;
}

export function AgentCard({ agent, selected, onSelect }: AgentCardProps) {
  const isKilled = agent.status === "killed";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left bg-surface-raised rounded-xl p-4 border transition-colors",
        selected
          ? "border-brand-500"
          : "border-white/5 hover:border-white/10"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isKilled ? "bg-danger" : "bg-success"
            )}
          />
          <span className="font-mono text-sm truncate">{agent.id}</span>
        </div>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            isKilled
              ? "bg-danger/20 text-danger"
              : "bg-success/20 text-success"
          )}
        >
          {agent.status}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-2 font-mono truncate">
        {agent.pubkey}
      </p>
    </button>
  );
}
