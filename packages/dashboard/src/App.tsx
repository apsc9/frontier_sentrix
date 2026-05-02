import { useState, useCallback, useEffect } from "react";
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
  const [threatPulse, setThreatPulse] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (agents.length > 0 && !selectedId) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

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
      if (msg.type === "event" || msg.type === "anomaly" || msg.type === "kill_switch") {
        setRefreshTick((t) => t + 1);
      }
      if (msg.type === "anomaly" && msg.data?.severity === "CRITICAL") {
        setThreatPulse(true);
        setTimeout(() => setThreatPulse(false), 1500);
      }
    },
    [refresh]
  );

  const { connected } = useWebSocket(onWsMessage);

  const selected = agents.find((a) => a.id === selectedId);
  const hasKilledAgent = agents.some((a) => a.status === "killed");

  return (
    <div className="min-h-screen bg-surface text-zinc-100">
      {/* Top accent gradient */}
      <div className={cn(
        "h-[2px] transition-all duration-700",
        hasKilledAgent
          ? "bg-gradient-to-r from-red-500 via-red-400 to-red-500"
          : "bg-gradient-to-r from-emerald-500/80 via-brand-400 to-emerald-500/80"
      )} />

      {/* Threat pulse overlay */}
      {threatPulse && (
        <div className="fixed inset-0 bg-red-500/10 animate-threat-pulse z-40 pointer-events-none" />
      )}

      <header className={cn(
        "border-b border-zinc-800/50 px-6 py-3 flex items-center justify-between transition-colors duration-700",
        hasKilledAgent && "bg-red-950/20"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight">Sentrix</h1>
          <span className="text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded font-medium uppercase tracking-widest">
            Observability
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
                connected ? "bg-emerald-400 animate-heartbeat" : "bg-danger"
              )}
            />
            <span className="text-[10px] text-zinc-500">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 border-r border-zinc-800/50 p-3 space-y-1.5 min-h-[calc(100vh-49px)] bg-surface">
          <h2 className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-3 px-1">
            Monitored Agents
          </h2>
          {agents.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-600">No agents registered</p>
              <p className="text-xs text-zinc-700 mt-1">Integrate SDK to start</p>
            </div>
          )}
          {agents.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedId}
              onSelect={() => setSelectedId(agent.id)}
              index={i}
            />
          ))}
        </aside>

        <main className="flex-1 p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-49px)]">
          <StatsBar agentId={selectedId ?? undefined} tick={refreshTick} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <SpendChart agentId={selectedId ?? undefined} tick={refreshTick} selectedAgent={selected} />
            <AnomalyPanel agentId={selectedId ?? undefined} tick={refreshTick} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <TransactionFeed agentId={selectedId ?? undefined} tick={refreshTick} />
            <EventLog agentId={selectedId ?? undefined} tick={refreshTick} />
          </div>

          {selected && (
            <GuardrailsConfig key={selected.id} agent={selected} onSave={refresh} />
          )}
        </main>
      </div>
    </div>
  );
}
