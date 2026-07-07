"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Wallet, Activity, Target, ScrollText } from "lucide-react";

interface Stats {
  totalPnl: number;
  winRate: number;
  openPositions: number;
  totalResolved: number;
  trackingWallets: number;
  todaySignals: number;
  activeRuleVersion: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📊 Paper Trading Dashboard</h1>
        <p className="text-zinc-500 mt-1">
          All data is simulated. No real trades. Not financial advice.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Paper PnL"
          value={stats ? `$${stats.totalPnl.toFixed(2)}` : "—"}
          icon={<TrendingUp className="w-5 h-5" />}
          color={stats && stats.totalPnl >= 0 ? "emerald" : "red"}
        />
        <MetricCard
          label="Win Rate"
          value={stats ? `${(stats.winRate * 100).toFixed(1)}%` : "—"}
          icon={<Target className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard
          label="Open Positions"
          value={stats ? String(stats.openPositions) : "—"}
          icon={<Activity className="w-5 h-5" />}
          color="yellow"
        />
        <MetricCard
          label="Tracking Wallets"
          value={stats ? String(stats.trackingWallets) : "—"}
          icon={<Wallet className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Signals"
          value={stats ? String(stats.todaySignals) : "—"}
          icon={<ScrollText className="w-5 h-5" />}
          color="cyan"
        />
        <MetricCard
          label="Resolved Trades"
          value={stats ? String(stats.totalResolved) : "—"}
          icon={<Target className="w-5 h-5" />}
          color="indigo"
        />
        <MetricCard
          label="Active Rule Version"
          value={stats ? `v${stats.activeRuleVersion}` : "—"}
          icon={<ScrollText className="w-5 h-5" />}
          color="orange"
        />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">Safety Mode</span>
          <span className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            PAPER ONLY
          </span>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-zinc-900 border border-emerald-900/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-emerald-400 mb-2">
          🔒 Version 1 — Paper Trading Only
        </h2>
        <div className="text-sm text-zinc-400 space-y-1">
          <p>✅ No real trades can be placed</p>
          <p>✅ No private keys stored or requested</p>
          <p>✅ All positions are simulated ($5–$20)</p>
          <p>✅ Self-improving rules based on paper performance</p>
          <p className="text-zinc-600 mt-2">
            Real execution will only be enabled after paper trading proves a consistent edge.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
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
    <div
      className={`${colorMap[color] || colorMap.blue} border rounded-xl p-4 flex flex-col gap-1`}
    >
      <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
      <span className="opacity-50">{icon}</span>
    </div>
  );
}
