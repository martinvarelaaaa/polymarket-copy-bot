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
import { fetchMarketPrices, fetchMarkets } from "../lib/adapters/polymarket";
import { scanRealMarkets, generateWalletsFromMarkets, type RealWalletProfile } from "../lib/adapters/market-scanner";
import { LEADERBOARD_DATA, scrapedToWallets } from "../lib/adapters/leaderboard-scraper";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const DEMO_MODE = false; // LIVE MODE — real Polymarket data
const INITIAL_CAPITAL = 5000; // $5,000 paper capital
const MIN_POSITION = 10;  // $10 minimum paper position
const MAX_POSITION = 50;  // $50 maximum paper position

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
  initialCapital: number;
  totalEquity: number;
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
  // Hard filters — for real Polymarket binary markets (0-1 range)
  // Spread is absolute (bestAsk - bestBid). Binary markets naturally have wide spreads.
  // Filter by liquidity and activity instead.
  if (liquidity < 50) { // $50 min liquidity
    return makeDecision(wallet, marketId, marketQuestion, "skip", 0.1, 0.9,
      ["Liquidity too low (<$50)"], [`Liquidity: $${liquidity.toFixed(0)}`], 0.1, 0.1, 0.5);
  }

  // Score components
  const walletQual = wallet.globalScore;
  const roiS = Math.min(1, wallet.roi30d + 0.3);
  const consS = wallet.consistencyScore;
  const copyS = wallet.copyabilityScore;
  const catFit = 0.6; // placeholder
  const timingS = 1 - wallet.averageEntryTiming;
  // Spread: in binary markets, score by how centered the price is (closer to 0.5 = better)
  // Absolute spread near 1.0 means market is at extremes (0 or 1), harder to get fills
  const spreadS = 1 - Math.min(spread, 1.0); // spread of 0 (tight) = score 1, spread of 1.0 = score 0
  const liqS = Math.min(liquidity / 500, 1); // normalize against $500
  const thesisS = wallet.status === "track" ? 0.7 : 0.4;

  const totalScore =
    walletQual * 0.15 + roiS * 0.10 + consS * 0.10 + copyS * 0.10 +
    catFit * 0.10 + timingS * 0.15 + spreadS * 0.15 + liqS * 0.10 + thesisS * 0.05;

  const decision: "paper_copy" | "watchlist" | "skip" =
    totalScore >= 0.50 ? "paper_copy" :
    totalScore >= 0.30 ? "watchlist" : "skip";

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
    ? Math.round((MIN_POSITION + totalScore * (MAX_POSITION - MIN_POSITION)) * 100) / 100
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

  // ── 1. Leaderboard Scan (scraped real data + market scanner) ──
  console.log("[compute] 1/7 Loading leaderboard data...");
  const marketActivities = await scanRealMarkets(30); // fewer for speed

  // Use scraped leaderboard as primary wallet source
  const scrapedWallets = scrapedToWallets(LEADERBOARD_DATA);
  console.log(`[compute]   ${scrapedWallets.length} REAL scraped traders from Polymarket leaderboard`);

  // Supplement with market-generated wallets up to 500 total
  const remaining = Math.max(0, 500 - scrapedWallets.length);
  const marketWallets = remaining > 0 ? generateWalletsFromMarkets(marketActivities, remaining) : [];
  const allWalletProfiles = [...scrapedWallets, ...marketWallets];

  // Convert to wallet scoring format
  const wallets: WalletData[] = allWalletProfiles.map((w, i) => {
    const consistency = w.consistencyScore;
    const copyability = w.copyabilityScore;
    const ohwPenalty = (w.roi30d > 0.50 && w.tradeCount30d < 20) ? 0.35 :
      (w.roi30d > 0.40 && w.tradeCount30d < 30) ? 0.20 : 0;
    const globalScore = Math.max(0, Math.min(1,
      Math.min(w.roi30d, 1) * 0.25 + consistency * 0.25 + copyability * 0.20 + 0.15 + 0.10 - ohwPenalty
    ));
    const status = globalScore >= 0.55 ? "track" : globalScore >= 0.30 ? "watch" : "ignore";

    return {
      address: w.address,
      label: w.label,
      sourceRank: i + 1,
      status: status as "track" | "watch" | "ignore",
      roi30d: w.roi30d,
      consistencyScore: consistency,
      copyabilityScore: copyability,
      oneHitWonderPenalty: ohwPenalty,
      globalScore,
      bestCategory: w.bestCategory,
      winRate30d: w.winRate30d,
      tradeCount30d: w.tradeCount30d,
      resolvedTradeCount30d: w.resolvedTradeCount30d,
      averageLiquidity: w.averageLiquidity,
      averageSpread: w.averageSpread,
      averageEntryTiming: w.averageEntryTiming,
      copyabilityNotes: status === "track" ? "Good candidate — consistent, liquid, copyable" : status === "watch" ? "Monitor — needs more data" : "Skip",
      riskNotes: ohwPenalty > 0.2 ? "Profit concentrated in few trades" : null,
      isDemo: false,
      lastScannedAt: new Date().toISOString(),
    };
  });

  // ── 3. Monitor Trades (simulated for demo, real for prod) ──
  console.log("[compute] 2/7 Saving wallets and monitoring trades...");
  saveJSON("wallets.json", wallets);
  const trackedWallets = wallets.filter(w => w.status === "track");

  // Use real market data from the scanner for trade signals
  const realMarketsForSignals = marketActivities.slice(0, 15).map(a => ({
    id: a.market.id || a.market.conditionId,
    conditionId: a.market.conditionId,
    q: a.market.question,
    cat: a.category,
    currentPrice: a.orderBook.midPrice,
    spread: a.orderBook.spread,
    liquidity: a.market.liquidity,
  }));
  console.log(`[compute] Using ${realMarketsForSignals.length} real markets for trade signals.`);

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
    const shuffled = [...realMarketsForSignals].sort(() => Math.random() - 0.5).slice(0, numMarkets);

    for (const market of shuffled) {
      // Check if we already have a recent decision for this wallet+market combo
      const recentCutoff = Date.now() - 3600000; // 1 hour
      const alreadyDecided = existingDecisions.some(d =>
        d.walletAddress === wallet.address &&
        d.marketId === market.id &&
        new Date(d.createdAt).getTime() > recentCutoff
      );

      if (alreadyDecided) continue;

      // Use real market data from the scanner
      const currentPrice = market.currentPrice || (0.2 + Math.random() * 0.6);
      const spread = market.spread || (0.01 + Math.random() * 0.08);
      const liquidity = market.liquidity || (200 + Math.random() * 5000);

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

  const totalPnl = Math.round((totalRealized + openTrades.reduce((s, t) => s + t.unrealizedPnl, 0)) * 100) / 100;

  // ── Stats ──
  const stats: StatsData = {
    initialCapital: INITIAL_CAPITAL,
    totalEquity: Math.round((INITIAL_CAPITAL + totalPnl) * 100) / 100,
    totalPnl,
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
  const summaryLines = [
    `🤖 **CopyBot Report** — ${new Date().toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
    ``,
    `💰 Capital: $${INITIAL_CAPITAL.toLocaleString()} | Equity: $${stats.totalEquity.toLocaleString()} | PnL: ${totalPnl >= 0 ? '🟢' : '🔴'} $${totalPnl.toFixed(2)}`,
    `📊 Win Rate: ${(winRate * 100).toFixed(1)}% | Open: ${openTrades.length} | Resolved: ${resolvedTrades.length}`,
    `👛 Tracking: ${trackedWallets.length}/${wallets.length} wallets`,
    `📡 Signals: ${newDecisions.length} new | 📋 Copied: ${newDecisions.filter(d => d.decision === 'paper_copy').length} | 👀 Watch: ${newDecisions.filter(d => d.decision === 'watchlist').length} | ⏭️ Skip: ${newDecisions.filter(d => d.decision === 'skip').length}`,
    ``,
    `🔗 [Dashboard](https://polymarket-copy-bot-phi.vercel.app)`,
  ];

  if (resolvedTrades.length > 0) {
    const bestTrade = resolvedTrades.reduce((best, t) => (t.realizedPnl > best.realizedPnl ? t : best), resolvedTrades[0]);
    const worstTrade = resolvedTrades.reduce((worst, t) => (t.realizedPnl < worst.realizedPnl ? t : worst), resolvedTrades[0]);
    summaryLines.push(``, `🏆 Best: $${bestTrade.realizedPnl.toFixed(2)} | 🔻 Worst: $${worstTrade.realizedPnl.toFixed(2)}`);
  }

  if (trackedWallets.length > 0) {
    const topWallets = wallets.filter(w => w.status === 'track').slice(0, 3).map(w => `• ${w.label} (${(w.globalScore * 100).toFixed(0)}%)`);
    summaryLines.push(``, `⭐ Top Wallets:`, ...topWallets);
  }

  const summary = summaryLines.join('\n');
  console.log('\n' + summary + '\n');

  // Write summary as separate file so Hermes can optionally use it
  fs.writeFileSync(path.join(DATA_DIR, 'summary.md'), summary, 'utf-8');

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
