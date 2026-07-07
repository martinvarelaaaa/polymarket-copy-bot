"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

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

export default function WalletProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/wallets.json")
      .then((r) => r.json())
      .then((data: WalletData[]) => {
        const found = data.find(
          (w) => w.address.toLowerCase() === address.toLowerCase()
        );
        setWallet(found || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) return <div className="text-zinc-500 p-8">Loading wallet...</div>;
  if (!wallet) return (
    <div className="space-y-4">
      <a href="/wallets" className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back to wallets
      </a>
      <div className="text-red-400 p-8 text-center">Wallet not found: {address}</div>
    </div>
  );

  const statusColor = {
    track: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    watch: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    ignore: "text-red-400 bg-red-500/10 border-red-500/20",
  }[wallet.status];

  return (
    <div className="space-y-6">
      <a href="/wallets" className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back to wallets
      </a>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold font-mono text-sm break-all">{address}</h1>
          <span className={`text-xs px-2 py-0.5 rounded border ${statusColor}`}>
            {wallet.status.toUpperCase()}
          </span>
          {wallet.isDemo && (
            <span className="text-xs px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
              DEMO
            </span>
          )}
        </div>
        {wallet.label && <p className="text-zinc-400 mt-1">{wallet.label}</p>}
        <p className="text-xs text-zinc-600 mt-1">Source Rank: #{wallet.sourceRank} · Last scanned: {new Date(wallet.lastScannedAt).toLocaleString()}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Global Score" value={((wallet.globalScore) * 100).toFixed(1)} suffix="%" color={wallet.globalScore >= 0.7 ? "emerald" : wallet.globalScore >= 0.4 ? "yellow" : "red"} />
        <StatBox label="ROI 30d" value={(wallet.roi30d * 100).toFixed(1)} suffix="%" color={wallet.roi30d >= 0 ? "emerald" : "red"} />
        <StatBox label="Win Rate" value={(wallet.winRate30d * 100).toFixed(1)} suffix="%" />
        <StatBox label="Consistency" value={(wallet.consistencyScore * 100).toFixed(1)} suffix="%" />
        <StatBox label="Copyability" value={(wallet.copyabilityScore * 100).toFixed(1)} suffix="%" />
        <StatBox label="OHW Penalty" value={(wallet.oneHitWonderPenalty * 100).toFixed(1)} suffix="%" color="red" />
        <StatBox label="Trades 30d" value={String(wallet.tradeCount30d)} />
        <StatBox label="Resolved 30d" value={String(wallet.resolvedTradeCount30d)} />
        <StatBox label="Best Category" value={wallet.bestCategory || "—"} />
        <StatBox label="Avg Liquidity" value={`$${wallet.averageLiquidity.toFixed(0)}`} />
        <StatBox label="Avg Spread" value={`${(wallet.averageSpread * 100).toFixed(2)}%`} />
        <StatBox label="Entry Timing" value={`${(wallet.averageEntryTiming * 100).toFixed(1)}%`} />
      </div>

      {/* Copyability Notes */}
      {wallet.copyabilityNotes && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="font-semibold mb-2">📋 Copyability Assessment</h3>
          <p className="text-sm text-zinc-400">{wallet.copyabilityNotes}</p>
        </div>
      )}

      {/* Risk Notes */}
      {wallet.riskNotes && (
        <div className="bg-zinc-900 border border-red-900/30 rounded-xl p-4">
          <h3 className="font-semibold text-red-400 mb-2">⚠️ Risk Notes</h3>
          <p className="text-sm text-zinc-400">{wallet.riskNotes}</p>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  suffix = "",
  color,
}: {
  label: string;
  value: string;
  suffix?: string;
  color?: "emerald" | "yellow" | "red";
}) {
  const colorClass = color === "emerald" ? "text-emerald-400" : color === "red" ? "text-red-400" : color === "yellow" ? "text-yellow-400" : "text-zinc-100";
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>
        {value}{suffix}
      </div>
    </div>
  );
}
