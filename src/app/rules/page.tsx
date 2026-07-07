"use client";
import { useEffect, useState } from "react";
import { ScrollText, GitBranch, ArrowRight, Clock } from "lucide-react";

interface RuleSetData {
  version: number;
  active: boolean;
  rules: Record<string, unknown>;
  createdAt: string;
}

interface RuleChangeData {
  id: number;
  oldVersion: number;
  newVersion: number;
  changedBy: string;
  reason: string;
  evidenceSummary: string;
  expectedImprovement: string;
  createdAt: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<RuleSetData | null>(null);
  const [changes, setChanges] = useState<RuleChangeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/data/rules.json").then((r) => r.json()),
      fetch("/data/rule-changes.json").then((r) => r.json()),
    ])
      .then(([r, c]) => {
        setRules(r);
        setChanges(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading rules...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚙️ Trading Rules</h1>

      {/* Active Rules */}
      {rules && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-emerald-400" />
              <h2 className="font-semibold">Active Rule Set</h2>
              <span className="text-sm text-zinc-500">v{rules.version}</span>
            </div>
            {rules.active && (
              <span className="text-xs px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                ACTIVE
              </span>
            )}
          </div>
          <div className="p-4 space-y-4">
            {/* Scoring Rules */}
            {rules.rules.scoring && (
              <RulesSection
                title="Scoring Weights"
                items={(rules.rules.scoring as Record<string, unknown>)}
              />
            )}

            {/* Trade Scoring Rules */}
            {rules.rules.trade_scoring && (
              <RulesSection
                title="Trade Scoring Thresholds"
                items={(rules.rules.trade_scoring as Record<string, unknown>)}
              />
            )}

            {/* Paper Trading Rules */}
            {rules.rules.paper_trading && (
              <RulesSection
                title="Paper Trading Config"
                items={(rules.rules.paper_trading as Record<string, unknown>)}
              />
            )}

            <div className="text-xs text-zinc-600 mt-2">
              Created: {new Date(rules.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Rule Change History */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-zinc-400" />
          Rule Change History
          <span className="text-xs text-zinc-600 font-normal">({changes.length} changes)</span>
        </h2>

        {changes.length > 0 ? (
          <div className="space-y-3">
            {changes.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((c) => (
              <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <span className="font-mono text-zinc-500">v{c.oldVersion}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                  <span className="font-mono text-emerald-400">v{c.newVersion}</span>
                  <span className="text-xs text-zinc-600 ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-sm text-zinc-300 font-medium">{c.reason}</div>

                {c.evidenceSummary && (
                  <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-400">
                    <span className="text-zinc-500 font-semibold">Evidence: </span>
                    {c.evidenceSummary}
                  </div>
                )}

                {c.expectedImprovement && (
                  <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                    <span className="text-emerald-600">↑</span>
                    {c.expectedImprovement}
                  </div>
                )}

                <div className="mt-1 text-xs text-zinc-700">Changed by: {c.changedBy}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-zinc-600 py-8">
            No rule changes recorded yet. Rules evolve automatically as the system learns from paper trading performance.
          </div>
        )}
      </div>
    </div>
  );
}

function RulesSection({
  title,
  items,
}: {
  title: string;
  items: Record<string, unknown>;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(items).map(([key, value]) => (
          <div key={key} className="bg-zinc-800/50 rounded px-3 py-2">
            <div className="text-xs text-zinc-500 mb-0.5 break-words">
              {key.replace(/_/g, " ")}
            </div>
            <div className="font-mono text-sm text-zinc-200">
              {typeof value === "number" && value < 1 && value > 0
                ? `${(value * 100).toFixed(0)}%`
                : typeof value === "object"
                ? JSON.stringify(value)
                : String(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
