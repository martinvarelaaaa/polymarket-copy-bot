"use client";
import { useEffect, useState } from "react";

export default function PerformancePage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/paper-trades")
      .then((r) => r.json())
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const resolved = trades.filter((t: any) => t.status === "resolved");
  const totalRealized = resolved.reduce((sum: number, t: any) => sum + (t.realizedPnl || 0), 0);
  const wins = resolved.filter((t: any) => (t.realizedPnl || 0) > 0);
  const losses = resolved.filter((t: any) => (t.realizedPnl || 0) < 0);
  const totalUnrealized = trades
    .filter((t: any) => t.status === "open")
    .reduce((sum: number, t: any) => sum + (t.unrealizedPnl || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📈 Performance</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500">Total Realized PnL</div>
          <div className={`text-2xl font-bold ${totalRealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            ${totalRealized.toFixed(2)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500">Unrealized PnL</div>
          <div className={`text-2xl font-bold ${totalUnrealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            ${totalUnrealized.toFixed(2)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500">Win Rate</div>
          <div className="text-2xl font-bold text-blue-400">
            {resolved.length > 0 ? ((wins.length / resolved.length) * 100).toFixed(1) : "—"}%
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500">Resolved Trades</div>
          <div className="text-2xl font-bold text-purple-400">{resolved.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-emerald-400 mb-2">✅ Wins ({wins.length})</h3>
          <div className="text-sm text-zinc-400">
            Best: ${Math.max(0, ...wins.map((t: any) => t.realizedPnl || 0)).toFixed(2)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-2">❌ Losses ({losses.length})</h3>
          <div className="text-sm text-zinc-400">
            Worst: ${Math.min(0, ...losses.map((t: any) => t.realizedPnl || 0)).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
