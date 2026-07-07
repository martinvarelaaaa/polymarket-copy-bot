"use client";

import { useEffect, useState } from "react";

interface Wallet {
  address: string;
  label?: string | null;
  status: string;
  globalScore: number;
  roi30d: number;
  consistencyScore: number;
  copyabilityScore: number;
  oneHitWonderPenalty: number;
  bestCategory?: string | null;
  winRate30d: number;
  tradeCount30d: number;
  copyabilityNotes?: string | null;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wallets")
      .then((r) => r.json())
      .then(setWallets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading wallets...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">👛 Wallet Rankings</h1>
        <p className="text-zinc-500 mt-1">{wallets.length} wallets scanned</p>
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
              <th className="py-2 px-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w, i) => (
              <tr key={w.address} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="py-2 px-3 text-zinc-500">{i + 1}</td>
                <td className="py-2 px-3 font-mono text-xs">
                  <a href={`/wallets/${w.address}`} className="text-blue-400 hover:underline">
                    {w.address.slice(0, 8)}...{w.address.slice(-4)}
                  </a>
                  {w.label && <div className="text-zinc-400">{w.label}</div>}
                </td>
                <td className="py-2 px-3">
                  <StatusBadge status={w.status} />
                </td>
                <td className="py-2 px-3 font-mono">{(w.globalScore * 100).toFixed(1)}</td>
                <td className="py-2 px-3 font-mono">{(w.roi30d * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 font-mono">{(w.consistencyScore * 100).toFixed(1)}</td>
                <td className="py-2 px-3 font-mono">{(w.copyabilityScore * 100).toFixed(1)}</td>
                <td className="py-2 px-3 font-mono text-red-400">{(w.oneHitWonderPenalty * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 font-mono">{((w.winRate30d || 0) * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-zinc-400">{w.bestCategory || "—"}</td>
              </tr>
            ))}
            {wallets.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-zinc-600">
                  No wallets found. Run `npm run scan:leaderboard` first.
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
