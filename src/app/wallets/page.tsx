"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ChevronDown } from "lucide-react";

interface WalletData {
  address: string; label: string; sourceRank: number; status: "track" | "watch" | "ignore";
  roi30d: number; consistencyScore: number; copyabilityScore: number; oneHitWonderPenalty: number;
  globalScore: number; bestCategory: string; winRate30d: number; tradeCount30d: number;
  resolvedTradeCount30d: number; averageLiquidity: number; averageSpread: number;
  averageEntryTiming: number; copyabilityNotes: string; riskNotes: string | null;
  isDemo: boolean; lastScannedAt: string;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "track" | "watch" | "ignore">("all");
  const [expandedAddr, setExpandedAddr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/wallets.json").then(r => r.json()).then(setWallets).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-4 sm:p-8 text-sm">Cargando wallets...</div>;

  const filtered = filter === "all" ? wallets : wallets.filter(w => w.status === filter);
  const counts = { track: wallets.filter(w => w.status === "track").length, watch: wallets.filter(w => w.status === "watch").length, ignore: wallets.filter(w => w.status === "ignore").length };
  const labels: Record<string, string> = { track: "Seguir", watch: "Observar", ignore: "Ignorar" };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">👛 Ranking de Wallets</h1>
        <p className="text-zinc-500 text-sm mt-1">{wallets.length} wallets · Último scan: {wallets[0] ? new Date(wallets[0].lastScannedAt).toLocaleString() : "N/A"}</p>
      </div>

      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
        {(["all", "track", "watch", "ignore"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? ["bg-zinc-800 border-zinc-600 text-zinc-100","bg-emerald-500/10 border-emerald-500/30 text-emerald-400","bg-yellow-500/10 border-yellow-500/30 text-yellow-400","bg-red-500/10 border-red-500/30 text-red-400"][["all","track","watch","ignore"].indexOf(f)] : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
            {f === "all" ? "Todas" : labels[f]}{f !== "all" && <span className="ml-1 opacity-50">({counts[f]})</span>}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-zinc-800 text-zinc-500 text-left"><th className="py-2 px-3">#</th><th className="py-2 px-3">Wallet</th><th className="py-2 px-3">Estado</th><th className="py-2 px-3">Score</th><th className="py-2 px-3">ROI 30d</th><th className="py-2 px-3">Consist.</th><th className="py-2 px-3">Copiabilidad</th><th className="py-2 px-3">OHW</th><th className="py-2 px-3">Win Rate</th><th className="py-2 px-3">Trades</th><th className="py-2 px-3">Categoría</th></tr></thead>
          <tbody>
            {filtered.map((w, i) => (
              <tr key={w.address} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="py-2 px-3 text-zinc-500">{w.sourceRank || i + 1}</td>
                <td className="py-2 px-3 font-mono text-xs"><a href={`/wallets/${w.address}`} className="text-blue-400 hover:underline inline-flex items-center gap-1">{w.address.slice(0,8)}...{w.address.slice(-4)}<ExternalLink className="w-3 h-3"/></a><div className="text-zinc-400">{w.label}</div></td>
                <td className="py-2 px-3"><StatusBadge status={w.status}/></td>
                <td className="py-2 px-3 font-mono">{(w.globalScore*100).toFixed(0)}</td>
                <td className={`py-2 px-3 font-mono ${w.roi30d>=0?"text-emerald-400":"text-red-400"}`}>{(w.roi30d*100).toFixed(0)}%</td>
                <td className="py-2 px-3 font-mono">{(w.consistencyScore*100).toFixed(0)}</td>
                <td className="py-2 px-3 font-mono">{(w.copyabilityScore*100).toFixed(0)}</td>
                <td className="py-2 px-3 font-mono text-red-400">{(w.oneHitWonderPenalty*100).toFixed(0)}%</td>
                <td className="py-2 px-3 font-mono">{(w.winRate30d*100).toFixed(0)}%</td>
                <td className="py-2 px-3 font-mono">{w.tradeCount30d}</td>
                <td className="py-2 px-3 text-zinc-400">{w.bestCategory||"—"}</td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={11} className="py-8 text-center text-zinc-600">Sin wallets. Ejecutá <code className="text-emerald-400">npm run compute</code>.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-2">
        {filtered.map(w => (
          <div key={w.address} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <button onClick={()=>setExpandedAddr(expandedAddr===w.address?null:w.address)} className="w-full p-3 flex items-center justify-between text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1"><span className="text-xs text-zinc-500">#{w.sourceRank}</span><StatusBadge status={w.status}/><span className={`text-xs font-mono font-bold ${w.globalScore>=0.7?"text-emerald-400":w.globalScore>=0.4?"text-yellow-400":"text-red-400"}`}>{(w.globalScore*100).toFixed(0)}%</span></div>
                <div className="text-sm font-medium text-zinc-200 truncate">{w.label}</div>
                <div className="text-[11px] text-zinc-600 font-mono mt-0.5">{w.address.slice(0,12)}...{w.address.slice(-6)}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 ml-2 transition-transform ${expandedAddr===w.address?"rotate-180":""}`}/>
            </button>
            {expandedAddr===w.address&&(
              <div className="px-3 pb-3 border-t border-zinc-800 pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div><span className="text-zinc-500">ROI 30d:</span> <span className={`font-mono ${w.roi30d>=0?"text-emerald-400":"text-red-400"}`}>{(w.roi30d*100).toFixed(1)}%</span></div>
                  <div><span className="text-zinc-500">Win Rate:</span> <span className="font-mono">{(w.winRate30d*100).toFixed(1)}%</span></div>
                  <div><span className="text-zinc-500">Consistencia:</span> <span className="font-mono">{(w.consistencyScore*100).toFixed(0)}</span></div>
                  <div><span className="text-zinc-500">Copiabilidad:</span> <span className="font-mono">{(w.copyabilityScore*100).toFixed(0)}</span></div>
                  <div><span className="text-zinc-500">Penal. OHW:</span> <span className="font-mono text-red-400">{(w.oneHitWonderPenalty*100).toFixed(1)}%</span></div>
                  <div><span className="text-zinc-500">Trades:</span> <span className="font-mono">{w.tradeCount30d}</span></div>
                  <div><span className="text-zinc-500">Liquidez:</span> <span className="font-mono">${w.averageLiquidity.toFixed(0)}</span></div>
                  <div><span className="text-zinc-500">Spread:</span> <span className="font-mono">{(w.averageSpread*100).toFixed(1)}%</span></div>
                  <div className="col-span-2"><span className="text-zinc-500">Categoría:</span> <span className="text-zinc-300">{w.bestCategory}</span></div>
                </div>
                {w.riskNotes&&<div className="text-xs text-red-400/80 bg-red-500/5 rounded px-2 py-1.5">{w.riskNotes}</div>}
                <div className="text-xs text-zinc-500">{w.copyabilityNotes}</div>
                <a href={`/wallets/${w.address}`} className="text-xs text-blue-400 flex items-center gap-1 hover:underline">Perfil Completo <ExternalLink className="w-3 h-3"/></a>
              </div>
            )}
          </div>
        ))}
        {filtered.length===0&&<div className="text-center text-zinc-600 py-8 text-sm">Sin wallets.</div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string,string> = { track:"bg-emerald-500/10 text-emerald-400 border-emerald-500/20", watch:"bg-yellow-500/10 text-yellow-400 border-yellow-500/20", ignore:"bg-red-500/10 text-red-400 border-red-500/20" };
  const labels: Record<string,string> = { track:"Seguir", watch:"Observar", ignore:"Ignorar" };
  return <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded border ${colors[status]||colors.watch}`}>{labels[status]||status}</span>;
}
