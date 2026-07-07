"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

interface WalletData {
  address: string;
  label: string;
  sourceRank: number;
  status: "track" | "watch" | "ignore";
  roi30d: number;
  consistencyScore: number;
  copyabilityScore: number;
  oneHitWonderPenalty: number;
  globalScore: number;
  bestCategory: string;
  winRate30d: number;
  tradeCount30d: number;
  resolvedTradeCount30d: number;
  averageLiquidity: number;
  averageSpread: number;
  averageEntryTiming: number;
  copyabilityNotes: string;
  riskNotes: string | null;
  isDemo: boolean;
  lastScannedAt: string;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "track" | "watch" | "ignore">("all");

  useEffect(() => {
    fetch("/data/wallets.json")
      .then((r) => r.json())
      .then((data: WalletData[]) => setWallets(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading wallets...</div>;

  const filtered = filter === "all" ? wallets : wallets.filter((w) => w.status === filter);
  const counts = {
    track: wallets.filter((w) => w.status === "track").length,
    watch: wallets.filter((w) => w.status === "watch").length,
    ignore: wallets.filter((w) => w.status === "ignore").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">👛 Wallet Rankings</h1>
        <p className="text-zinc-500 mt-1">
          {wallets.length} wallets scanned · Last scan:{" "}
          {wallets[0] ? new Date(wallets[0].lastScannedAt).toLocaleString() : "N/A"}
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {(["all", "track", "watch", "ignore"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f
                ? [
                    "bg-zinc-800 border-zinc-600 text-zinc-100",
                    "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                    "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
                    "bg-red-500/10 border-red-500/30 text-red-400",
                  ][["all", "track", "watch", "ignore"].indexOf(f)]
                : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span className="ml-1 opacity-50">({counts[f]})</span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-left">
              <th className="py-2 px-3">Rank</th>
              <th className="py-2 px-3">Wallet</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Score</th>
              <th className="py-2 px-3">ROI 30d</th>
              <th className="py-2 px-3">Consistency</th>
              <th className="py-2 px-3">Copyability</th>
              <th className="py-2 px-3">OHW Penalty</th>
              <th className="py-2 px-3">Win Rate</th>
              <th className="py-2 px-3">Trades</th>
              <th className="py-2 px-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w, i) => (
              <tr key={w.address} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="py-2 px-3 text-zinc-500">{w.sourceRank || i + 1}</td>
                <td className="py-2 px-3 font-mono text-xs">
                  <a href={`/wallets/${w.address}`} className="text-blue-400 hover:underline inline-flex items-center gap-1">
                    {w.address.slice(0, 8)}...{w.address.slice(-4)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <div className="text-zinc-400">{w.label}</div>
                </td>
                <td className="py-2 px-3">
                  <StatusBadge status={w.status} />
                </td>
                <td className="py-2 px-3 font-mono">{(w.globalScore * 100).toFixed(1)}</td>
                <td className={`py-2 px-3 font-mono ${w.roi30d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(w.roi30d * 100).toFixed(1)}%
                </td>
                <td className="py-2 px-3 font-mono">{(w.consistencyScore * 100).toFixed(1)}</td>
                <td className="py-2 px-3 font-mono">{(w.copyabilityScore * 100).toFixed(1)}</td>
                <td className="py-2 px-3 font-mono text-red-400">{(w.oneHitWonderPenalty * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 font-mono">{(w.winRate30d * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 font-mono">{w.tradeCount30d}</td>
                <td className="py-2 px-3 text-zinc-400">{w.bestCategory || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-zinc-600">
                  No wallets found matching filter. Run <code className="text-emerald-400">npm run compute</code> first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    track: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    watch: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    ignore: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[status] || colors.watch}`}>
      {status}
    </span>
  );
}
