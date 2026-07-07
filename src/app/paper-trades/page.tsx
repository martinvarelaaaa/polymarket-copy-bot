"use client";
import { useEffect, useState } from "react";

export default function PaperTradesPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/paper-trades")
      .then((r) => r.json())
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading paper trades...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📝 Paper Trades</h1>
        <p className="text-zinc-500 mt-1">{trades.length} simulated trades</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-left">
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Wallet</th>
              <th className="py-2 px-3">Market</th>
              <th className="py-2 px-3">Side</th>
              <th className="py-2 px-3">Entry $</th>
              <th className="py-2 px-3">Current $</th>
              <th className="py-2 px-3">Size</th>
              <th className="py-2 px-3">PnL</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t: any) => (
              <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    t.status === "open" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    t.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  }`}>{t.status}</span>
                </td>
                <td className="py-2 px-3 font-mono text-xs">{t.walletAddress?.slice(0, 8)}...</td>
                <td className="py-2 px-3 font-mono text-xs">{t.marketId?.slice(0, 10)}...</td>
                <td className="py-2 px-3 text-xs">{t.side} / {t.outcome}</td>
                <td className="py-2 px-3 font-mono">${t.entryPrice?.toFixed(4)}</td>
                <td className="py-2 px-3 font-mono">${(t.currentPrice || 0).toFixed(4)}</td>
                <td className="py-2 px-3 font-mono">${t.simulatedPositionSize}</td>
                <td className={`py-2 px-3 font-mono ${(t.unrealizedPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  ${(t.unrealizedPnl || t.realizedPnl || 0).toFixed(2)}
                </td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-zinc-600">No paper trades yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
