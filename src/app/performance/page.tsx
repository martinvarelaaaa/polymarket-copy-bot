"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Target, Activity, BarChart3 } from "lucide-react";

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

interface StatsData {
  totalPnl: number;
  totalRealizedPnl: number;
  winRate: number;
  openPositions: number;
  totalResolved: number;
  trackingWallets: number;
  todaySignals: number;
  activeRuleVersion: number;
  demoMode: boolean;
  lastUpdated: string;
}

export default function PerformancePage() {
  const [trades, setTrades] = useState<PaperTradeData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/data/paper-trades.json").then((r) => r.json()),
      fetch("/data/stats.json").then((r) => r.json()),
    ])
      .then(([t, s]) => {
        setTrades(t);
        setStats(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading performance data...</div>;

  const resolved = trades.filter((t) => t.status === "resolved");
  const openTrades = trades.filter((t) => t.status === "open");
  const totalRealized = resolved.reduce((sum, t) => sum + t.realizedPnl, 0);
  const totalUnrealized = openTrades.reduce((sum, t) => sum + t.unrealizedPnl, 0);
  const wins = resolved.filter((t) => t.realizedPnl > 0);
  const losses = resolved.filter((t) => t.realizedPnl < 0);
  const bestPnL = Math.max(0, ...resolved.map((t) => t.realizedPnl || 0));
  const worstPnL = Math.min(0, ...resolved.map((t) => t.realizedPnl || 0));
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.realizedPnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.realizedPnl, 0) / losses.length : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📈 Performance</h1>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total PnL"
          value={`$${(totalRealized + totalUnrealized).toFixed(2)}`}
          color={totalRealized + totalUnrealized >= 0 ? "emerald" : "red"}
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <MetricCard
          label="Realized PnL"
          value={`$${totalRealized.toFixed(2)}`}
          color={totalRealized >= 0 ? "emerald" : "red"}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Unrealized PnL"
          value={`$${totalUnrealized.toFixed(2)}`}
          color={totalUnrealized >= 0 ? "emerald" : "red"}
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <MetricCard
          label="Win Rate"
          value={resolved.length > 0 ? `${(stats?.winRate ? stats.winRate * 100 : (wins.length / resolved.length) * 100).toFixed(1)}%` : "—"}
          color="blue"
          icon={<Target className="w-5 h-5" />}
        />
      </div>

      {/* Trade Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Resolved Trades"
          value={String(resolved.length)}
          color="purple"
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          label="Open Positions"
          value={String(openTrades.length)}
          color="cyan"
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          label="Total Trades"
          value={String(trades.length)}
          color="indigo"
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          label="Tracking Wallets"
          value={stats ? String(stats.trackingWallets) : "—"}
          color="orange"
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      {/* Wins & Losses */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3">✅ Wins ({wins.length})</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Best PnL</span>
              <span className="font-mono text-emerald-400">+${bestPnL.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Avg Win</span>
              <span className="font-mono text-emerald-400">+${avgWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Total from Wins</span>
              <span className="font-mono text-emerald-400">+${wins.reduce((s, t) => s + t.realizedPnl, 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-3">❌ Losses ({losses.length})</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Worst PnL</span>
              <span className="font-mono text-red-400">${worstPnL.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Avg Loss</span>
              <span className="font-mono text-red-400">${avgLoss.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Total from Losses</span>
              <span className="font-mono text-red-400">${losses.reduce((s, t) => s + t.realizedPnl, 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Resolved Trades Table */}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Resolved Trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                  <th className="py-2 px-3">Market</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3">Entry</th>
                  <th className="py-2 px-3">Size</th>
                  <th className="py-2 px-3">PnL</th>
                  <th className="py-2 px-3">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {resolved.slice(-10).reverse().map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-2 px-3">
                      <div className="text-xs text-zinc-300 truncate max-w-48">{t.marketQuestion}</div>
                    </td>
                    <td className="py-2 px-3 text-xs">
                      <span className={t.outcome === "YES" ? "text-emerald-400" : "text-red-400"}>{t.outcome}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">${t.entryPrice.toFixed(4)}</td>
                    <td className="py-2 px-3 font-mono text-xs">${t.simulatedPositionSize.toFixed(2)}</td>
                    <td className={`py-2 px-3 font-mono text-xs font-semibold ${t.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.realizedPnl >= 0 ? "+" : ""}${t.realizedPnl.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-xs text-zinc-500">
                      {t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {trades.length === 0 && (
        <div className="text-center text-zinc-600 py-8">No trade data available yet.</div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: "emerald" | "red" | "blue" | "purple" | "cyan" | "indigo" | "orange";
  icon?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <div className={`${colorMap[color]} border rounded-xl p-4 flex flex-col gap-1`}>
      <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
      {icon && <span className="opacity-50">{icon}</span>}
    </div>
  );
}
