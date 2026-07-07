"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PaperTradeData {
  id: number;
  walletAddress: string;
  marketId: string;
  marketQuestion: string;
  outcome: string;
  side: string;
  entryPrice: number;
  currentPrice: number;
  simulatedPositionSize: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: "open" | "closed" | "resolved";
  openedAt: string;
  closedAt: string | null;
  resolvedAt: string | null;
}

export default function PaperTradesPage() {
  const [trades, setTrades] = useState<PaperTradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  useEffect(() => {
    fetch("/data/paper-trades.json")
      .then((r) => r.json())
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading paper trades...</div>;

  const filtered = filter === "all" ? trades : trades.filter((t) => t.status === filter);
  const openCount = trades.filter((t) => t.status === "open").length;
  const resolvedCount = trades.filter((t) => t.status === "resolved").length;

  const totalOpenPnl = trades.filter(t => t.status === "open").reduce((s, t) => s + t.unrealizedPnl, 0);
  const totalRealized = trades.filter(t => t.status === "resolved").reduce((s, t) => s + t.realizedPnl, 0);
  const wins = trades.filter(t => t.status === "resolved" && t.realizedPnl > 0).length;
  const resolvedTrades = trades.filter(t => t.status === "resolved");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📝 Paper Trades</h1>
        <p className="text-zinc-500 mt-1">{trades.length} simulated trades</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Open PnL" value={`$${totalOpenPnl.toFixed(2)}`} color={totalOpenPnl >= 0 ? "emerald" : "red"} />
        <SummaryCard label="Realized PnL" value={`$${totalRealized.toFixed(2)}`} color={totalRealized >= 0 ? "emerald" : "red"} />
        <SummaryCard label="Win Rate" value={resolvedTrades.length > 0 ? `${((wins / resolvedTrades.length) * 100).toFixed(1)}%` : "—"} color="blue" />
        <SummaryCard label="Open / Resolved" value={`${openCount} / ${resolvedCount}`} color="purple" />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f
                ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "open" && <span className="ml-1 opacity-50">({openCount})</span>}
            {f === "resolved" && <span className="ml-1 opacity-50">({resolvedCount})</span>}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-left">
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Market</th>
              <th className="py-2 px-3">Side</th>
              <th className="py-2 px-3">Entry $</th>
              <th className="py-2 px-3">Current $</th>
              <th className="py-2 px-3">Size</th>
              <th className="py-2 px-3">PnL</th>
              <th className="py-2 px-3">Opened</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const pnl = t.status === "resolved" ? t.realizedPnl : t.unrealizedPnl;
              return (
                <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      t.status === "open" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      t.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                    }`}>{t.status}</span>
                  </td>
                  <td className="py-2 px-3 max-w-48">
                    <div className="text-xs text-zinc-300 truncate">{t.marketQuestion}</div>
                    <div className="text-xs text-zinc-600 font-mono">{t.marketId.slice(0, 10)}...</div>
                  </td>
                  <td className="py-2 px-3 text-xs">
                    <span className={`font-semibold ${t.outcome === "YES" ? "text-emerald-400" : "text-red-400"}`}>
                      {t.outcome}
                    </span>
                    <span className="text-zinc-600 ml-1">· {t.side}</span>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">${t.entryPrice.toFixed(4)}</td>
                  <td className="py-2 px-3 font-mono text-xs">${t.currentPrice.toFixed(4)}</td>
                  <td className="py-2 px-3 font-mono text-xs">${t.simulatedPositionSize.toFixed(2)}</td>
                  <td className={`py-2 px-3 font-mono text-xs font-semibold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-xs text-zinc-500">
                    {new Date(t.openedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-zinc-600">No paper trades yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "red" | "blue" | "purple";
}) {
  const colorMap = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <div className={`${colorMap[color]} border rounded-xl p-4`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
