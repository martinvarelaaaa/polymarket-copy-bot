"use client";
import { useEffect, useState } from "react";
import { CalendarDays, TrendingUp, Target, Activity, FileText, Star, AlertTriangle } from "lucide-react";

interface DailyReportData {
  date: string;
  paperPnl: number;
  totalPaperPnl: number;
  winRate: number;
  openPositions: number;
  newSignals: number;
  copiedSignals: number;
  watchedSignals: number;
  skippedSignals: number;
  bestWallets: string[];
  worstWallets: string[];
  ruleChanges: string[];
  summary: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/reports.json")
      .then((r) => r.json())
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading reports...</div>;

  const sortedReports = [...reports].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Aggregate totals
  const totalCopied = reports.reduce((s, r) => s + r.copiedSignals, 0);
  const totalSkipped = reports.reduce((s, r) => s + r.skippedSignals, 0);
  const totalSignals = reports.reduce((s, r) => s + r.newSignals, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📋 Daily Reports</h1>

      {/* Aggregate Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Reports</div>
          <div className="text-2xl font-bold">{reports.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Total Signals</div>
          <div className="text-2xl font-bold text-blue-400">{totalSignals}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wide">Total Copied</div>
          <div className="text-2xl font-bold text-emerald-300">{totalCopied}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="text-xs text-red-400 uppercase tracking-wide">Total Skipped</div>
          <div className="text-2xl font-bold text-red-300">{totalSkipped}</div>
        </div>
      </div>

      {/* Report Cards */}
      {sortedReports.length > 0 ? (
        <div className="space-y-4">
          {sortedReports.map((r) => (
            <div
              key={r.date}
              className={`bg-zinc-900 border rounded-xl overflow-hidden transition-colors ${
                expandedDate === r.date ? "border-zinc-600" : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {/* Report Header */}
              <button
                onClick={() => setExpandedDate(expandedDate === r.date ? null : r.date)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-800 rounded-lg p-2">
                    <CalendarDays className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-200">
                      {new Date(r.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </h3>
                    <span className="text-xs text-zinc-500">{r.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${r.paperPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.paperPnl >= 0 ? "+" : ""}${r.paperPnl.toFixed(2)}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Win Rate: {(r.winRate * 100).toFixed(1)}%
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedDate === r.date && (
                <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                  {/* Signal Breakdown */}
                  <div className="grid grid-cols-4 gap-2">
                    <SignalBox label="New Signals" value={r.newSignals} color="blue" />
                    <SignalBox label="Copied" value={r.copiedSignals} color="emerald" />
                    <SignalBox label="Watched" value={r.watchedSignals} color="yellow" />
                    <SignalBox label="Skipped" value={r.skippedSignals} color="red" />
                  </div>

                  {/* PnL Details */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-800/50 rounded p-3">
                      <div className="text-xs text-zinc-500">Paper PnL</div>
                      <div className={`text-lg font-bold ${r.paperPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        ${r.paperPnl.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-3">
                      <div className="text-xs text-zinc-500">Total PnL</div>
                      <div className={`text-lg font-bold ${r.totalPaperPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        ${r.totalPaperPnl.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Best & Worst Wallets */}
                  {(r.bestWallets.length > 0 || r.worstWallets.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <Star className="w-3 h-3" /> Best Wallets
                        </h4>
                        <ul className="space-y-0.5">
                          {r.bestWallets.map((w, i) => (
                            <li key={i} className="text-xs text-zinc-400">{w}</li>
                          ))}
                          {r.bestWallets.length === 0 && (
                            <li className="text-xs text-zinc-600">None tracked</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Worst Wallets
                        </h4>
                        <ul className="space-y-0.5">
                          {r.worstWallets.map((w, i) => (
                            <li key={i} className="text-xs text-zinc-400">{w}</li>
                          ))}
                          {r.worstWallets.length === 0 && (
                            <li className="text-xs text-zinc-600">None tracked</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {r.summary && (
                    <div className="bg-zinc-800/30 rounded p-3">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Summary
                      </h4>
                      <p className="text-sm text-zinc-300">{r.summary}</p>
                    </div>
                  )}

                  {/* Rule Changes */}
                  {r.ruleChanges.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-1">
                        Rule Changes ({r.ruleChanges.length})
                      </h4>
                      <ul className="space-y-0.5">
                        {r.ruleChanges.map((rc, i) => (
                          <li key={i} className="text-xs text-zinc-500">• {rc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-zinc-600 py-12">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg">No reports yet</p>
          <p className="text-sm mt-1">
            Run <code className="text-emerald-400">npm run compute</code> to generate the first daily report.
          </p>
        </div>
      )}
    </div>
  );
}

function SignalBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "yellow" | "red" | "blue";
}) {
  const colorMap = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <div className={`${colorMap[color]} border rounded p-3`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
