"use client";
import { useEffect, useState } from "react";
import { FileText, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

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

export default function JournalPage() {
  const [decisions, setDecisions] = useState<DecisionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/data/decisions.json")
      .then((r) => r.json())
      .then(setDecisions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading journal...</div>;

  // Group by decision type for summary
  const copied = decisions.filter((d) => d.decision === "paper_copy");
  const watched = decisions.filter((d) => d.decision === "watchlist");
  const skipped = decisions.filter((d) => d.decision === "skip");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📓 Decision Journal</h1>
        <p className="text-zinc-500 mt-1">Every copy/watchlist/skip decision explained</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wide font-semibold">Copied</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{copied.length}</div>
          <div className="text-xs text-emerald-500/60 mt-1">paper_copy decisions</div>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <div className="text-xs text-yellow-400 uppercase tracking-wide font-semibold">Watching</div>
          <div className="text-2xl font-bold text-yellow-300 mt-1">{watched.length}</div>
          <div className="text-xs text-yellow-500/60 mt-1">watchlist decisions</div>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="text-xs text-red-400 uppercase tracking-wide font-semibold">Skipped</div>
          <div className="text-2xl font-bold text-red-300 mt-1">{skipped.length}</div>
          <div className="text-xs text-red-500/60 mt-1">skip decisions</div>
        </div>
      </div>

      {/* Decision List */}
      <div className="space-y-3">
        {decisions.map((d) => (
          <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            {/* Header - clickable */}
            <button
              onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
              className="w-full p-4 flex justify-between items-start text-left hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                    d.decision === "paper_copy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    d.decision === "watchlist" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                    "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {d.decision.replace("_", " ").toUpperCase()}
                  </span>
                  <span className="text-xs text-zinc-500">
                    Score: {(d.copyScore * 100).toFixed(1)} · Confidence: {(d.confidence * 100).toFixed(1)}%
                  </span>
                  {d.simulatedPositionSize !== null && (
                    <span className="text-xs text-emerald-400 font-mono">${d.simulatedPositionSize.toFixed(2)}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-zinc-200 truncate">{d.marketQuestion}</p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Wallet: {d.walletAddress.slice(0, 10)}... · {new Date(d.createdAt).toLocaleString()}
                </p>
              </div>
              {expandedId === d.id ? (
                <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 ml-2" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 ml-2" />
              )}
            </button>

            {/* Expanded Content */}
            {expandedId === d.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                {/* Sub-scores Grid */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Scoring Breakdown</h4>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                    <ScoreBadge label="Wallet Quality" value={d.walletQualityScore} />
                    <ScoreBadge label="ROI" value={d.roiScore} />
                    <ScoreBadge label="Consistency" value={d.consistencyScore} />
                    <ScoreBadge label="Copyability" value={d.copyabilityScore} />
                    <ScoreBadge label="Category Fit" value={d.categoryFitScore} />
                    <ScoreBadge label="Entry Timing" value={d.entryTimingScore} />
                    <ScoreBadge label="Spread" value={d.spreadScore} />
                    <ScoreBadge label="Liquidity" value={d.liquidityScore} />
                    <ScoreBadge label="Thesis" value={d.thesisScore} />
                  </div>
                </div>

                {/* Reasons */}
                {d.reasons.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">
                      ✅ Reasons
                    </h4>
                    <ul className="space-y-0.5">
                      {d.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-zinc-400 flex items-start gap-1">
                          <span className="text-emerald-500 mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risks */}
                {d.risks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">
                      ⚠️ Risks
                    </h4>
                    <ul className="space-y-0.5">
                      {d.risks.map((r, i) => (
                        <li key={i} className="text-xs text-zinc-400 flex items-start gap-1">
                          <span className="text-red-500 mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {decisions.length === 0 && (
          <div className="text-center text-zinc-600 py-8">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No decisions yet. Run <code className="text-emerald-400">npm run compute</code>.
          </div>
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
      <span className={`font-mono ${color}`}>{v.toFixed(0)}</span>
    </div>
  );
}
