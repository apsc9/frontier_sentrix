import { useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { PROGRAM_NAMES } from "../lib/programs";

interface GuardrailsConfigProps {
  agent: any;
  onSave: () => void;
}

export function GuardrailsConfig({ agent, onSave }: GuardrailsConfigProps) {
  const config = agent.config ?? {};
  const [maxSpend, setMaxSpend] = useState(String(config.maxSpendPerTx ?? 0.5));
  const [hourlyLimit, setHourlyLimit] = useState(String(config.hourlySpendLimit ?? 5));
  const [programs, setPrograms] = useState((config.allowedPrograms ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.agents.updateConfig(agent.id, {
        ...config,
        maxSpendPerTx: parseFloat(maxSpend),
        hourlySpendLimit: parseFloat(hourlyLimit),
        allowedPrograms: programs.split("\n").map((s: string) => s.trim()).filter(Boolean),
      });
      onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const programList = programs.split("\n").map((s: string) => s.trim()).filter(Boolean);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-fade-up max-w-xl">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-4">
        Guardrails Config
      </h3>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1 font-medium">
              Max per tx (SOL)
            </label>
            <input
              type="number"
              step="0.01"
              value={maxSpend}
              onChange={(e) => setMaxSpend(e.target.value)}
              className="w-full bg-zinc-800/50 px-3 py-2 rounded-md border border-zinc-700/50 text-sm font-mono text-zinc-200 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1 font-medium">
              Hourly limit (SOL)
            </label>
            <input
              type="number"
              step="0.1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              className="w-full bg-zinc-800/50 px-3 py-2 rounded-md border border-zinc-700/50 text-sm font-mono text-zinc-200 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-zinc-500 block mb-1 font-medium">
            Allowed Programs
          </label>
          {programList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {programList.map((id: string) => (
                <span key={id} className="text-[9px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                  {PROGRAM_NAMES[id] ?? `${id.slice(0, 8)}…`}
                </span>
              ))}
            </div>
          )}
          <textarea
            value={programs}
            onChange={(e) => setPrograms(e.target.value)}
            rows={3}
            className="w-full bg-zinc-800/50 px-3 py-2 rounded-md border border-zinc-700/50 text-[11px] font-mono text-zinc-300 focus:border-brand-500 focus:outline-none resize-none transition-colors"
            placeholder="Program ID per line"
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={cn(
          "mt-4 w-full text-sm font-medium py-2 rounded-md transition-all duration-300 border",
          saved
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : "bg-brand-600/20 text-brand-400 border-brand-500/30 hover:bg-brand-600/30",
          saving && "opacity-50 cursor-not-allowed"
        )}
      >
        {saved ? "✓ Saved" : saving ? "Saving..." : "Save Config"}
      </button>
    </div>
  );
}
