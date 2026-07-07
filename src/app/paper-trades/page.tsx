"use client";
import { useEffect, useState } from "react";

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

  if (loading) return <div className="text-zinc-500 p-4 sm:p-8 text-sm">Loading paper trades...</div>;

  const filtered = filter === "all" ? trades : trades.filter((t) => t.status === filter);
  const openCount = trades.filter((t) => t.status === "open").length;
  const resolvedCount = trades.filter((t) => t.status === "resolved").length;
  const totalOpenPnl = trades.filter((t) => t.status === "open").reduce((s, t) => s + t.unrealizedPnl, 0);
  const totalRealized = trades.filter((t) => t.status === "resolved").reduce((s, t) => s + t.realizedPnl, 0);
  const resolvedTrades = trades.filter((t) => t.status === "resolved");
  const wins = resolvedTrades.filter((t) => t.realizedPnl > 0).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">📝 Paper Trades</h1>
        <p className="text-zinc-500 text-sm mt-1">{trades.length} simulated trades</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <SC label="Open PnL" value={`$${totalOpenPnl.toFixed(2)}`} color={totalOpenPnl >= 0 ? "emerald" : "red"} />
        <SC label="Realized" value={`$${totalRealized.toFixed(2)}`} color={totalRealized >= 0 ? "emerald" : "red"} />
        <SC label="Win Rate" value={resolvedTrades.length > 0 ? `${((wins / resolvedTrades.length) * 100).toFixed(1)}%` : "—"} color="blue" />
        <SC label="Open/Resolved" value={`${openCount}/${resolvedCount}`} color="purple" />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? "bg-zinc-800 border-zinc-600 text-zinc-100" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && <span className="ml-1 opacity-50">({f === "open" ? openCount : resolvedCount})</span>}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-left">
              <th className="py-2 px-3">Status</th><th className="py-2 px-3">Market</th><th className="py-2 px-3">Side</th><th className="py-2 px-3">Entry $</th><th className="py-2 px-3">Curr $</th><th className="py-2 px-3">Size</th><th className="py-2 px-3">PnL</th><th className="py-2 px-3">Opened</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const pnl = t.status === "resolved" ? t.realizedPnl : t.unrealizedPnl;
              return (
                <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-2 px-3"><StatusBadge status={t.status} /></td>
                  <td className="py-2 px-3 max-w-48"><div className="text-xs text-zinc-300 truncate">{t.marketQuestion}</div><div className="text-xs text-zinc-600 font-mono">{t.marketId.slice(0, 10)}...</div></td>
                  <td className="py-2 px-3 text-xs"><span className={`font-semibold ${t.outcome === "YES" ? "text-emerald-400" : "text-red-400"}`}>{t.outcome}</span><span className="text-zinc-600 ml-1">· {t.side}</span></td>
                  <td className="py-2 px-3 font-mono text-xs">${t.entryPrice.toFixed(4)}</td>
                  <td className="py-2 px-3 font-mono text-xs">${t.currentPrice.toFixed(4)}</td>
                  <td className="py-2 px-3 font-mono text-xs">${t.simulatedPositionSize.toFixed(2)}</td>
                  <td className={`py-2 px-3 font-mono text-xs font-semibold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</td>
                  <td className="py-2 px-3 text-xs text-zinc-500">{new Date(t.openedAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-zinc-600">No paper trades yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2">
        {filtered.map((t) => {
          const pnl = t.status === "resolved" ? t.realizedPnl : t.unrealizedPnl;
          return (
            <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={t.status} />
                <span className={`text-sm font-bold font-mono ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</span>
              </div>
              <p className="text-xs text-zinc-200 line-clamp-2 mb-1.5">{t.marketQuestion}</p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div><span className="text-zinc-500">Side: </span><span className={`font-medium ${t.outcome === "YES" ? "text-emerald-400" : "text-red-400"}`}>{t.outcome}</span></div>
                <div><span className="text-zinc-500">Entry: </span><span className="font-mono text-zinc-300">${t.entryPrice.toFixed(4)}</span></div>
                <div><span className="text-zinc-500">Size: </span><span className="font-mono text-zinc-300">${t.simulatedPositionSize.toFixed(2)}</span></div>
              </div>
              <div className="text-[10px] text-zinc-600 mt-1.5">{new Date(t.openedAt).toLocaleDateString()}</div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center text-zinc-600 py-8 text-sm">No paper trades yet.</div>}
      </div>
    </div>
  );
}

function SC({ label, value, color }: { label: string; value: string; color: "emerald" | "red" | "blue" | "purple" }) {
  const cm = { emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", red: "bg-red-500/10 text-red-400 border-red-500/20", blue: "bg-blue-500/10 text-blue-400 border-blue-500/20", purple: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
  return <div className={`${cm[color]} border rounded-xl p-3 sm:p-4`}><div className="text-[10px] sm:text-xs uppercase tracking-wide opacity-70">{label}</div><div className="text-lg sm:text-2xl font-bold mt-1">{value}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const cm: Record<string, string> = { open: "bg-blue-500/10 text-blue-400 border-blue-500/20", resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
  return <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded border ${cm[status] || cm.open}`}>{status}</span>;
}
