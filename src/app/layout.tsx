import type { Metadata } from "next";
import { NavBar } from "./navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polymarket Copy Bot — Hermes Research Dashboard",
  description: "Paper-trading research system. No real trades. Not financial advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <NavBar />
        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
      </body>
    </html>
  );
}
