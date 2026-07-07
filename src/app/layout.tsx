import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polymarket Copy Bot - Hermes Research Dashboard",
  description: "Paper-trading research system. No real trades. Not financial advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
            <a href="/overview" className="font-bold text-emerald-400 text-lg">📊 CopyBot</a>
            <div className="flex gap-4 text-sm text-zinc-400">
              <a href="/overview" className="hover:text-zinc-100 transition-colors">Overview</a>
              <a href="/wallets" className="hover:text-zinc-100 transition-colors">Wallets</a>
              <a href="/signals" className="hover:text-zinc-100 transition-colors">Signals</a>
              <a href="/paper-trades" className="hover:text-zinc-100 transition-colors">Paper Trades</a>
              <a href="/journal" className="hover:text-zinc-100 transition-colors">Journal</a>
              <a href="/performance" className="hover:text-zinc-100 transition-colors">Performance</a>
              <a href="/rules" className="hover:text-zinc-100 transition-colors">Rules</a>
              <a href="/reports" className="hover:text-zinc-100 transition-colors">Reports</a>
            </div>
            <div className="ml-auto text-xs text-zinc-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Paper Trading Only
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
