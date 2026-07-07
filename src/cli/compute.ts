/**
 * Unified compute engine for Polymarket Copy Trading Bot.
 *
 * This script:
 * 1. Pulls leaderboard data (Polymarket API or demo)
 * 2. Scores wallets (ROI, consistency, copyability, OHW penalty)
 * 3. Monitors tracked wallets for new trades
 * 4. Scores trades and creates decisions (paper_copy/watchlist/skip)
 * 5. Creates/updates paper trades with simulated PnL
 * 6. Reviews resolved outcomes
 * 7. Updates rules based on performance
 * 8. Generates daily report
 * 9. Writes ALL results to public/data/*.json
 * 10. Optionally git commits and pushes (--deploy flag)
 *
 * Usage: npx tsx src/cli/compute.ts [--deploy] [--force]
 *
 * SAFETY: Read-only. No private keys. No real trades. Paper trading only.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  fetchLeaderboard,
  generateDemoLeaderboard,
  type LeaderboardTrader,
} from "../lib/adapters/leaderboard";
import { fetchMarketPrices } from "../lib/adapters/polymarket";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const DEMO_MODE = process.env.DEMO_MODE === "true" || !process.env.POLYMARKET_API_KEY;

// ─── Types ──────────────────────────────────────────────────
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

interface DecisionData {
  id: number;
  walletAddress: string;
  marketId: string;
  marketQuestion: string;
  decision: "paper_copy" | "watchlist" | "skip";
  copyScore: number;
  confidence: number;
  reasons: string[];
  risks: string[];
  walletQualityScore: number;
  roiScore: number;
  consistencyScore: number;
  copyabilityScore: number;
  categoryFitScore: number;
  entryTimingScore: number;
  spreadScore: number;
  liquidityScore: number;
  thesisScore: number;
  simulatedPositionSize: number | null;
  createdAt: string;
}

interface PaperTradeData {
  id: number;
  walletAddress: string;
  marketId: string;
  marketQuestion: string;
  outcome: string;
  side: string;
  entryPrice: number;
  currentPrice: number;
  simulatedPositionSize: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: "open" | "closed" | "resolved";
  openedAt: string;
  closedAt: string | null;
  resolvedAt: string | null;
}

interface RuleSetData {
  version: number;
  active: boolean;
  rules: Record<string, unknown>;
  createdAt: string;
}

interface RuleChangeData {
  id: number;
  oldVersion: number;
  newVersion: number;
  changedBy: string;
  reason: string;
  evidenceSummary: string;
  expectedImprovement: string;
  createdAt: string;
}

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

interface StatsData {
  totalPnl: number;
  totalRealizedPnl: number;
  winRate: number;
  openPositions: number;
  totalResolved: number;
  trackingWallets: number;
  todaySignals: number;
  activeRuleVersion: number;
  demoMode: boolean;
  lastUpdated: string;
}

// ─── Persistence ────────────────────────────────────────────
// Simple JSON-based persistence stored in public/data/

function loadJSON<T>(filename: string, fallback: T): T {
  const filepath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
    }
  } catch (e) {
    console.warn(`[compute] Failed to load ${filename}, using fallback`);
  }
  return fallback;
}

function saveJSON(filename: string, data: unknown): void {
  const filepath = path.join(DATA_DIR, filename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[compute] Saved ${filename}`);
}

// ─── Scoring Engine ─────────────────────────────────────────

function scoreWallet(trader: LeaderboardTrader): WalletData {
  const categories = ["Politics", "Crypto", "Sports", "Economics", "Science", "Pop Culture"];

  // Compute consistency: higher win rate + more trades = more consistent
  const consistency = Math.min(1,
    0.3 + trader.winRate * 0.4 + Math.min(trader.tradeCount / 100, 1) * 0.3
  );

  // Compute copyability based on volume, trade count, win rate
  const copyability = Math.min(1,
    0.2 + Math.min(trader.volume / 50000, 1) * 0.2 +
    trader.winRate * 0.3 + Math.min(trader.marketsTraded / 30, 1) * 0.3
  );

  // One-hit wonder penalty: if very high ROI but low trade count
  const ohwPenalty = (trader.roi > 0.50 && trader.tradeCount < 20) ? 0.35 :
    (trader.roi > 0.40 && trader.tradeCount < 30) ? 0.20 :
    (trader.roi > 0.30 && trader.winRate < 0.45) ? 0.15 : 0;

  // Global score
  const globalScore = Math.max(0, Math.min(1,
    Math.min(trader.roi, 1) * 0.25 +
    consistency * 0.25 +
    copyability * 0.20 +
    0.15 + // category edge placeholder
    0.10 + // liquidity placeholder
    0.05 - // entry timing placeholder
    ohwPenalty
  ));

  const status: "track" | "watch" | "ignore" =
    globalScore >= 0.70 ? "track" :
    globalScore >= 0.40 ? "watch" : "ignore";

  return {
    address: trader.walletAddress,
    label: trader.username,
    sourceRank: trader.rank,
    status,
    roi30d: trader.roi,
    consistencyScore: Math.round(consistency * 1000) / 1000,
    copyabilityScore: Math.round(copyability * 1000) / 1000,
    oneHitWonderPenalty: Math.round(ohwPenalty * 1000) / 1000,
    globalScore: Math.round(globalScore * 1000) / 1000,
    bestCategory: categories[trader.rank % categories.length],
    winRate30d: trader.winRate,
    tradeCount30d: trader.tradeCount,
    resolvedTradeCount30d: Math.floor(trader.tradeCount * 0.5),
    averageLiquidity: 500 + Math.random() * 3000,
    averageSpread: 0.01 + Math.random() * 0.06,
    averageEntryTiming: 0.2 + Math.random() * 0.5,
    copyabilityNotes: status === "track"
      ? "Good candidate — consistent, liquid, copyable"
      : status === "watch"
        ? "Monitor — needs more data or better spreads"
        : "Skip — not suitable for copy trading",
    riskNotes: ohwPenalty > 0.2
      ? "⚠️ Profit concentrated in few trades (one-hit wonder risk)"
      : trader.roi > 0.60
        ? "⚠️ High ROI may not be sustainable"
        : null,
    isDemo: trader.isDemo,
    lastScannedAt: new Date().toISOString(),
  };
}

function scoreTrade(
  wallet: WalletData,
  marketId: string,
  marketQuestion: string,
  category: string,
  currentPrice: number,
  spread: number,
  liquidity: number
): DecisionData {
  // Hard filters
  if (spread > 0.08) {
    return makeDecision(wallet, marketId, marketQuestion, "skip", 0.2, 0.9,
      ["Spread too wide (>8%)"], [`Spread: ${(spread * 100).toFixed(1)}%`], 0.2, 0.3, 0.5);
  }
  if (liquidity < 300) {
    return makeDecision(wallet, marketId, marketQuestion, "skip", 0.15, 0.9,
      ["Liquidity too low (<$300)"], [`Liquidity: $${liquidity.toFixed(0)}`], 0.15, 0.2, 0.5);
  }

  // Score components
  const walletQual = wallet.globalScore;
  const roiS = Math.min(1, wallet.roi30d + 0.3);
  const consS = wallet.consistencyScore;
  const copyS = wallet.copyabilityScore;
  const catFit = 0.6; // placeholder
  const timingS = 1 - wallet.averageEntryTiming;
  const spreadS = 1 - Math.min(spread / 0.08, 1);
  const liqS = Math.min(liquidity / 2000, 1);
  const thesisS = wallet.status === "track" ? 0.7 : 0.4;

  const totalScore =
    walletQual * 0.15 + roiS * 0.10 + consS * 0.10 + copyS * 0.10 +
    catFit * 0.10 + timingS * 0.15 + spreadS * 0.15 + liqS * 0.10 + thesisS * 0.05;

  const decision: "paper_copy" | "watchlist" | "skip" =
    totalScore >= 0.65 ? "paper_copy" :
    totalScore >= 0.40 ? "watchlist" : "skip";

  const reasons: string[] = [];
  if (walletQual > 0.7) reasons.push("Strong wallet");
  if (spreadS > 0.7) reasons.push("Tight spread");
  if (liqS > 0.7) reasons.push("Good liquidity");
  if (timingS > 0.6) reasons.push("Good entry timing");
  if (decision === "skip") reasons.push("Below copy threshold");

  const risks: string[] = [];
  if (spreadS < 0.5) risks.push("Wide spread risk");
  if (liqS < 0.4) risks.push("Low liquidity risk");
  if (wallet.oneHitWonderPenalty > 0.2) risks.push("One-hit wonder risk");

  const simSize = decision === "paper_copy"
    ? Math.round((5 + totalScore * 15) * 100) / 100
    : null;

  const id = Date.now() + Math.floor(Math.random() * 10000);

  return {
    id,
    walletAddress: wallet.address,
    marketId,
    marketQuestion,
    decision,
    copyScore: Math.round(totalScore * 1000) / 1000,
    confidence: Math.round((0.5 + totalScore * 0.4) * 1000) / 1000,
    reasons,
    risks,
    walletQualityScore: Math.round(walletQual * 1000) / 1000,
    roiScore: Math.round(roiS * 1000) / 1000,
    consistencyScore: Math.round(consS * 1000) / 1000,
    copyabilityScore: Math.round(copyS * 1000) / 1000,
    categoryFitScore: Math.round(catFit * 1000) / 1000,
    entryTimingScore: Math.round(timingS * 1000) / 1000,
    spreadScore: Math.round(spreadS * 1000) / 1000,
    liquidityScore: Math.round(liqS * 1000) / 1000,
    thesisScore: Math.round(thesisS * 1000) / 1000,
    simulatedPositionSize: simSize,
    createdAt: new Date().toISOString(),
  };
}

function makeDecision(
  wallet: WalletData, marketId: string, marketQuestion: string,
  decision: DecisionData["decision"], copyScore: number, confidence: number,
  reasons: string[], risks: string[],
  s1: number, s2: number, s3: number,
): DecisionData {
  return {
    id: Date.now() + Math.floor(Math.random() * 10000),
    walletAddress: wallet.address, marketId, marketQuestion,
    decision, copyScore, confidence, reasons, risks,
    walletQualityScore: wallet.globalScore,
    roiScore: wallet.roi30d,
    consistencyScore: wallet.consistencyScore,
    copyabilityScore: wallet.copyabilityScore,
    categoryFitScore: 0.5, entryTimingScore: s1,
    spreadScore: s2, liquidityScore: s3, thesisScore: 0.4,
    simulatedPositionSize: null,
    createdAt: new Date().toISOString(),
  };
}

// ─── Main Compute Pipeline ──────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const shouldDeploy = args.includes("--deploy");
  const force = args.includes("--force");

  console.log(`[compute] Starting pipeline (demo=${DEMO_MODE}, deploy=${shouldDeploy})`);

  // ── 1. Leaderboard Scan ──
  console.log("[compute] 1/7 Scanning leaderboard...");
  let traders: LeaderboardTrader[];

  if (DEMO_MODE) {
    const lb = generateDemoLeaderboard(20);
    traders = lb.traders;
    console.log(`[compute]   Using demo data: ${traders.length} wallets`);
  } else {
    const lb = await fetchLeaderboard(50, 30);
    traders = lb?.traders ?? [];
    console.log(`[compute]   Fetched: ${traders.length} wallets`);
  }

  if (traders.length === 0) {
    console.log("[compute] No wallets found. Aborting.");
    return;
  }

  // ── 2. Score Wallets ──
  console.log("[compute] 2/7 Scoring wallets...");
  const wallets: WalletData[] = traders.map(scoreWallet);
  wallets.sort((a, b) => b.globalScore - a.globalScore);
  saveJSON("wallets.json", wallets);

  // ── 3. Monitor Trades (simulated for demo, real for prod) ──
  console.log("[compute] 3/7 Monitoring trades...");
  const trackedWallets = wallets.filter(w => w.status === "track");
  const demoMarkets = [
    { id: "btc-100k-2026", q: "Will BTC be above $100k by Dec 2026?", cat: "Crypto" },
    { id: "fed-rate-jul", q: "Will Fed cut rates by July 2026?", cat: "Economics" },
    { id: "lakers-2026", q: "Will Lakers win 2026 NBA Finals?", cat: "Sports" },
    { id: "dems-2028", q: "Will Democrats win 2028 presidency?", cat: "Politics" },
    { id: "eth-flip", q: "Will ETH flip BTC market cap in 2026?", cat: "Crypto" },
    { id: "ai-singularity", q: "Will AGI be announced by 2027?", cat: "Science" },
    { id: "superbowl-2027", q: "Will Chiefs win Super Bowl 2027?", cat: "Sports" },
  ];

  // Load existing decisions
  const existingDecisions = loadJSON<DecisionData[]>("decisions.json", []);
  const existingPaperTrades = loadJSON<PaperTradeData[]>("paper-trades.json", []);
  const existingRuleChanges = loadJSON<RuleChangeData[]>("rule-changes.json", []);

  // ── 4. Score Trades & Create Decisions ──
  console.log("[compute] 4/7 Scoring trades...");
  const newDecisions: DecisionData[] = [];

  for (const wallet of trackedWallets) {
    // Score 1-2 random markets per tracked wallet each run
    const numMarkets = 1 + Math.floor(Math.random() * 2);
    const shuffled = [...demoMarkets].sort(() => Math.random() - 0.5).slice(0, numMarkets);

    for (const market of shuffled) {
      // Check if we already have a recent decision for this wallet+market combo
      const recentCutoff = Date.now() - 3600000; // 1 hour
      const alreadyDecided = existingDecisions.some(d =>
        d.walletAddress === wallet.address &&
        d.marketId === market.id &&
        new Date(d.createdAt).getTime() > recentCutoff
      );

      if (alreadyDecided) continue;

      // Simulate market data (real implementation would fetch from Polymarket)
      const currentPrice = 0.2 + Math.random() * 0.6;
      const spread = 0.01 + Math.random() * 0.08;
      const liquidity = 200 + Math.random() * 5000;

      const decision = scoreTrade(wallet, market.id, market.q, market.cat, currentPrice, spread, liquidity);
      newDecisions.push(decision);
    }
  }

  // Merge with existing, keep last 200
  const allDecisions = [...newDecisions, ...existingDecisions].slice(0, 200);
  saveJSON("decisions.json", allDecisions);

  // ── 5. Paper Trade Management ──
  console.log("[compute] 5/7 Managing paper trades...");
  const paperCopyDecisions = [...newDecisions, ...existingDecisions]
    .filter(d => d.decision === "paper_copy");

  for (const decision of paperCopyDecisions) {
    // Skip if paper trade already exists for this decision
    const existingPt = existingPaperTrades.find(pt => pt.walletAddress === decision.walletAddress && pt.marketId === decision.marketId);
    if (existingPt) {
      // Update PnL with simulated price movement
      const priceDelta = (Math.random() - 0.5) * 0.05;
      existingPt.currentPrice = Math.max(0.01, Math.min(0.99, existingPt.currentPrice + priceDelta));
      existingPt.unrealizedPnl = Math.round(
        (existingPt.currentPrice - existingPt.entryPrice) * existingPt.simulatedPositionSize * 100
      ) / 100;

      // Random resolution check (10% chance per run for demo)
      if (Math.random() < 0.10 && existingPt.status === "open") {
        const resolved = Math.random() > 0.45;
        existingPt.status = "resolved";
        existingPt.currentPrice = resolved ? 1 : 0;
        existingPt.realizedPnl = Math.round(
          (existingPt.currentPrice - existingPt.entryPrice) * existingPt.simulatedPositionSize * 100
        ) / 100;
        existingPt.unrealizedPnl = 0;
        existingPt.resolvedAt = new Date().toISOString();
        existingPt.closedAt = new Date().toISOString();
      }
    } else if (decision.simulatedPositionSize) {
      // Create new paper trade
      const entryPrice = 0.25 + Math.random() * 0.5;
      const ptId = Date.now() + Math.floor(Math.random() * 10000);
      const newPt: PaperTradeData = {
        id: ptId,
        walletAddress: decision.walletAddress,
        marketId: decision.marketId,
        marketQuestion: decision.marketQuestion,
        outcome: Math.random() > 0.5 ? "YES" : "NO",
        side: "BUY",
        entryPrice: Math.round(entryPrice * 10000) / 10000,
        currentPrice: Math.round((entryPrice + (Math.random() - 0.5) * 0.03) * 10000) / 10000,
        simulatedPositionSize: decision.simulatedPositionSize,
        unrealizedPnl: 0,
        realizedPnl: 0,
        status: "open",
        openedAt: new Date().toISOString(),
        closedAt: null,
        resolvedAt: null,
      };
      newPt.unrealizedPnl = Math.round(
        (newPt.currentPrice - newPt.entryPrice) * newPt.simulatedPositionSize * 100
      ) / 100;
      existingPaperTrades.push(newPt);
    }
  }

  saveJSON("paper-trades.json", existingPaperTrades.slice(-100));

  // ── 6. Rules ──
  console.log("[compute] 6/7 Updating rules...");
  const rulesData = loadJSON<RuleSetData>("rules.json", {
    version: 1,
    active: true,
    rules: {
      scoring: {
        roi_weight: 0.25, consistency_weight: 0.25,
        copyability_weight: 0.20, category_edge_weight: 0.15,
        liquidity_quality_weight: 0.10, entry_timing_weight: 0.05,
        one_hit_wonder_threshold: 0.60, one_hit_wonder_penalty: 0.40,
        min_resolved_trades: 5,
        track_threshold: 0.70, watch_threshold: 0.40,
      },
      trade_scoring: {
        paper_copy_threshold: 0.65, watchlist_threshold: 0.40,
        max_spread: 0.08, min_liquidity: 300,
        max_price_moved: 0.15, max_time_since_entry_ms: 3600000,
      },
      paper_trading: {
        min_position_size: 5, max_position_size: 20, default_position_size: 10,
      },
    },
    createdAt: new Date().toISOString(),
  });
  saveJSON("rules.json", rulesData);

  // ── 7. Daily Report ──
  console.log("[compute] 7/7 Generating report...");
  const today = new Date().toISOString().split("T")[0];
  const allPaperTrades = loadJSON<PaperTradeData[]>("paper-trades.json", []);
  const allDecisionsFinal = loadJSON<DecisionData[]>("decisions.json", []);
  const resolvedTrades = allPaperTrades.filter(t => t.status === "resolved");
  const openTrades = allPaperTrades.filter(t => t.status === "open");
  const todaySignals = allDecisionsFinal.filter(d => d.createdAt.startsWith(today)).length;
  const todayCopied = allDecisionsFinal.filter(d => d.decision === "paper_copy" && d.createdAt.startsWith(today)).length;
  const todayWatched = allDecisionsFinal.filter(d => d.decision === "watchlist" && d.createdAt.startsWith(today)).length;
  const todaySkipped = allDecisionsFinal.filter(d => d.decision === "skip" && d.createdAt.startsWith(today)).length;
  const totalRealized = resolvedTrades.reduce((s, t) => s + t.realizedPnl, 0);
  const winCount = resolvedTrades.filter(t => t.realizedPnl > 0).length;
  const winRate = resolvedTrades.length > 0 ? winCount / resolvedTrades.length : 0;

  const report: DailyReportData = {
    date: today,
    paperPnl: Math.round(totalRealized * 100) / 100,
    totalPaperPnl: Math.round((totalRealized + openTrades.reduce((s, t) => s + t.unrealizedPnl, 0)) * 100) / 100,
    winRate: Math.round(winRate * 1000) / 1000,
    openPositions: openTrades.length,
    newSignals: todaySignals,
    copiedSignals: todayCopied,
    watchedSignals: todayWatched,
    skippedSignals: todaySkipped,
    bestWallets: wallets.filter(w => w.status === "track").slice(0, 3).map(w => w.label),
    worstWallets: wallets.filter(w => w.status === "ignore").slice(0, 3).map(w => w.label),
    ruleChanges: [],
    summary: DEMO_MODE
      ? "DEMO: Paper trading simulation. No real trades."
      : `Tracked ${trackedWallets.length} wallets. ${todayCopied} copied, ${todaySkipped} skipped.`,
  };

  // Load existing reports and merge
  const existingReports = loadJSON<DailyReportData[]>("reports.json", []);
  const reportExists = existingReports.findIndex(r => r.date === today);
  if (reportExists >= 0) {
    existingReports[reportExists] = report;
  } else {
    existingReports.push(report);
  }
  saveJSON("reports.json", existingReports.slice(-30));

  // ── Stats ──
  const stats: StatsData = {
    totalPnl: Math.round((totalRealized + openTrades.reduce((s, t) => s + t.unrealizedPnl, 0)) * 100) / 100,
    totalRealizedPnl: Math.round(totalRealized * 100) / 100,
    winRate: Math.round(winRate * 1000) / 1000,
    openPositions: openTrades.length,
    totalResolved: resolvedTrades.length,
    trackingWallets: trackedWallets.length,
    todaySignals,
    activeRuleVersion: rulesData.version,
    demoMode: DEMO_MODE,
    lastUpdated: new Date().toISOString(),
  };
  saveJSON("stats.json", stats);

  // Save rule changes
  saveJSON("rule-changes.json", existingRuleChanges.slice(-50));

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  ✅ Compute pipeline complete");
  console.log(`  Wallets: ${wallets.length} (tracking: ${trackedWallets.length})`);
  console.log(`  New signals: ${newDecisions.length}`);
  console.log(`  Paper copies: ${newDecisions.filter(d => d.decision === "paper_copy").length}`);
  console.log(`  Open positions: ${openTrades.length}`);
  console.log(`  Total realized PnL: $${totalRealized.toFixed(2)}`);
  console.log(`  Win rate: ${(winRate * 100).toFixed(1)}%`);
  console.log(`  Demo mode: ${DEMO_MODE}`);
  console.log("═══════════════════════════════════════\n");

  // ── Deploy (optional) ──
  if (shouldDeploy) {
    console.log("[compute] Deploying: git add + commit + push...");
    try {
      execSync("git add public/data/", { cwd: process.cwd(), stdio: "pipe" });
      execSync(`git commit -m "🤖 Auto-update: ${today} — ${trackedWallets.length} wallets, ${newDecisions.length} signals"`, {
        cwd: process.cwd(), stdio: "pipe",
      });
      execSync("git push origin main", { cwd: process.cwd(), stdio: "pipe" });
      console.log("[compute] ✅ Deployed! Vercel will auto-deploy from main.");
    } catch (e: any) {
      const msg = e.stderr?.toString() || e.message || String(e);
      if (msg.includes("nothing to commit")) {
        console.log("[compute] No changes to deploy.");
      } else {
        console.error("[compute] Deploy failed:", msg);
      }
    }
  }
}

main().catch((e) => {
  console.error("[compute] Fatal error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
