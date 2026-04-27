import { useState } from "react";
import { api } from "../lib/api";

interface GuardrailsConfigProps {
  agent: any;
  onSave: () => void;
}

export function GuardrailsConfig({ agent, onSave }: GuardrailsConfigProps) {
  const config = agent.config ?? {};
  const [maxSpend, setMaxSpend] = useState(
    String(config.maxSpendPerTx ?? 0.5)
  );
  const [hourlyLimit, setHourlyLimit] = useState(
    String(config.hourlySpendLimit ?? 5)
  );
  const [programs, setPrograms] = useState(
    (config.allowedPrograms ?? []).join("\n")
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.agents.updateConfig(agent.id, {
        ...config,
        maxSpendPerTx: parseFloat(maxSpend),
        hourlySpendLimit: parseFloat(hourlyLimit),
        allowedPrograms: programs
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-raised rounded-xl p-4 border border-white/5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">
        Guardrails Config
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Max spend per tx (SOL)
          </label>
          <input
            type="number"
            step="0.01"
            value={maxSpend}
            onChange={(e) => setMaxSpend(e.target.value)}
            className="w-full bg-surface px-3 py-2 rounded-lg border border-white/10 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Hourly spend limit (SOL)
          </label>
          <input
            type="number"
            step="0.1"
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(e.target.value)}
            className="w-full bg-surface px-3 py-2 rounded-lg border border-white/10 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Allowed programs (one per line)
          </label>
          <textarea
            value={programs}
            onChange={(e) => setPrograms(e.target.value)}
            rows={4}
            className="w-full bg-surface px-3 py-2 rounded-lg border border-white/10 text-sm font-mono focus:border-brand-500 focus:outline-none resize-none"
            placeholder="11111111111111111111111111111111"
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Config"}
      </button>
    </div>
  );
}
