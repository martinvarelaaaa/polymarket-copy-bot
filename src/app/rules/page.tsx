"use client";
import { useEffect, useState } from "react";

export default function RulesPage() {
  const [data, setData] = useState<{ sets: any[]; changes: any[] }>({ sets: [], changes: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading rules...</div>;

  const activeSet = data.sets.find((s: any) => s.active);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚙️ Rules</h1>

      {activeSet && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-3">
            Active Rule Set — v{activeSet.version}
          </h2>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap overflow-auto max-h-96">
            {JSON.stringify(JSON.parse(activeSet.rulesJson), null, 2)}
          </pre>
        </div>
      )}

      <h2 className="text-lg font-semibold mt-6">Rule Change History</h2>
      <div className="space-y-2">
        {data.changes.map((c: any) => (
          <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>v{c.oldRuleSetId} → v{c.newRuleSetId}</span>
              <span className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="text-zinc-300 mt-1">{c.reason}</div>
            {c.expectedImprovement && (
              <div className="text-emerald-400 text-xs mt-1">Expected: {c.expectedImprovement}</div>
            )}
          </div>
        ))}
        {data.changes.length === 0 && (
          <div className="text-zinc-600 py-4">No rule changes yet.</div>
        )}
      </div>
    </div>
  );
}
