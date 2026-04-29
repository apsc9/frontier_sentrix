import { useState, useCallback } from "react";
import { useAgents } from "./hooks/useAgents";
import { useWebSocket } from "./hooks/useWebSocket";
import { StatsBar } from "./components/StatsBar";
import { AgentCard } from "./components/AgentCard";
import { TransactionFeed } from "./components/TransactionFeed";
import { SpendChart } from "./components/SpendChart";
import { KillSwitch } from "./components/KillSwitch";
import { EventLog } from "./components/EventLog";
import { GuardrailsConfig } from "./components/GuardrailsConfig";
import { AnomalyPanel } from "./components/AnomalyPanel";
import { cn } from "./lib/cn";

export default function App() {
  const { agents, refresh } = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onWsMessage = useCallback(
    (msg: any) => {
      if (
        msg.type === "agent_registered" ||
        msg.type === "kill_switch" ||
        msg.type === "config_update" ||
        msg.type === "anomaly"
      ) {
        refresh();
      }
    },
    [refresh]
  );

  const { connected } = useWebSocket(onWsMessage);

  const selected = agents.find((a) => a.id === selectedId);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Sentrix</h1>
          </div>
          <span className="text-[10px] text-gray-500 bg-surface-raised px-2 py-0.5 rounded font-medium uppercase tracking-wider">
            Agent Observability
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded font-medium">
            Devnet
          </span>
        </div>
        <div className="flex items-center gap-4">
          {selected && <KillSwitch agent={selected} onToggle={refresh} />}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                connected ? "bg-success animate-pulse" : "bg-danger"
              )}
            />
            <span className="text-[10px] text-gray-500">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-72 border-r border-white/5 p-4 space-y-2 min-h-[calc(100vh-57px)] bg-surface">
          <h2 className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-3">
            Monitored Agents
          </h2>
          {agents.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">No agents registered</p>
              <p className="text-xs text-gray-700 mt-1">Integrate the SDK to get started</p>
            </div>
          )}
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedId}
              onSelect={() => setSelectedId(agent.id)}
            />
          ))}
        </aside>

        <main className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-57px)]">
          <StatsBar agentId={selectedId ?? undefined} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SpendChart agentId={selectedId ?? undefined} />
            <AnomalyPanel agentId={selectedId ?? undefined} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TransactionFeed agentId={selectedId ?? undefined} />
            <EventLog agentId={selectedId ?? undefined} />
          </div>

          {selected && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <GuardrailsConfig agent={selected} onSave={refresh} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
