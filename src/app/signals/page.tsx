"use client";
import { useEffect, useState } from "react";

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

  if (loading) return <div className="text-zinc-500 p-4 sm:p-8 text-sm">Loading signals...</div>;

  const filtered = filter === "all" ? decisions : decisions.filter((d) => d.decision === filter);
  const counts = { paper_copy: decisions.filter((d) => d.decision === "paper_copy").length, watchlist: decisions.filter((d) => d.decision === "watchlist").length, skip: decisions.filter((d) => d.decision === "skip").length };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">📡 Trade Signals</h1>
        <p className="text-zinc-500 text-sm mt-1">{decisions.length} decisions recorded</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
        {(["all", "paper_copy", "watchlist", "skip"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? ["bg-zinc-800 border-zinc-600 text-zinc-100", "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", "bg-red-500/10 border-red-500/30 text-red-400"][["all", "paper_copy", "watchlist", "skip"].indexOf(f)] : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
            {f === "all" ? "All" : f.replace("_", " ").toUpperCase()}
            {f !== "all" && <span className="ml-1 opacity-50">({counts[f]})</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:gap-3">
        {filtered.map((d) => (
          <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 sm:p-4 hover:border-zinc-700 transition-colors">
            {/* Top row: decision + scores */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded border ${d.decision === "paper_copy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : d.decision === "watchlist" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                {d.decision.replace("_", " ").toUpperCase()}
              </span>
              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                <span className="text-zinc-500">Score: <span className="font-mono text-zinc-300">{(d.copyScore * 100).toFixed(1)}</span></span>
                <span className="text-zinc-500">Conf: <span className="font-mono text-zinc-300">{(d.confidence * 100).toFixed(1)}%</span></span>
                {d.simulatedPositionSize && <span className="text-emerald-400 font-mono">${d.simulatedPositionSize.toFixed(2)}</span>}
              </div>
            </div>

            {/* Market Question */}
            <p className="text-xs sm:text-sm font-medium text-zinc-200 mb-1 line-clamp-2">{d.marketQuestion}</p>

            <div className="text-[10px] sm:text-xs text-zinc-500 font-mono mb-2">
              Wallet: {d.walletAddress.slice(0, 10)}... · Market: {d.marketId.slice(0, 12)}...
            </div>

            {/* Reasons & Risks */}
            <div className="space-y-1 mb-2 sm:mb-3">
              {d.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.reasons.map((r, i) => (
                    <span key={i} className="text-[10px] sm:text-xs bg-emerald-500/5 text-emerald-400/80 px-1.5 py-0.5 rounded">{r}</span>
                  ))}
                </div>
              )}
              {d.risks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.risks.map((r, i) => (
                    <span key={i} className="text-[10px] sm:text-xs bg-red-500/5 text-red-400/80 px-1.5 py-0.5 rounded">⚠ {r}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-scores */}
            <div className="flex gap-2 sm:gap-3 flex-wrap text-[10px] sm:text-xs text-zinc-600">
              <SB label="Wallet" value={d.walletQualityScore} /><SB label="ROI" value={d.roiScore} /><SB label="Cons." value={d.consistencyScore} />
              <SB label="Copy" value={d.copyabilityScore} /><SB label="Cat" value={d.categoryFitScore} /><SB label="Timing" value={d.entryTimingScore} />
              <SB label="Spread" value={d.spreadScore} /><SB label="Liq" value={d.liquidityScore} /><SB label="Thesis" value={d.thesisScore} />
            </div>

            <div className="text-[10px] text-zinc-700 mt-2">{new Date(d.createdAt).toLocaleString()}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-zinc-600 py-8 text-sm">No signals yet. Run <code className="text-emerald-400">npm run compute</code>.</div>
        )}
      </div>
    </div>
  );
}

function SB({ label, value }: { label: string; value: number }) {
  const v = (value || 0) * 100;
  const c = v >= 70 ? "text-emerald-400" : v >= 40 ? "text-yellow-400" : "text-red-400";
  return <span className="font-mono whitespace-nowrap">{label}: <span className={c}>{v.toFixed(0)}</span></span>;
}
