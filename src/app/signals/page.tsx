"use client";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface DecisionData {
  id: number;
  walletAddress: string;
  marketId: string;
  marketQuestion: string;
  decision: "paper_copy" | "watchlist" | "skip";
  copyScore: number;
  confidence: number;
  reasons: string[];
  risks: string[];
  walletQualityScore: number;
  roiScore: number;
  consistencyScore: number;
  copyabilityScore: number;
  categoryFitScore: number;
  entryTimingScore: number;
  spreadScore: number;
  liquidityScore: number;
  thesisScore: number;
  simulatedPositionSize: number | null;
  createdAt: string;
}

export default function SignalsPage() {
  const [decisions, setDecisions] = useState<DecisionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paper_copy" | "watchlist" | "skip">("all");

  useEffect(() => {
    fetch("/data/decisions.json")
      .then((r) => r.json())
      .then(setDecisions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading signals...</div>;

  const filtered = filter === "all" ? decisions : decisions.filter((d) => d.decision === filter);
  const counts = {
    paper_copy: decisions.filter((d) => d.decision === "paper_copy").length,
    watchlist: decisions.filter((d) => d.decision === "watchlist").length,
    skip: decisions.filter((d) => d.decision === "skip").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📡 Trade Signals</h1>
        <p className="text-zinc-500 mt-1">{decisions.length} decisions recorded</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {(["all", "paper_copy", "watchlist", "skip"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f
                ? [
                    "bg-zinc-800 border-zinc-600 text-zinc-100",
                    "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                    "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
                    "bg-red-500/10 border-red-500/30 text-red-400",
                  ][["all", "paper_copy", "watchlist", "skip"].indexOf(f)]
                : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f === "all" ? "All" : f.replace("_", " ").toUpperCase()}
            {f !== "all" && <span className="ml-1 opacity-50">({counts[f]})</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.map((d) => (
          <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${
                d.decision === "paper_copy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                d.decision === "watchlist" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{d.decision.replace("_", " ").toUpperCase()}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-zinc-500">
                  Score: <span className="font-mono text-zinc-300">{(d.copyScore * 100).toFixed(1)}</span>
                </span>
                <span className="text-zinc-500">
                  Conf: <span className="font-mono text-zinc-300">{(d.confidence * 100).toFixed(1)}%</span>
                </span>
                {d.simulatedPositionSize && (
                  <span className="text-emerald-400 font-mono">${d.simulatedPositionSize.toFixed(2)}</span>
                )}
              </div>
            </div>

            {/* Market Question */}
            <p className="text-sm font-medium text-zinc-200 mb-1">{d.marketQuestion}</p>

            <div className="text-xs text-zinc-500 font-mono mb-2">
              Wallet: {d.walletAddress.slice(0, 10)}... · Market: {d.marketId.slice(0, 12)}...
            </div>

            {/* Reasons & Risks */}
            <div className="space-y-1 mb-3">
              {d.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.reasons.map((r, i) => (
                    <span key={i} className="text-xs bg-emerald-500/5 text-emerald-400/80 px-1.5 py-0.5 rounded">
                      {r}
                    </span>
                  ))}
                </div>
              )}
              {d.risks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.risks.map((r, i) => (
                    <span key={i} className="text-xs bg-red-500/5 text-red-400/80 px-1.5 py-0.5 rounded">
                      ⚠ {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-scores */}
            <div className="flex gap-3 flex-wrap text-xs text-zinc-600">
              <ScoreBadge label="Wallet" value={d.walletQualityScore} />
              <ScoreBadge label="ROI" value={d.roiScore} />
              <ScoreBadge label="Consistency" value={d.consistencyScore} />
              <ScoreBadge label="Copyability" value={d.copyabilityScore} />
              <ScoreBadge label="Category" value={d.categoryFitScore} />
              <ScoreBadge label="Timing" value={d.entryTimingScore} />
              <ScoreBadge label="Spread" value={d.spreadScore} />
              <ScoreBadge label="Liquidity" value={d.liquidityScore} />
              <ScoreBadge label="Thesis" value={d.thesisScore} />
            </div>

            <div className="text-xs text-zinc-700 mt-2">
              {new Date(d.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-zinc-600 py-8">
            No signals yet. Run <code className="text-emerald-400">npm run compute</code>.
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const v = (value || 0) * 100;
  const color =
    v >= 70 ? "text-emerald-400" :
    v >= 40 ? "text-yellow-400" :
    "text-red-400";
  return (
    <span className="font-mono">
      {label}: <span className={color}>{v.toFixed(0)}</span>
    </span>
  );
}
