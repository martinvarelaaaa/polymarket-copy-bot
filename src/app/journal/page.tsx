"use client";
import { useEffect, useState } from "react";

export default function JournalPage() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/decisions")
      .then((r) => r.json())
      .then(setDecisions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading journal...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📓 Decision Journal</h1>
        <p className="text-zinc-500 mt-1">Every copy/watchlist/skip decision explained</p>
      </div>
      <div className="space-y-3">
        {decisions.map((d: any) => (
          <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded border ${
                  d.decision === "paper_copy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  d.decision === "watchlist" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                  "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {d.decision?.replace("_", " ").toUpperCase()}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  Score: {(d.copyScore * 100).toFixed(1)} | Confidence: {(d.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <span className="text-xs text-zinc-600">{new Date(d.createdAt).toLocaleDateString()}</span>
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-3 text-xs">
              <ScoreBadge label="Wallet Quality" value={d.walletQualityScore} />
              <ScoreBadge label="ROI" value={d.roiScore} />
              <ScoreBadge label="Consistency" value={d.consistencyScore} />
              <ScoreBadge label="Copyability" value={d.copyabilityScore} />
              <ScoreBadge label="Category Fit" value={d.categoryFitScore} />
              <ScoreBadge label="Entry Timing" value={d.entryTimingScore} />
              <ScoreBadge label="Spread" value={d.spreadScore} />
              <ScoreBadge label="Liquidity" value={d.liquidityScore} />
            </div>

            {d.reasonsJson && (
              <details className="text-xs">
                <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300">Reasons</summary>
                <pre className="mt-1 text-zinc-400 whitespace-pre-wrap">{d.reasonsJson}</pre>
              </details>
            )}
            {d.risksJson && (
              <details className="text-xs mt-1">
                <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300">Risks</summary>
                <pre className="mt-1 text-zinc-400 whitespace-pre-wrap">{d.risksJson}</pre>
              </details>
            )}
          </div>
        ))}
        {decisions.length === 0 && (
          <div className="text-center text-zinc-600 py-8">No decisions yet.</div>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const v = (value || 0) * 100;
  const color = v >= 70 ? "text-emerald-400" : v >= 40 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="bg-zinc-800/50 rounded px-2 py-1">
      <span className="text-zinc-500">{label}: </span>
      <span className={color}>{v.toFixed(0)}</span>
    </div>
  );
}
