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
import { cn } from "./lib/cn";

export default function App() {
  const { agents, refresh } = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onWsMessage = useCallback(
    (msg: any) => {
      if (
        msg.type === "agent_registered" ||
        msg.type === "kill_switch" ||
        msg.type === "config_update"
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
          <h1 className="text-lg font-bold tracking-tight">Sentrix</h1>
          <span className="text-xs text-gray-500 bg-surface-raised px-2 py-0.5 rounded">
            AI Agent Observability
          </span>
        </div>
        <div className="flex items-center gap-3">
          {selected && <KillSwitch agent={selected} onToggle={refresh} />}
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              connected ? "bg-success" : "bg-danger"
            )}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
      </header>

      <div className="flex">
        <aside className="w-72 border-r border-white/5 p-4 space-y-2 min-h-[calc(100vh-57px)]">
          <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Agents
          </h2>
          {agents.length === 0 && (
            <p className="text-sm text-gray-600">No agents registered</p>
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
            {selected && (
              <GuardrailsConfig agent={selected} onSave={refresh} />
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TransactionFeed agentId={selectedId ?? undefined} />
            <EventLog agentId={selectedId ?? undefined} />
          </div>
        </main>
      </div>
    </div>
  );
}
