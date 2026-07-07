"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/overview", label: "📊 Overview", short: "Overview" },
  { href: "/wallets", label: "👛 Wallets", short: "Wallets" },
  { href: "/signals", label: "📡 Signals", short: "Signals" },
  { href: "/paper-trades", label: "📝 Paper", short: "Paper" },
  { href: "/journal", label: "📓 Journal", short: "Journal" },
  { href: "/performance", label: "📈 Perf", short: "Perf" },
  { href: "/rules", label: "⚙️ Rules", short: "Rules" },
  { href: "/reports", label: "📋 Reports", short: "Reports" },
];

export function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Close menu on ESC
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <>
      <nav className="border-b border-zinc-800 bg-zinc-900/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center">
          {/* Brand */}
          <a href="/overview" className="font-bold text-emerald-400 text-base sm:text-lg shrink-0 select-none">
            📊 CopyBot
          </a>

          {/* Desktop nav links */}
          <div className="hidden md:flex gap-1 ml-4 sm:ml-6 text-sm text-zinc-400">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-zinc-100 hover:bg-zinc-800/70 px-2 sm:px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
              >
                {l.short}
              </a>
            ))}
          </div>

          {/* Status indicator - desktop */}
          <div className="ml-auto hidden sm:flex items-center gap-2 text-xs text-zinc-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Paper Trading Only
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden ml-auto p-2.5 -mr-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800/70 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile Slide-out Sidebar ── */}
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[280px] max-w-[85vw] bg-zinc-900 border-l border-zinc-800 z-50 md:hidden transform transition-transform duration-300 ease-out shadow-2xl ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <span className="font-bold text-emerald-400 text-lg">📊 CopyBot</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-2 space-y-0.5">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100 transition-colors text-base font-medium"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="absolute bottom-4 left-3 right-3">
          <div className="flex items-center gap-2 text-xs text-zinc-600 bg-zinc-800/50 rounded-lg px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Paper Trading Only · No Real Trades
          </div>
        </div>
      </div>
    </>
  );
}
