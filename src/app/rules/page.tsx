"use client";
import { useEffect, useState } from "react";

interface RuleSet { version: number; active: boolean; rules: Record<string, unknown>; createdAt: string; }
interface RuleChange { id: number; oldVersion: number; newVersion: number; reason: string; evidenceSummary: string; expectedImprovement: string; createdAt: string; }

export default function RulesPage() {
  const [rules, setRules] = useState<RuleSet | null>(null);
  const [changes, setChanges] = useState<RuleChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/data/rules.json").then(r => r.json()),
      fetch("/data/rule-changes.json").then(r => r.json())
    ]).then(([r, c]) => { setRules(r); setChanges(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading rules...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Active Rules</h1>
      {rules && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">v{rules.version}</h2>
            <span className="text-xs px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">ACTIVE</span>
          </div>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap overflow-auto max-h-96">
            {JSON.stringify(rules.rules, null, 2)}
          </pre>
        </div>
      )}

      <h2 className="text-lg font-semibold mt-6">Rule Change History</h2>
      <div className="space-y-2">
        {changes.map((c) => (
          <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>v{c.oldVersion} → v{c.newVersion}</span>
              <span className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="text-zinc-300 mt-1">{c.reason}</div>
            {c.expectedImprovement && <div className="text-emerald-400 text-xs mt-1">Expected: {c.expectedImprovement}</div>}
          </div>
        ))}
        {changes.length === 0 && <div className="text-zinc-600 py-4">No rule changes yet.</div>}
      </div>
    </div>
  );
}
