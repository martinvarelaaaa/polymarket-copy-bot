"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function WalletProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wallets/${address}`)
      .then((r) => r.json())
      .then(setWallet)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) return <div className="text-zinc-500 p-8">Loading wallet...</div>;
  if (!wallet) return <div className="text-red-400 p-8">Wallet not found</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono text-sm break-all">{address}</h1>
        {wallet.label && <p className="text-zinc-400 mt-1">{wallet.label}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatBox label="Global Score" value={((wallet.globalScore || 0) * 100).toFixed(1)} suffix="%" />
        <StatBox label="ROI 30d" value={((wallet.roi30d || 0) * 100).toFixed(1)} suffix="%" />
        <StatBox label="Win Rate" value={((wallet.winRate30d || 0) * 100).toFixed(1)} suffix="%" />
        <StatBox label="Consistency" value={((wallet.consistencyScore || 0) * 100).toFixed(1)} suffix="%" />
        <StatBox label="Copyability" value={((wallet.copyabilityScore || 0) * 100).toFixed(1)} suffix="%" />
        <StatBox label="OHW Penalty" value={((wallet.oneHitWonderPenalty || 0) * 100).toFixed(1)} suffix="%" color="red" />
        <StatBox label="Trades 30d" value={String(wallet.tradeCount30d || 0)} />
        <StatBox label="Resolved 30d" value={String(wallet.resolvedTradeCount30d || 0)} />
        <StatBox label="Best Category" value={wallet.bestCategory || "—"} />
      </div>

      {wallet.copyabilityNotes && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="font-semibold mb-2">Copyability Notes</h3>
          <p className="text-sm text-zinc-400">{wallet.copyabilityNotes}</p>
        </div>
      )}
      {wallet.riskNotes && (
        <div className="bg-zinc-900 border border-red-900/30 rounded-xl p-4">
          <h3 className="font-semibold text-red-400 mb-2">Risk Notes</h3>
          <p className="text-sm text-zinc-400">{wallet.riskNotes}</p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, suffix = "", color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-xl font-bold ${color === "red" ? "text-red-400" : "text-zinc-100"}`}>
        {value}{suffix}
      </div>
    </div>
  );
}
