"use client";
import { useEffect, useState } from "react";
import { CalendarDays, FileText, Star, AlertTriangle } from "lucide-react";

interface DailyReportData { date: string; paperPnl: number; totalPaperPnl: number; winRate: number; openPositions: number; newSignals: number; copiedSignals: number; watchedSignals: number; skippedSignals: number; bestWallets: string[]; worstWallets: string[]; ruleChanges: string[]; summary: string; }

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string|null>(null);
  useEffect(()=>{fetch("/data/reports.json").then(r=>r.json()).then(setReports).catch(console.error).finally(()=>setLoading(false));},[]);
  if(loading) return <div className="text-zinc-500 p-4 sm:p-8 text-sm">Cargando reportes...</div>;
  const sorted=[...reports].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
  const tc=reports.reduce((s,r)=>s+r.copiedSignals,0),ts=reports.reduce((s,r)=>s+r.skippedSignals,0),tg=reports.reduce((s,r)=>s+r.newSignals,0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">📋 Reportes Diarios</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4"><div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide">Reportes</div><div className="text-lg sm:text-2xl font-bold">{reports.length}</div></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4"><div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide">Total Señales</div><div className="text-lg sm:text-2xl font-bold text-blue-400">{tg}</div></div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 sm:p-4"><div className="text-[10px] sm:text-xs text-emerald-400 uppercase tracking-wide">Total Copiadas</div><div className="text-lg sm:text-2xl font-bold text-emerald-300">{tc}</div></div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 sm:p-4"><div className="text-[10px] sm:text-xs text-red-400 uppercase tracking-wide">Total Saltadas</div><div className="text-lg sm:text-2xl font-bold text-red-300">{ts}</div></div>
      </div>
      {sorted.length>0?(
        <div className="space-y-3 sm:space-y-4">
          {sorted.map(r=><div key={r.date} className={`bg-zinc-900 border rounded-xl overflow-hidden transition-colors ${expandedDate===r.date?"border-zinc-600":"border-zinc-800 hover:border-zinc-700"}`}>
            <button onClick={()=>setExpandedDate(expandedDate===r.date?null:r.date)} className="w-full p-3 sm:p-4 flex items-center justify-between text-left hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center gap-2 sm:gap-3"><div className="bg-zinc-800 rounded-lg p-2"><CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400"/></div><div><h3 className="font-semibold text-sm sm:text-base text-zinc-200">{new Date(r.date+"T00:00:00").toLocaleDateString("es-UY",{weekday:"long",month:"long",day:"numeric"})}</h3><span className="text-[10px] sm:text-xs text-zinc-500">{r.date}</span></div></div>
              <div className="text-right"><div className={`text-base sm:text-lg font-bold ${r.paperPnl>=0?"text-emerald-400":"text-red-400"}`}>{r.paperPnl>=0?"+":""}${r.paperPnl.toFixed(2)}</div><div className="text-[10px] text-zinc-500">Win Rate: {(r.winRate*100).toFixed(1)}%</div></div>
            </button>
            {expandedDate===r.date&&(<div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t border-zinc-800 pt-3">
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                <SBx l="Nuevas Señales" v={r.newSignals} c="blue"/><SBx l="Copiadas" v={r.copiedSignals} c="emerald"/>
                <SBx l="Observadas" v={r.watchedSignals} c="yellow"/><SBx l="Saltadas" v={r.skippedSignals} c="red"/>
              </div>
              <div className="grid grid-cols-2 gap-2"><div className="bg-zinc-800/50 rounded p-2 sm:p-3"><div className="text-[10px] text-zinc-500">PnL del Día</div><div className={`text-base sm:text-lg font-bold ${r.paperPnl>=0?"text-emerald-400":"text-red-400"}`}>${r.paperPnl.toFixed(2)}</div></div><div className="bg-zinc-800/50 rounded p-2 sm:p-3"><div className="text-[10px] text-zinc-500">PnL Total</div><div className={`text-base sm:text-lg font-bold ${r.totalPaperPnl>=0?"text-emerald-400":"text-red-400"}`}>${r.totalPaperPnl.toFixed(2)}</div></div></div>
              {(r.bestWallets.length>0||r.worstWallets.length>0)&&<div className="grid grid-cols-2 gap-3"><div><h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1"><Star className="w-3 h-3"/>Mejores Wallets</h4><ul className="space-y-0.5">{r.bestWallets.map((w,i)=><li key={i} className="text-xs text-zinc-400">{w}</li>)}{r.bestWallets.length===0&&<li className="text-xs text-zinc-600">Ninguna</li>}</ul></div><div><h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Peores Wallets</h4><ul className="space-y-0.5">{r.worstWallets.map((w,i)=><li key={i} className="text-xs text-zinc-400">{w}</li>)}{r.worstWallets.length===0&&<li className="text-xs text-zinc-600">Ninguna</li>}</ul></div></div>}
              {r.summary&&<div className="bg-zinc-800/30 rounded p-3"><h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/>Resumen</h4><p className="text-sm text-zinc-300">{r.summary}</p></div>}
              {r.ruleChanges.length>0&&<div><h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-1">Cambios de Reglas ({r.ruleChanges.length})</h4><ul className="space-y-0.5">{r.ruleChanges.map((rc,i)=><li key={i} className="text-xs text-zinc-500">• {rc}</li>)}</ul></div>}
            </div>)}
          </div>)}
        </div>
      ):(<div className="text-center text-zinc-600 py-12"><FileText className="w-12 h-12 mx-auto mb-3 opacity-20"/><p className="text-lg">Sin reportes aún</p><p className="text-sm mt-1">Ejecutá <code className="text-emerald-400">npm run compute</code> para generar el primer reporte.</p></div>)}
    </div>
  );
}
function SBx({l,v,c}:{l:string;v:number;c:"emerald"|"yellow"|"red"|"blue"}){const cm={emerald:"bg-emerald-500/10 text-emerald-400 border-emerald-500/20",yellow:"bg-yellow-500/10 text-yellow-400 border-yellow-500/20",red:"bg-red-500/10 text-red-400 border-red-500/20",blue:"bg-blue-500/10 text-blue-400 border-blue-500/20"};return <div className={`${cm[c]} border rounded p-2 sm:p-3`}><div className="text-[10px] opacity-70">{l}</div><div className="text-base sm:text-lg font-bold mt-0.5">{v}</div></div>;}
