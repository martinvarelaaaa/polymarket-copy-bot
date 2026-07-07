"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Target, Activity, BarChart3 } from "lucide-react";

interface PaperTradeData {
  id: number; walletAddress: string; marketId: string; marketQuestion: string;
  outcome: string; side: string; entryPrice: number; currentPrice: number;
  simulatedPositionSize: number; unrealizedPnl: number; realizedPnl: number;
  status: "open" | "closed" | "resolved"; openedAt: string; closedAt: string | null; resolvedAt: string | null;
}
interface StatsData { totalPnl: number; totalRealizedPnl: number; winRate: number; openPositions: number; totalResolved: number; trackingWallets: number; todaySignals: number; activeRuleVersion: number; demoMode: boolean; lastUpdated: string; }

export default function PerformancePage() {
  const [trades, setTrades] = useState<PaperTradeData[]>([]);
  const [stats, setStats] = useState<StatsData|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{Promise.all([fetch("/data/paper-trades.json").then(r=>r.json()),fetch("/data/stats.json").then(r=>r.json())]).then(([t,s])=>{setTrades(t);setStats(s);}).catch(console.error).finally(()=>setLoading(false));},[]);
  if(loading) return <div className="text-zinc-500 p-4 sm:p-8 text-sm">Cargando rendimiento...</div>;

  const resolved=trades.filter(t=>t.status==="resolved"), openTrades=trades.filter(t=>t.status==="open");
  const totalRealized=resolved.reduce((s,t)=>s+t.realizedPnl,0),totalUnrealized=openTrades.reduce((s,t)=>s+t.unrealizedPnl,0);
  const wins=resolved.filter(t=>t.realizedPnl>0),losses=resolved.filter(t=>t.realizedPnl<0);
  const bestPnL=Math.max(0,...resolved.map(t=>t.realizedPnl||0)),worstPnL=Math.min(0,...resolved.map(t=>t.realizedPnl||0));
  const avgWin=wins.length>0?wins.reduce((s,t)=>s+t.realizedPnl,0)/wins.length:0,avgLoss=losses.length>0?losses.reduce((s,t)=>s+t.realizedPnl,0)/losses.length:0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">📈 Rendimiento</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <MC l="PnL Total" v={`$${(totalRealized+totalUnrealized).toFixed(2)}`} c={totalRealized+totalUnrealized>=0?"emerald":"red"} i={<BarChart3 className="w-4 h-4 sm:w-5 sm:h-5"/>}/>
        <MC l="Realizado" v={`$${totalRealized.toFixed(2)}`} c={totalRealized>=0?"emerald":"red"} i={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5"/>}/>
        <MC l="No Realizado" v={`$${totalUnrealized.toFixed(2)}`} c={totalUnrealized>=0?"emerald":"red"} i={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5"/>}/>
        <MC l="Win Rate" v={resolved.length>0?`${(stats?.winRate?stats.winRate*100:(wins.length/resolved.length)*100).toFixed(1)}%`:"—"} c="blue" i={<Target className="w-4 h-4 sm:w-5 sm:h-5"/>}/>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <MC l="Resueltos" v={String(resolved.length)} c="purple"/><MC l="Abiertos" v={String(openTrades.length)} c="cyan"/>
        <MC l="Total" v={String(trades.length)} c="indigo"/><MC l="Siguiendo" v={stats?String(stats.trackingWallets):"—"} c="orange"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4"><h3 className="text-xs sm:text-sm font-semibold text-emerald-400 mb-2 sm:mb-3">✅ Ganancias ({wins.length})</h3><div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm"><div className="flex justify-between"><span className="text-zinc-500">Mejor PnL</span><span className="font-mono text-emerald-400">+${bestPnL.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-zinc-500">Ganancia Prom.</span><span className="font-mono text-emerald-400">+${avgWin.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-zinc-500">Total Ganancias</span><span className="font-mono text-emerald-400">+${wins.reduce((s,t)=>s+t.realizedPnl,0).toFixed(2)}</span></div></div></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4"><h3 className="text-xs sm:text-sm font-semibold text-red-400 mb-2 sm:mb-3">❌ Pérdidas ({losses.length})</h3><div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm"><div className="flex justify-between"><span className="text-zinc-500">Peor PnL</span><span className="font-mono text-red-400">${worstPnL.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-zinc-500">Pérdida Prom.</span><span className="font-mono text-red-400">${avgLoss.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-zinc-500">Total Pérdidas</span><span className="font-mono text-red-400">${losses.reduce((s,t)=>s+t.realizedPnl,0).toFixed(2)}</span></div></div></div>
      </div>
      {resolved.length>0&&(<><h2 className="text-base sm:text-lg font-semibold mt-2">Últimos Trades Resueltos</h2>
        <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-zinc-800 text-zinc-500 text-left"><th className="py-2 px-3">Mercado</th><th className="py-2 px-3">Lado</th><th className="py-2 px-3">Entrada</th><th className="py-2 px-3">Tam</th><th className="py-2 px-3">PnL</th><th className="py-2 px-3">Resuelto</th></tr></thead><tbody>{resolved.slice(-10).reverse().map(t=><tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50"><td className="py-2 px-3"><div className="text-xs text-zinc-300 truncate max-w-48">{t.marketQuestion}</div></td><td className="py-2 px-3 text-xs"><span className={t.outcome==="YES"?"text-emerald-400":"text-red-400"}>{t.outcome==="YES"?"SÍ":"NO"}</span></td><td className="py-2 px-3 font-mono text-xs">${t.entryPrice.toFixed(4)}</td><td className="py-2 px-3 font-mono text-xs">${t.simulatedPositionSize.toFixed(2)}</td><td className={`py-2 px-3 font-mono text-xs font-semibold ${t.realizedPnl>=0?"text-emerald-400":"text-red-400"}`}>{t.realizedPnl>=0?"+":""}${t.realizedPnl.toFixed(2)}</td><td className="py-2 px-3 text-xs text-zinc-500">{t.resolvedAt?new Date(t.resolvedAt).toLocaleDateString():"—"}</td></tr>)}</tbody></table></div>
        <div className="sm:hidden space-y-2">{resolved.slice(-10).reverse().map(t=><div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><div className="flex justify-between items-start mb-1"><p className="text-xs text-zinc-200 line-clamp-2 flex-1 mr-2">{t.marketQuestion}</p><span className={`text-sm font-bold font-mono shrink-0 ${t.realizedPnl>=0?"text-emerald-400":"text-red-400"}`}>{t.realizedPnl>=0?"+":""}${t.realizedPnl.toFixed(2)}</span></div><div className="flex gap-3 text-[10px] text-zinc-500"><span className={t.outcome==="YES"?"text-emerald-400":"text-red-400"}>{t.outcome==="YES"?"SÍ":"NO"}</span><span>@${t.entryPrice.toFixed(3)}</span><span>×${t.simulatedPositionSize.toFixed(0)}</span><span>{t.resolvedAt?new Date(t.resolvedAt).toLocaleDateString():"—"}</span></div></div>)}</div></>)}
      {trades.length===0&&<div className="text-center text-zinc-600 py-8 text-sm">Sin datos de rendimiento aún.</div>}
    </div>
  );
}
function MC({l,v,c,i}:{l:string;v:string;c:string;i?:React.ReactNode}){const cm:Record<string,string>={emerald:"bg-emerald-500/10 text-emerald-400 border-emerald-500/20",red:"bg-red-500/10 text-red-400 border-red-500/20",blue:"bg-blue-500/10 text-blue-400 border-blue-500/20",purple:"bg-purple-500/10 text-purple-400 border-purple-500/20",cyan:"bg-cyan-500/10 text-cyan-400 border-cyan-500/20",indigo:"bg-indigo-500/10 text-indigo-400 border-indigo-500/20",orange:"bg-orange-500/10 text-orange-400 border-orange-500/20"};return <div className={`${cm[c]||cm.blue} border rounded-xl p-3 sm:p-4 flex flex-col gap-0.5 sm:gap-1`}><span className="text-[10px] sm:text-xs uppercase tracking-wide opacity-70">{l}</span><span className="text-lg sm:text-2xl font-bold">{v}</span>{i&&<span className="opacity-50">{i}</span>}</div>;}
