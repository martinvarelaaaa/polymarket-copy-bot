"use client";
import { useEffect, useState } from "react";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 p-8">Loading reports...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📋 Reports</h1>

      {reports.map((r: any) => (
        <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold">{r.date}</h3>
              <span className="text-xs text-zinc-500">
                {r.sentToTelegram ? "📤 Sent to Telegram" : "📝 Draft"}
              </span>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${(r.paperPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${(r.paperPnl || 0).toFixed(2)}
              </div>
              <div className="text-xs text-zinc-500">Win Rate: {((r.winRate || 0) * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs mb-3">
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-zinc-500">Open</div>
              <div className="font-mono">{r.openPositions}</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-zinc-500">Signals</div>
              <div className="font-mono">{r.newSignals}</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-zinc-500">Copied</div>
              <div className="font-mono text-emerald-400">{r.copiedSignals}</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-zinc-500">Skipped</div>
              <div className="font-mono text-red-400">{r.skippedSignals}</div>
            </div>
          </div>

          {r.summary && (
            <p className="text-sm text-zinc-400">{r.summary}</p>
          )}
        </div>
      ))}
      {reports.length === 0 && (
        <div className="text-center text-zinc-600 py-8">No reports yet. Run `npm run report:daily`.</div>
      )}
    </div>
  );
}
