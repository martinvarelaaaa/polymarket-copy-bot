"use client";
import { useEffect, useState } from "react";

export default function SignalsPage() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/decisions")
      .then((r) => r.json())
      .then(setDecisions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading signals...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📡 Trade Signals</h1>
        <p className="text-zinc-500 mt-1">{decisions.length} decisions recorded</p>
      </div>
      <div className="grid gap-3">
        {decisions.map((d: any) => (
          <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${
                d.decision === "paper_copy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                d.decision === "watchlist" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{d.decision}</span>
              <span className="text-xs text-zinc-500">Score: {(d.copyScore * 100).toFixed(1)}</span>
            </div>
            <div className="text-xs text-zinc-400 font-mono">
              Wallet: {d.walletAddress?.slice(0, 10)}... | Market: {d.marketId?.slice(0, 10)}...
            </div>
            {d.reasonsJson && (
              <div className="mt-2 text-xs text-zinc-500">
                Reasons: {d.reasonsJson}
              </div>
            )}
            <div className="mt-2 flex gap-4 text-xs text-zinc-600">
              <span>Wallet Qual: {((d.walletQualityScore || 0) * 100).toFixed(0)}</span>
              <span>Spread: {((d.spreadScore || 0) * 100).toFixed(0)}</span>
              <span>Liquidity: {((d.liquidityScore || 0) * 100).toFixed(0)}</span>
              <span>Timing: {((d.entryTimingScore || 0) * 100).toFixed(0)}</span>
              <span>Sim Size: ${d.simulatedPositionSize || 0}</span>
            </div>
          </div>
        ))}
        {decisions.length === 0 && (
          <div className="text-center text-zinc-600 py-8">No signals yet. Run `npm run monitor:trades` and `npm run score:trades`.</div>
        )}
      </div>
    </div>
  );
}
