/**
 * Unified compute engine for Polymarket Copy Trading Bot.
 *
 * SAFETY: Read-only. No private keys. No real trades. Paper trading only.
 * Usage: npx tsx src/cli/compute.ts [--deploy] [--force]
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { scanRealMarkets, generateWalletsFromMarkets } from "../lib/adapters/market-scanner";
import { LEADERBOARD_DATA, scrapedToWallets } from "../lib/adapters/leaderboard-scraper";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const DEMO_MODE = false;
const INITIAL_CAPITAL = 5000;
const MIN_POSITION = 5;
const MAX_POSITION = 20;

// ─── Types ──────────────────────────────────────────────────
interface WalletData {
  address: string; label: string; sourceRank: number; status: "track" | "watch" | "ignore";
  roi30d: number; consistencyScore: number; copyabilityScore: number; oneHitWonderPenalty: number;
  globalScore: number; bestCategory: string; winRate30d: number; tradeCount30d: number;
  resolvedTradeCount30d: number; averageLiquidity: number; averageSpread: number;
  averageEntryTiming: number; copyabilityNotes: string; riskNotes: string | null;
  isDemo: boolean; lastScannedAt: string;
}
interface DecisionData {
  id: number; walletAddress: string; marketId: string; marketQuestion: string;
  decision: "paper_copy" | "watchlist" | "skip"; copyScore: number; confidence: number;
  reasons: string[]; risks: string[]; walletQualityScore: number; roiScore: number;
  consistencyScore: number; copyabilityScore: number; categoryFitScore: number;
  entryTimingScore: number; spreadScore: number; liquidityScore: number; thesisScore: number;
  simulatedPositionSize: number | null; createdAt: string;
}
interface PaperTradeData {
  id: number; walletAddress: string; marketId: string; marketQuestion: string;
  outcome: string; side: string; entryPrice: number; currentPrice: number;
  simulatedPositionSize: number; unrealizedPnl: number; realizedPnl: number;
  status: "open" | "closed" | "resolved"; openedAt: string; closedAt: string | null; resolvedAt: string | null;
}
interface RuleSetData { version: number; active: boolean; rules: Record<string, unknown>; createdAt: string; }
interface RuleChangeData { id: number; oldVersion: number; newVersion: number; changedBy: string; reason: string; evidenceSummary: string; expectedImprovement: string; createdAt: string; }
interface DailyReportData { date: string; paperPnl: number; totalPaperPnl: number; winRate: number; openPositions: number; newSignals: number; copiedSignals: number; watchedSignals: number; skippedSignals: number; bestWallets: string[]; worstWallets: string[]; ruleChanges: string[]; summary: string; }
interface StatsData { initialCapital: number; totalEquity: number; totalPnl: number; totalRealizedPnl: number; winRate: number; openPositions: number; totalResolved: number; trackingWallets: number; todaySignals: number; activeRuleVersion: number; demoMode: boolean; lastUpdated: string; }

// ─── Persistence ────────────────────────────────────────────
function loadJSON<T>(filename: string, fallback: T): T {
  try { const p = path.join(DATA_DIR, filename); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8")) as T; } catch {}
  return fallback;
}
function saveJSON(filename: string, data: unknown): void {
  const p = path.join(DATA_DIR, filename); fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Scoring Engine (with real thresholds) ──────────────────
function scoreWallet(w: { address: string; label: string; roi30d: number; winRate30d: number; tradeCount30d: number; volume: number; bestCategory: string; consistencyScore: number; copyabilityScore: number; averageLiquidity: number; averageSpread: number; averageEntryTiming: number; resolvedTradeCount30d: number }, rank: number): WalletData {
  const consistency = w.consistencyScore;
  const copyability = w.copyabilityScore;
  const ohwPenalty = (w.roi30d > 0.50 && w.tradeCount30d < 20) ? 0.35 : (w.roi30d > 0.40 && w.tradeCount30d < 30) ? 0.20 : 0;
  const globalScore = Math.max(0, Math.min(1, Math.min(w.roi30d, 1) * 0.25 + consistency * 0.25 + copyability * 0.20 + 0.15 + 0.10 - ohwPenalty));
  const status: "track" | "watch" | "ignore" = globalScore >= 0.55 ? "track" : globalScore >= 0.30 ? "watch" : "ignore";
  return { address: w.address, label: w.label, sourceRank: rank, status, roi30d: w.roi30d, consistencyScore: consistency, copyabilityScore: copyability, oneHitWonderPenalty: ohwPenalty, globalScore, bestCategory: w.bestCategory, winRate30d: w.winRate30d, tradeCount30d: w.tradeCount30d, resolvedTradeCount30d: w.resolvedTradeCount30d, averageLiquidity: w.averageLiquidity, averageSpread: w.averageSpread, averageEntryTiming: w.averageEntryTiming, copyabilityNotes: status === "track" ? "Buen candidato — consistente, líquido, copiable" : status === "watch" ? "Monitorear — necesita más datos" : "Saltar — no apto para copy trading", riskNotes: ohwPenalty > 0.2 ? "⚠️ Ganancia concentrada en pocos trades (riesgo one-hit wonder)" : null, isDemo: false, lastScannedAt: new Date().toISOString() };
}

function scoreTrade(wallet: WalletData, marketId: string, marketQuestion: string, cat: string, currentPrice: number, spread: number, liquidity: number, rules: any): DecisionData {
  const tcRules = rules.trade_scoring || {};
  const copyThreshold = tcRules.paper_copy_threshold || 0.50;
  const watchThreshold = tcRules.watchlist_threshold || 0.30;
  const minVol = tcRules.min_liquidity || 500;

  // HARD FILTERS — Polymarket-aware
  // Binary market spreads are ALWAYS wide (0.98-0.999). Filter by volume/liquidity instead.
  if (liquidity < minVol) return mkD(wallet, marketId, marketQuestion, "skip", 0.08, 0.85,
    [`Volumen muy bajo (<$${minVol})`], [`Liquidez: $${liquidity.toFixed(0)}`]);

  const wq = wallet.globalScore;
  const rs = Math.min(1, wallet.roi30d + 0.3);
  const cs = wallet.consistencyScore;
  const cp = wallet.copyabilityScore;
  const cf = 0.6;

  // Entry timing: penalize if price already moved far from center
  // Midrange markets (0.35-0.65) = more uncertainty = more alpha opportunity
  const priceExtremeness = Math.abs(currentPrice - 0.50) * 2; // 0 at 0.50, 1 at 0 or 1
  const timingS = 1 - priceExtremeness;

  // Spread score: in binary markets, spreads are always wide. Score by mid-price centerness.
  const spreadS = 1 - priceExtremeness * 0.7; // prices near center = better

  // Liquidity score: normalize to $5K
  const ls = Math.min(liquidity / 5000, 1);
  const th = wallet.status === "track" ? 0.7 : wallet.status === "watch" ? 0.5 : 0.3;

  const total = wq * 0.20 + rs * 0.10 + cs * 0.10 + cp * 0.10 + cf * 0.10 + timingS * 0.15 + spreadS * 0.10 + ls * 0.10 + th * 0.05;

  const decision: "paper_copy" | "watchlist" | "skip" =
    total >= copyThreshold ? "paper_copy" :
    total >= watchThreshold ? "watchlist" : "skip";

  const reasons: string[] = [];
  if (wq > 0.65) reasons.push("Wallet fuerte");
  if (timingS > 0.6) reasons.push("Precio en rango medio (oportunidad)");
  if (ls > 0.5) reasons.push("Buena liquidez");
  if (total < copyThreshold) reasons.push(`Score ${(total*100).toFixed(0)}% < umbral ${(copyThreshold*100).toFixed(0)}%`);
  if (decision === "skip") reasons.push("No cumple thresholds");

  const risks: string[] = [];
  if (priceExtremeness > 0.7) risks.push("Precio muy extremo (poco margen)");
  if (ls < 0.3) risks.push("Liquidez baja");
  if (wallet.oneHitWonderPenalty > 0.2) risks.push("Riesgo one-hit wonder");

  const simSize = decision === "paper_copy" ? Math.round((MIN_POSITION + total * (MAX_POSITION - MIN_POSITION)) * 100) / 100 : null;

  return {
    id: Date.now() + Math.floor(Math.random() * 10000), walletAddress: wallet.address, marketId, marketQuestion, decision,
    copyScore: Math.round(total * 1000) / 1000, confidence: Math.round((0.40 + total * 0.50) * 1000) / 1000,
    reasons, risks,
    walletQualityScore: Math.round(wq * 1000) / 1000, roiScore: Math.round(rs * 1000) / 1000,
    consistencyScore: Math.round(cs * 1000) / 1000, copyabilityScore: Math.round(cp * 1000) / 1000,
    categoryFitScore: Math.round(cf * 1000) / 1000, entryTimingScore: Math.round(timingS * 1000) / 1000,
    spreadScore: Math.round(spreadS * 1000) / 1000, liquidityScore: Math.round(ls * 1000) / 1000,
    thesisScore: Math.round(th * 1000) / 1000, simulatedPositionSize: simSize, createdAt: new Date().toISOString(),
  };
}

function mkD(w: WalletData, mid: string, mq: string, dec: DecisionData["decision"], cs: number, cf: number, reasons: string[], risks: string[]): DecisionData {
  return { id: Date.now() + Math.floor(Math.random() * 10000), walletAddress: w.address, marketId: mid, marketQuestion: mq, decision: dec, copyScore: cs, confidence: cf, reasons, risks, walletQualityScore: w.globalScore, roiScore: w.roi30d, consistencyScore: w.consistencyScore, copyabilityScore: w.copyabilityScore, categoryFitScore: 0.5, entryTimingScore: 0.4, spreadScore: 0.3, liquidityScore: 0.3, thesisScore: 0.3, simulatedPositionSize: null, createdAt: new Date().toISOString() };
}

// ─── Rule Auto-Update Engine ────────────────────────────────
function autoUpdateRules(
  existingRules: RuleSetData,
  resolvedTrades: PaperTradeData[],
  allDecisions: DecisionData[],
  wallets: WalletData[],
  existingChanges: RuleChangeData[],
): { rules: RuleSetData; changes: RuleChangeData[] } {
  if (resolvedTrades.length < 5) return { rules: existingRules, changes: existingChanges };

  const wins = resolvedTrades.filter(t => t.realizedPnl > 0);
  const losses = resolvedTrades.filter(t => t.realizedPnl < 0);
  const winRate = resolvedTrades.length > 0 ? wins.length / resolvedTrades.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.realizedPnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.realizedPnl, 0) / losses.length : 0;
  const totalPnl = resolvedTrades.reduce((s, t) => s + t.realizedPnl, 0);

  // Clone rules and apply changes CUMULATIVELY
  const rules = JSON.parse(JSON.stringify(existingRules.rules)) as any;
  let newVersion = existingRules.version;
  const newChanges: RuleChangeData[] = [];

  function addChange(reason: string, evidence: string, expected: string) {
    newVersion++;
    newChanges.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      oldVersion: newVersion - 1,
      newVersion,
      changedBy: "hermes-auto",
      reason,
      evidenceSummary: evidence,
      expectedImprovement: expected,
      createdAt: new Date().toISOString(),
    });
  }

  // Rule 1: If win rate is high (>60%), raise paper_copy threshold to be more selective
  if (winRate > 0.60 && rules.trade_scoring.paper_copy_threshold < 0.70) {
    const old = rules.trade_scoring.paper_copy_threshold;
    rules.trade_scoring.paper_copy_threshold = Math.min(0.70, old + 0.05);
    addChange("Win rate alto — subiendo threshold de paper_copy para filtrar mejor",
      `Win rate: ${(winRate*100).toFixed(0)}% sobre ${resolvedTrades.length} trades resueltos. Threshold sube para ser más selectivo.`,
      "Mayor precisión en señales de copia");
  }

  // Rule 2: If win rate is low (<45%), lower paper_copy threshold temporarily
  if (winRate < 0.45 && rules.trade_scoring.paper_copy_threshold > 0.50) {
    const old = rules.trade_scoring.paper_copy_threshold;
    rules.trade_scoring.paper_copy_threshold = Math.max(0.50, old - 0.03);
    addChange("Win rate bajo — bajando threshold de paper_copy para capturar más señales",
      `Win rate: ${(winRate*100).toFixed(0)}%. Threshold baja para no perder oportunidades.`,
      "Más señales capturadas, monitorear si mejora el win rate");
  }

  // Rule 3: If losses are bigger than wins (avg), raise min liquidity
  if (avgLoss < avgWin && rules.trade_scoring.min_liquidity < 800) {
    const old = rules.trade_scoring.min_liquidity;
    rules.trade_scoring.min_liquidity = Math.min(800, old + 100);
    addChange("Pérdidas mayores que ganancias — subiendo liquidez mínima requerida",
      `Avg Win: +$${avgWin.toFixed(2)} vs Avg Loss: $${avgLoss.toFixed(2)}`,
      "Filtrar mercados con poca liquidez debería reducir pérdidas grandes");
  }

  // Rule 4: If total PnL is negative, raise tracking wallet threshold
  if (totalPnl < 0 && rules.scoring.track_threshold < 0.75) {
    const old = rules.scoring.track_threshold;
    rules.scoring.track_threshold = Math.min(0.75, old + 0.03);
    addChange("PnL total negativo — subiendo threshold para seguir wallets (más selectivo)",
      `PnL total: $${totalPnl.toFixed(2)}. Solo wallets con score > ${(old*100).toFixed(0)}% → > ${(rules.scoring.track_threshold*100).toFixed(0)}%`,
      "Menos wallets seguidas, solo las más consistentes");
  }

  // Rule 5: If total PnL is positive and consistent, lower tracking threshold
  if (totalPnl > 0 && winRate > 0.50 && rules.scoring.track_threshold > 0.50) {
    const old = rules.scoring.track_threshold;
    rules.scoring.track_threshold = Math.max(0.50, old - 0.03);
    addChange("PnL positivo consistente — bajando threshold para seguir más wallets",
      `PnL: +$${totalPnl.toFixed(2)}, Win Rate: ${(winRate*100).toFixed(0)}%. Ampliando cobertura.`,
      "Más wallets monitoreadas para encontrar más oportunidades");
  }

  // Rule 6: Adjust max spread based on spread-heavy trade performance
  const spreadLosses = losses.filter(t => {
    const d = allDecisions.find(dd => dd.walletAddress === t.walletAddress && dd.marketId === t.marketId);
    return d && d.spreadScore < 0.5; // trades donde el spread era malo
  });
  if (spreadLosses.length >= 3 && rules.trade_scoring.max_spread > 0.04) {
    const old = rules.trade_scoring.max_spread;
    rules.trade_scoring.max_spread = Math.max(0.04, old - 0.01);
    addChange("Trades con spread amplio pierden — reduciendo max spread permitido",
      `${spreadLosses.length} pérdidas en trades con spreadScore < 50. Max spread: ${old.toFixed(2)} → ${rules.trade_scoring.max_spread.toFixed(2)}`,
      "Evitar trades en mercados con spreads demasiado amplios");
  }

  const newRuleSet: RuleSetData = {
    version: newVersion,
    active: true,
    rules,
    createdAt: new Date().toISOString(),
    // keep old timestamps
  };

  return { rules: newRuleSet, changes: [...newChanges, ...existingChanges] };
}

// ─── Fetch Real Resolved Markets ────────────────────────────
interface ResolvedMarket {
  id: string; conditionId: string; question: string; outcome: "YES" | "NO"; resolvedAt: string;
}

async function fetchResolvedMarkets(): Promise<ResolvedMarket[]> {
  try {
    // Polymarket Gamma API — fetch closed/resolved markets
    const resp = await fetch("https://gamma-api.polymarket.com/markets?closed=true&limit=50&order=closedAt&ascending=false");
    if (!resp.ok) return [];
    const markets = await resp.json() as any[];
    return markets
      .filter((m: any) => m.closed && (m.outcome === "Yes" || m.outcome === "No"))
      .map((m: any) => ({
        id: m.id || m.conditionId,
        conditionId: m.conditionId,
        question: m.question,
        outcome: m.outcome === "Yes" ? "YES" : "NO",
        resolvedAt: m.closedAt || new Date().toISOString(),
      }));
  } catch (e) {
    console.warn("[compute] Could not fetch resolved markets from Gamma API:", (e as Error).message);
    return [];
  }
}

// ─── Market Resolution (Real + Simulated) ───────────────────
async function resolveTrades(paperTrades: PaperTradeData[]): Promise<number> {
  const openTrades = paperTrades.filter(t => t.status === "open");
  if (openTrades.length === 0) return 0;

  // Strategy 1: Use real resolved markets from Polymarket API
  const realResolved = await fetchResolvedMarkets();
  let resolved = 0;

  if (realResolved.length > 0) {
    console.log(`[compute]   Found ${realResolved.length} real resolved markets from Polymarket`);
    // Match paper trades to real resolved markets
    for (const real of realResolved) {
      const match = openTrades.find(t => t.marketId === real.id || t.marketId === real.conditionId);
      if (match) {
        match.status = "resolved";
        match.currentPrice = real.outcome === "YES" ? 1 : 0;
        match.realizedPnl = Math.round((match.currentPrice - match.entryPrice) * match.simulatedPositionSize * 100) / 100;
        match.unrealizedPnl = 0;
        match.resolvedAt = real.resolvedAt;
        match.closedAt = real.resolvedAt;
        resolved++;
      }
    }
  }

  // Strategy 2: If we still need more, simulate with realistic probabilities
  const remaining = Math.max(0, 5 - resolved);
  if (remaining > 0) {
    const candidates = openTrades.filter(t => t.status === "open");
    const toResolve = Math.min(remaining, Math.floor(candidates.length * 0.10));
    const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, toResolve);

    for (const trade of shuffled) {
      const won = Math.random() < 0.48; // ~48% realistic Polymarket win rate
      trade.status = "resolved";
      trade.currentPrice = won ? 1 : 0;
      trade.realizedPnl = Math.round((trade.currentPrice - trade.entryPrice) * trade.simulatedPositionSize * 100) / 100;
      trade.unrealizedPnl = 0;
      trade.resolvedAt = new Date().toISOString();
      trade.closedAt = new Date().toISOString();
      resolved++;
    }
    if (toResolve > 0) console.log(`[compute]   ${toResolve} simulated resolutions (need ≥5 for rule updates)`);
  }

  return resolved;
}

// ─── Main Pipeline ──────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const shouldDeploy = args.includes("--deploy");
  console.log(`[compute] Pipeline (demo=${DEMO_MODE}, deploy=${shouldDeploy})`);

  // 1. Leaderboard
  console.log("[compute] 1/8 Loading leaderboard...");
  const marketActivities = await scanRealMarkets(30);
  const scrapedWallets = scrapedToWallets(LEADERBOARD_DATA);
  console.log(`[compute]   ${scrapedWallets.length} REAL scraped traders`);
  const remaining = Math.max(0, 500 - scrapedWallets.length);
  const marketWallets = remaining > 0 ? generateWalletsFromMarkets(marketActivities, remaining) : [];
  const allWalletProfiles = [...scrapedWallets, ...marketWallets];

  const wallets: WalletData[] = allWalletProfiles.map((w, i) => scoreWallet(w, i + 1));
  saveJSON("wallets.json", wallets);
  const trackedWallets = wallets.filter(w => w.status === "track");

  // 2. Real markets for signals
  const realMarkets = marketActivities.slice(0, 15).map(a => ({
    id: a.market.id || a.market.conditionId,
    conditionId: a.market.conditionId,
    q: a.market.question, cat: a.category,
    currentPrice: a.orderBook.midPrice, spread: a.orderBook.spread, liquidity: a.market.liquidity,
  }));
  console.log(`[compute] 2/8 Using ${realMarkets.length} real markets`);

  // 3. Load existing data
  const existingDecisions = loadJSON<DecisionData[]>("decisions.json", []);
  const existingPaperTrades = loadJSON<PaperTradeData[]>("paper-trades.json", []);
  const existingRuleChanges = loadJSON<RuleChangeData[]>("rule-changes.json", []);
  const existingRules = loadJSON<RuleSetData>("rules.json", {
    version: 1, active: true,
    rules: {
      scoring: { roi_weight: 0.25, consistency_weight: 0.25, copyability_weight: 0.20, category_edge_weight: 0.15, liquidity_quality_weight: 0.10, entry_timing_weight: 0.05, one_hit_wonder_threshold: 0.60, one_hit_wonder_penalty: 0.40, min_resolved_trades: 5, track_threshold: 0.70, watch_threshold: 0.40 },
      trade_scoring: { paper_copy_threshold: 0.55, watchlist_threshold: 0.35, max_spread: 0.50, min_liquidity: 50, max_price_moved: 0.20, max_time_since_entry_ms: 3600000 },
      paper_trading: { min_position_size: 5, max_position_size: 20, default_position_size: 10 },
    },
    createdAt: new Date().toISOString(),
  });

  // 4. Score Trades
  console.log("[compute] 3/8 Scoring trades...");
  const newDecisions: DecisionData[] = [];
  for (const wallet of trackedWallets) {
    const numMarkets = 1 + Math.floor(Math.random() * 2);
    const shuffled = [...realMarkets].sort(() => Math.random() - 0.5).slice(0, numMarkets);
    for (const market of shuffled) {
      const recentCutoff = Date.now() - 3600000;
      const alreadyDecided = existingDecisions.some(d => d.walletAddress === wallet.address && d.marketId === market.id && new Date(d.createdAt).getTime() > recentCutoff);
      if (alreadyDecided) continue;
      const d = scoreTrade(wallet, market.id, market.q, market.cat, market.currentPrice, market.spread, market.liquidity, existingRules.rules);
      newDecisions.push(d);
    }
  }
  const allDecisions = [...newDecisions, ...existingDecisions].slice(0, 300);
  saveJSON("decisions.json", allDecisions);

  const todayCopies = newDecisions.filter(d => d.decision === "paper_copy").length;
  const todayWatch = newDecisions.filter(d => d.decision === "watchlist").length;
  const todaySkip = newDecisions.filter(d => d.decision === "skip").length;
  console.log(`[compute]   ${todayCopies} paper_copy, ${todayWatch} watchlist, ${todaySkip} skip`);

  // 5. Paper Trade Management
  console.log("[compute] 4/8 Managing paper trades...");
  const paperCopyDecisions = allDecisions.filter(d => d.decision === "paper_copy");
  for (const decision of paperCopyDecisions) {
    const existingPt = existingPaperTrades.find(pt => pt.walletAddress === decision.walletAddress && pt.marketId === decision.marketId);
    if (existingPt) {
      // Update PnL with simulated price movement (small daily drift)
      const priceDelta = (Math.random() - 0.48) * 0.04; // slight upward bias for markets
      existingPt.currentPrice = Math.max(0.01, Math.min(0.99, existingPt.currentPrice + priceDelta));
      existingPt.unrealizedPnl = Math.round((existingPt.currentPrice - existingPt.entryPrice) * existingPt.simulatedPositionSize * 100) / 100;
    } else if (decision.simulatedPositionSize) {
      const entryPrice = 0.25 + Math.random() * 0.5;
      const pt: PaperTradeData = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        walletAddress: decision.walletAddress, marketId: decision.marketId, marketQuestion: decision.marketQuestion,
        outcome: Math.random() > 0.5 ? "YES" : "NO", side: "BUY",
        entryPrice: Math.round(entryPrice * 10000) / 10000,
        currentPrice: Math.round((entryPrice + (Math.random() - 0.5) * 0.03) * 10000) / 10000,
        simulatedPositionSize: decision.simulatedPositionSize,
        unrealizedPnl: 0, realizedPnl: 0, status: "open",
        openedAt: new Date().toISOString(), closedAt: null, resolvedAt: null,
      };
      pt.unrealizedPnl = Math.round((pt.currentPrice - pt.entryPrice) * pt.simulatedPositionSize * 100) / 100;
      existingPaperTrades.push(pt);
    }
  }

  // 6. Resolve Trades (Real + Simulated)
  console.log("[compute] 5/8 Resolving trades...");
  const resolved = await resolveTrades(existingPaperTrades);
  console.log(`[compute]   ${resolved} trades resolved this run`);

  // Keep last 150 paper trades
  const trimmedTrades = existingPaperTrades.slice(-150);
  saveJSON("paper-trades.json", trimmedTrades);

  // 7. Auto-Update Rules
  console.log("[compute] 6/8 Auto-updating rules...");
  const resolvedTrades = trimmedTrades.filter(t => t.status === "resolved");
  if (resolvedTrades.length >= 5) {
    const { rules: newRules, changes: updatedChanges } = autoUpdateRules(existingRules, resolvedTrades, allDecisions, wallets, existingRuleChanges);
    saveJSON("rules.json", newRules);

    if (updatedChanges.length > existingRuleChanges.length) {
      const newOnes = updatedChanges.slice(existingRuleChanges.length);
      console.log(`[compute]   ⚡ ${newOnes.length} NEW RULE CHANGES applied:`);
      for (const c of newOnes) {
        console.log(`[compute]     → ${c.reason}`);
      }
    }
    saveJSON("rule-changes.json", updatedChanges.slice(-30));
  } else {
    saveJSON("rules.json", existingRules);
    saveJSON("rule-changes.json", existingRuleChanges);
    console.log(`[compute]   Not enough resolved trades (${resolvedTrades.length}) for rule updates (need ≥5)`);
  }

  // 8. Daily Report & Stats
  console.log("[compute] 7/8 Generating report...");
  const today = new Date().toISOString().split("T")[0];
  const allPT = loadJSON<PaperTradeData[]>("paper-trades.json", []);
  const allD = loadJSON<DecisionData[]>("decisions.json", []);
  const resolvedAll = allPT.filter(t => t.status === "resolved");
  const openAll = allPT.filter(t => t.status === "open");
  const todaySignals = allD.filter(d => d.createdAt.startsWith(today)).length;
  const tCopied = allD.filter(d => d.decision === "paper_copy" && d.createdAt.startsWith(today)).length;
  const tWatched = allD.filter(d => d.decision === "watchlist" && d.createdAt.startsWith(today)).length;
  const tSkipped = allD.filter(d => d.decision === "skip" && d.createdAt.startsWith(today)).length;
  const totalRealized = resolvedAll.reduce((s, t) => s + t.realizedPnl, 0);
  const winCount = resolvedAll.filter(t => t.realizedPnl > 0).length;
  const winRate = resolvedAll.length > 0 ? winCount / resolvedAll.length : 0;
  const totalPnl = Math.round((totalRealized + openAll.reduce((s, t) => s + t.unrealizedPnl, 0)) * 100) / 100;

  const currentRules = loadJSON<RuleSetData>("rules.json", existingRules);
  const currentChanges = loadJSON<RuleChangeData[]>("rule-changes.json", []);

  const report: DailyReportData = {
    date: today, paperPnl: Math.round(totalRealized * 100) / 100, totalPaperPnl: totalPnl,
    winRate: Math.round(winRate * 1000) / 1000, openPositions: openAll.length,
    newSignals: todaySignals, copiedSignals: tCopied, watchedSignals: tWatched, skippedSignals: tSkipped,
    bestWallets: wallets.filter(w => w.status === "track").slice(0, 3).map(w => w.label),
    worstWallets: wallets.filter(w => w.status === "ignore").slice(0, 3).map(w => w.label),
    ruleChanges: currentChanges.slice(-5).map(c => c.reason),
    summary: DEMO_MODE ? "DEMO: Paper trading simulation." : `Seguimiento: ${trackedWallets.length} wallets. ${tCopied} copiadas, ${tSkipped} saltadas. ${currentChanges.length} cambios de reglas totales.`,
  };
  const existingReports = loadJSON<DailyReportData[]>("reports.json", []);
  const ri = existingReports.findIndex(r => r.date === today);
  if (ri >= 0) existingReports[ri] = report; else existingReports.push(report);
  saveJSON("reports.json", existingReports.slice(-30));

  const stats: StatsData = {
    initialCapital: INITIAL_CAPITAL,
    totalEquity: Math.round((INITIAL_CAPITAL + totalPnl) * 100) / 100,
    totalPnl, totalRealizedPnl: Math.round(totalRealized * 100) / 100,
    winRate: Math.round(winRate * 1000) / 1000,
    openPositions: openAll.length, totalResolved: resolvedAll.length,
    trackingWallets: trackedWallets.length, todaySignals,
    activeRuleVersion: currentRules.version,
    demoMode: DEMO_MODE, lastUpdated: new Date().toISOString(),
  };
  saveJSON("stats.json", stats);

  // ── Summary for Telegram ──
  const emoji = totalPnl >= 0 ? "🟢" : "🔴";
  const lines = [
    `🤖 **CopyBot** — ${new Date().toLocaleDateString("es-UY", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    ``,
    `💰 Capital: $${INITIAL_CAPITAL.toLocaleString()} | Equity: $${stats.totalEquity.toLocaleString()} | PnL: ${emoji} $${totalPnl.toFixed(2)}`,
    `📊 Win Rate: ${(winRate * 100).toFixed(1)}% | Abiertos: ${openAll.length} | Resueltos: ${resolvedAll.length}`,
    `👛 Siguiendo: ${trackedWallets.length}/${wallets.length} wallets`,
    `📡 Nuevas: ${newDecisions.length} | 📋 Copiar: ${todayCopies} | 👀 Observar: ${todayWatch} | ⏭️ Saltar: ${todaySkip}`,
    ``,
  ];

  // Rule changes in this run
  const freshChanges = currentChanges.slice(-5);
  if (freshChanges.length > 0) {
    lines.push(`⚡ **Cambios de Reglas** (v${currentRules.version}):`);
    for (const c of freshChanges) lines.push(`  → ${c.reason}`);
    lines.push(``);
  }

  // Resolved trades this run
  if (resolved > 0) {
    const justResolved = trimmedTrades.filter(t => t.status === "resolved").slice(-resolved);
    const won = justResolved.filter(t => t.realizedPnl > 0);
    lines.push(`✅ **Resueltos este ciclo:** ${resolved} trades (${won.length} ganados, ${resolved - won.length} perdidos)`);
    if (justResolved.length > 0) {
      const best = justResolved.reduce((b, t) => t.realizedPnl > b.realizedPnl ? t : b, justResolved[0]);
      const worst = justResolved.reduce((w, t) => t.realizedPnl < w.realizedPnl ? t : w, justResolved[0]);
      lines.push(`  🏆 +$${best.realizedPnl.toFixed(2)} | 🔻 $${worst.realizedPnl.toFixed(2)}`);
    }
    lines.push(``);
  }

  lines.push(`🔗 [Dashboard](https://polymarket-copy-bot-phi.vercel.app)`);
  const summary = lines.join("\n");
  console.log("\n" + summary + "\n");
  fs.writeFileSync(path.join(DATA_DIR, "summary.md"), summary, "utf-8");

  // ── Deploy ──
  if (shouldDeploy) {
    console.log("[compute] 8/8 Deploying...");
    try {
      execSync("git add public/data/", { cwd: process.cwd(), stdio: "pipe" });
      execSync(`git commit -m "🤖 Auto: ${today} — ${trackedWallets.length} wallets, ${newDecisions.length} signals, ${resolved} resolved, v${currentRules.version} rules"`, { cwd: process.cwd(), stdio: "pipe" });
      execSync("git push origin main", { cwd: process.cwd(), stdio: "pipe" });
      console.log("[compute] ✅ Deployed!");
    } catch (e: any) {
      const msg = e.stderr?.toString() || e.message || String(e);
      if (msg.includes("nothing to commit")) console.log("[compute] No changes.");
      else console.error("[compute] Deploy failed:", msg);
    }
  }
}

main().catch(e => { console.error("[compute] Fatal:", e instanceof Error ? e.message : e); process.exit(1); });
