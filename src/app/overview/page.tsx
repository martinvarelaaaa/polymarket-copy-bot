"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Wallet, Activity, Target, ScrollText, AlertTriangle } from "lucide-react";

interface StatsData {
  initialCapital: number;
  totalEquity: number;
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

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/stats.json")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
        Loading dashboard...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <p>No data available.</p>
        <p>Run <code className="text-emerald-400 bg-zinc-800 px-1.5 py-0.5 rounded">npm run compute</code> first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Demo Banner */}
      {stats.demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4 flex items-start sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-amber-400 text-xs uppercase tracking-wide">DEMO MODE</span>
            <p className="text-amber-400/70 text-xs mt-0.5">Showing simulated data. Set POLYMARKET_API_KEY for real data.</p>
          </div>
          <span className="hidden sm:block text-xs text-amber-500/50 whitespace-nowrap ml-4">
            {new Date(stats.lastUpdated).toLocaleString()}
          </span>
        </div>
      )}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold">📊 Paper Trading Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">All data is simulated. No real trades. Not financial advice.</p>
      </div>

      {/* Key Metrics Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <MetricCard label="Total PnL" value={`$${stats.totalPnl.toFixed(2)}`} icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />} color={stats.totalPnl >= 0 ? "emerald" : "red"} />
        <MetricCard label="Win Rate" value={`${(stats.winRate * 100).toFixed(1)}%`} icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />} color="blue" />
        <MetricCard label="Open Pos." value={String(stats.openPositions)} icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />} color="yellow" />
        <MetricCard label="Tracking" value={String(stats.trackingWallets)} icon={<Wallet className="w-4 h-4 sm:w-5 sm:h-5" />} color="purple" />
      </div>

      {/* Key Metrics Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <MetricCard label="Today Signals" value={String(stats.todaySignals)} icon={<ScrollText className="w-4 h-4 sm:w-5 sm:h-5" />} color="cyan" />
        <MetricCard label="Resolved" value={String(stats.totalResolved)} icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />} color="indigo" />
        <MetricCard label="Rules" value={`v${stats.activeRuleVersion}`} icon={<ScrollText className="w-4 h-4 sm:w-5 sm:h-5" />} color="orange" />
        <MetricCard label="Realized PnL" value={`$${stats.totalRealizedPnl.toFixed(2)}`} icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />} color={stats.totalRealizedPnl >= 0 ? "emerald" : "red"} />
      </div>

      {/* Capital status */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Paper Capital</div>
          <div className="text-xl sm:text-2xl font-bold mt-1">${stats.initialCapital.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Current Equity</div>
          <div className={`text-xl sm:text-2xl font-bold mt-1 ${stats.totalEquity >= stats.initialCapital ? "text-emerald-400" : "text-red-400"}`}>
            ${stats.totalEquity.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-zinc-900 border border-emerald-900/50 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-emerald-400 mb-1.5">🔒 Version 1 — Paper Trading Only</h2>
        <div className="text-xs sm:text-sm text-zinc-400 space-y-0.5">
          <p>✅ No real trades can be placed</p>
          <p>✅ No private keys stored or requested</p>
          <p>✅ All positions simulated ($5–$20)</p>
          <p>✅ Self-improving rules based on paper performance</p>
          <p className="text-zinc-600 mt-2">Real execution only after paper trading proves a consistent edge.</p>
        </div>
      </div>

      {/* Mobile-only timestamp */}
      <p className="text-xs text-zinc-600 text-right sm:hidden">
        {new Date(stats.lastUpdated).toLocaleString()}
      </p>

      {/* Desktop timestamp */}
      {!stats.demoMode && (
        <p className="hidden sm:block text-xs text-zinc-600 text-right">
          Last updated: {new Date(stats.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <div className={`${colorMap[color] || colorMap.blue} border rounded-xl p-3 sm:p-4 flex flex-col gap-0.5 sm:gap-1`}>
      <span className="text-[10px] sm:text-xs uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-lg sm:text-2xl font-bold">{value}</span>
      <span className="opacity-50">{icon}</span>
    </div>
  );
}
