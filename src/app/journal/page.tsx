"use client";
import { useEffect, useState } from "react";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";

interface DecisionData {
  id: number; walletAddress: string; marketId: string; marketQuestion: string;
  decision: "paper_copy" | "watchlist" | "skip"; copyScore: number; confidence: number;
  reasons: string[]; risks: string[]; walletQualityScore: number; roiScore: number;
  consistencyScore: number; copyabilityScore: number; categoryFitScore: number;
  entryTimingScore: number; spreadScore: number; liquidityScore: number; thesisScore: number;
  simulatedPositionSize: number | null; createdAt: string;
}

export default function JournalPage() {
  const [decisions, setDecisions] = useState<DecisionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/data/decisions.json").then((r) => r.json()).then(setDecisions).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-4 sm:p-8 text-sm">Loading journal...</div>;

  const copied = decisions.filter((d) => d.decision === "paper_copy");
  const watched = decisions.filter((d) => d.decision === "watchlist");
  const skipped = decisions.filter((d) => d.decision === "skip");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">📓 Decision Journal</h1>
        <p className="text-zinc-500 text-sm mt-1">Every copy/watchlist/skip decision explained</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 sm:p-4">
          <div className="text-[10px] sm:text-xs text-emerald-400 uppercase tracking-wide font-semibold">Copied</div>
          <div className="text-lg sm:text-2xl font-bold text-emerald-300 mt-0.5">{copied.length}</div>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 sm:p-4">
          <div className="text-[10px] sm:text-xs text-yellow-400 uppercase tracking-wide font-semibold">Watching</div>
          <div className="text-lg sm:text-2xl font-bold text-yellow-300 mt-0.5">{watched.length}</div>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 sm:p-4">
          <div className="text-[10px] sm:text-xs text-red-400 uppercase tracking-wide font-semibold">Skipped</div>
          <div className="text-lg sm:text-2xl font-bold text-red-300 mt-0.5">{skipped.length}</div>
        </div>
      </div>

      {/* Decision List */}
      <div className="space-y-2 sm:space-y-3">
        {decisions.map((d) => (
          <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
              className="w-full p-3 sm:p-4 flex justify-between items-start text-left hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded border ${d.decision === "paper_copy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : d.decision === "watchlist" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                    {d.decision.replace("_", " ").toUpperCase()}
                  </span>
                  <span className="text-[10px] sm:text-xs text-zinc-500">Score: {(d.copyScore * 100).toFixed(1)} · Conf: {(d.confidence * 100).toFixed(1)}%</span>
                  {d.simulatedPositionSize !== null && <span className="text-[10px] sm:text-xs text-emerald-400 font-mono">${d.simulatedPositionSize.toFixed(2)}</span>}
                </div>
                <p className="text-xs sm:text-sm font-medium text-zinc-200 truncate">{d.marketQuestion}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Wallet: {d.walletAddress.slice(0, 10)}... · {new Date(d.createdAt).toLocaleString()}</p>
              </div>
              {expandedId === d.id ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 ml-2" /> : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 ml-2" />}
            </button>

            {expandedId === d.id && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-zinc-800 pt-3">
                <div>
                  <h4 className="text-[10px] sm:text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Scoring Breakdown</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                    <JBadge label="Wallet" value={d.walletQualityScore} /><JBadge label="ROI" value={d.roiScore} />
                    <JBadge label="Consistency" value={d.consistencyScore} /><JBadge label="Copyability" value={d.copyabilityScore} />
                    <JBadge label="Category" value={d.categoryFitScore} /><JBadge label="Timing" value={d.entryTimingScore} />
                    <JBadge label="Spread" value={d.spreadScore} /><JBadge label="Liquidity" value={d.liquidityScore} />
                    <JBadge label="Thesis" value={d.thesisScore} />
                  </div>
                </div>
                {d.reasons.length > 0 && (
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">✅ Reasons</h4>
                    <ul className="space-y-0.5">{d.reasons.map((r, i) => <li key={i} className="text-[10px] sm:text-xs text-zinc-400 flex items-start gap-1"><span className="text-emerald-500 mt-0.5">•</span> {r}</li>)}</ul>
                  </div>
                )}
                {d.risks.length > 0 && (
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">⚠️ Risks</h4>
                    <ul className="space-y-0.5">{d.risks.map((r, i) => <li key={i} className="text-[10px] sm:text-xs text-zinc-400 flex items-start gap-1"><span className="text-red-500 mt-0.5">•</span> {r}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {decisions.length === 0 && (
          <div className="text-center text-zinc-600 py-8 text-sm"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />No decisions yet. Run <code className="text-emerald-400">npm run compute</code>.</div>
        )}
      </div>
    </div>
  );
}

function JBadge({ label, value }: { label: string; value: number }) {
  const v = (value || 0) * 100;
  const c = v >= 70 ? "text-emerald-400" : v >= 40 ? "text-yellow-400" : "text-red-400";
  return <div className="bg-zinc-800/50 rounded px-2 py-1"><span className="text-zinc-500">{label}: </span><span className={`font-mono ${c}`}>{v.toFixed(0)}</span></div>;
}
