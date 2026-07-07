// CLI: score-trades
// Scores new trades, creates DecisionJournal records (decision: paper_copy/watchlist/skip).
//
// Usage: npx tsx src/cli/score-trades.ts [--limit=100]

import { db, schema } from "@/db";
import { fetchMarketPrice } from "@/lib/adapters";
import { nowISO, clamp, weightedScore } from "@/lib/utils";
import { eq, and, isNull, asc } from "drizzle-orm";
import { DEFAULT_RULES } from "@/lib/constants";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  limit: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { limit: 100 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--limit=")) {
      args.limit = parseInt(arg.split("=")[1], 10) || 100;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  LOG(`score-trades starting (limit=${args.limit})`);

  // 1. Fetch active rule set
  const activeRules = db.select()
    .from(schema.ruleSets)
    .where(eq(schema.ruleSets.active, true))
    .orderBy(asc(schema.ruleSets.version))
    .get();

  let rules = DEFAULT_RULES;
  if (activeRules) {
    try {
      rules = JSON.parse(activeRules.rulesJson);
    } catch { /* use defaults */ }
  }

  // 2. Fetch observed trades without decisions
  const unscoredTrades = db.select({
    observed: schema.observedTrades,
    wallet: schema.walletProfiles,
  })
    .from(schema.observedTrades)
    .leftJoin(
      schema.walletProfiles,
      eq(schema.observedTrades.walletAddress, schema.walletProfiles.address),
    )
    .leftJoin(
      schema.decisionJournals,
      eq(schema.observedTrades.id, schema.decisionJournals.observedTradeId),
    )
    .where(isNull(schema.decisionJournals.id))
    .limit(args.limit)
    .all();

  LOG(`Found ${unscoredTrades.length} unscored trades`);

  let scored = 0;
  let paperCopy = 0;
  let watchlist = 0;
  let skipped = 0;
  let errors = 0;

  // 3. Score each trade
  for (const row of unscoredTrades) {
    const trade = row.observed;
    const wallet = row.wallet;

    try {
      if (!wallet) {
        // Wallet not in DB (unexpected), skip
        skipped++;
        continue;
      }

      // Fetch current market data
      const marketData = await fetchMarketPrice(trade.marketId);

      // ─── Calculate Scores ──────────────────────────

      // Wallet quality score (0-1)
      const walletQualityScore = wallet.globalScore ?? 0;

      // ROI score (0-1): normalize ROI
      const roiScore = clamp((wallet.roi30d ?? 0) + 1, 0, 2) / 2; // Map [-1, 1] to [0, 1]

      // Consistency score (0-1)
      const consistencyScore = wallet.consistencyScore ?? 0;

      // Copyability score (0-1)
      const copyabilityScore = wallet.copyabilityScore ?? 0;

      // Category fit: does wallet have strength in this category?
      let categoryFitScore = 0.5;
      if (wallet.categoryStrengthsJson && trade.marketCategory) {
        try {
          const strengths = JSON.parse(wallet.categoryStrengthsJson);
          const catScore = strengths[trade.marketCategory] ?? 0;
          categoryFitScore = clamp(catScore * 2, 0, 1); // Scale 0-0.5 to 0-1
        } catch { /* ignore */ }
      }

      // Entry timing score (0-1): how much has price moved since wallet entered?
      let entryTimingScore = 0.7;
      if (trade.detectedPrice != null && marketData) {
        const walletPrice = trade.walletEntryPrice ?? trade.detectedPrice;
        const currentPrice = trade.side === "BUY"
          ? (marketData.bestAsk || marketData.yesPrice)
          : (marketData.bestBid || marketData.yesPrice);
        if (walletPrice && walletPrice > 0) {
          const priceMove = Math.abs(currentPrice - walletPrice) / walletPrice;
          entryTimingScore = clamp(1 - priceMove / rules.trade_scoring.max_price_moved, 0, 1);
        }
      }

      // Spread score (0-1)
      let spreadScore = 0.5;
      if (marketData && marketData.spread != null) {
        spreadScore = clamp(1 - marketData.spread / rules.trade_scoring.max_spread, 0, 1);
      }

      // Liquidity score (0-1)
      let liquidityScore = 0.5;
      if (marketData && marketData.liquidity != null) {
        liquidityScore = clamp(marketData.liquidity / rules.trade_scoring.min_liquidity, 0, 1);
      }

      // Thesis score: based on market characteristics
      let thesisScore = 0.5;
      if (marketData) {
        thesisScore = clamp(
          (spreadScore * 0.3 + liquidityScore * 0.3 + entryTimingScore * 0.4),
          0, 1,
        );
      }

      // ─── Weighted Copy Score ───────────────────────
      const copyScore = weightedScore({
        walletQuality:   { value: walletQualityScore, weight: rules.trade_scoring.wallet_global_weight },
        roi:             { value: roiScore,           weight: 0.05 },
        consistency:     { value: consistencyScore,   weight: 0.05 },
        copyability:     { value: copyabilityScore,   weight: rules.trade_scoring.wallet_category_weight },
        categoryFit:     { value: categoryFitScore,   weight: 0.05 },
        entryTiming:     { value: entryTimingScore,   weight: rules.trade_scoring.entry_timing_weight },
        spread:          { value: spreadScore,        weight: rules.trade_scoring.spread_weight },
        liquidity:       { value: liquidityScore,     weight: rules.trade_scoring.liquidity_weight },
        thesis:          { value: thesisScore,        weight: rules.trade_scoring.thesis_weight },
      });

      // Confidence: how decisive is the signal
      const confidence = clamp(copyScore * 1.1, 0, 1);

      // ─── Decision ──────────────────────────────────
      let decision: string;
      if (copyScore >= rules.trade_scoring.paper_copy_threshold && copyScore > 0) {
        decision = "paper_copy";
      } else if (copyScore >= rules.trade_scoring.watchlist_threshold && copyScore > 0) {
        decision = "watchlist";
      } else {
        decision = "skip";
      }

      // ─── Simulated Position Size ──────────────────
      let positionSize = rules.paper_trading.default_position_size;
      if (rules.paper_trading.confidence_size_multiplier) {
        positionSize = Math.round(
          rules.paper_trading.min_position_size
          + (rules.paper_trading.max_position_size - rules.paper_trading.min_position_size) * confidence,
        );
      }

      // ─── Reasons & Risks ──────────────────────────
      const reasons: string[] = [];
      if (walletQualityScore >= 0.7) reasons.push("High wallet quality score");
      if (consistencyScore >= 0.7) reasons.push("Consistent performer");
      if (categoryFitScore >= 0.7) reasons.push("Wallet has edge in this category");
      if (entryTimingScore >= 0.7) reasons.push("Good entry timing (minimal price drift)");
      if (spreadScore >= 0.7) reasons.push("Tight spread");
      if (liquidityScore >= 0.7) reasons.push("Sufficient liquidity");

      const risks: string[] = [];
      if (spreadScore < 0.4) risks.push("Wide spread may impact profitability");
      if (liquidityScore < 0.4) risks.push("Low liquidity - may be hard to exit");
      if (entryTimingScore < 0.4) risks.push("Significant price movement since wallet entry");
      if (wallet.tradeCount30d != null && wallet.tradeCount30d < 5) risks.push("Low trade count - limited track record");

      // ─── Insert Decision ──────────────────────────
      db.insert(schema.decisionJournals).values({
        observedTradeId: trade.id,
        walletAddress: trade.walletAddress,
        marketId: trade.marketId,
        decision,
        copyScore,
        confidence,
        reasonsJson: JSON.stringify(reasons),
        risksJson: JSON.stringify(risks),
        walletQualityScore,
        roiScore,
        consistencyScore,
        copyabilityScore,
        categoryFitScore,
        entryTimingScore,
        spreadScore,
        liquidityScore,
        thesisScore,
        simulatedPositionSize: decision === "paper_copy" ? positionSize : null,
        createdAt: nowISO(),
      }).run();

      scored++;
      if (decision === "paper_copy") paperCopy++;
      else if (decision === "watchlist") watchlist++;
      else skipped++;

      // ─── Create Paper Trade for copies ────────────
      if (decision === "paper_copy" && trade.outcome != null && trade.side != null) {
        const decisionId = db.select({ id: schema.decisionJournals.id })
          .from(schema.decisionJournals)
          .where(
            and(
              eq(schema.decisionJournals.walletAddress, trade.walletAddress),
              eq(schema.decisionJournals.marketId, trade.marketId),
            ),
          )
          .orderBy(asc(schema.decisionJournals.createdAt))
          .get();

        if (decisionId) {
          const entryPrice = marketData
            ? (trade.side === "BUY" ? (marketData.bestAsk || marketData.yesPrice) : (marketData.bestBid || marketData.yesPrice))
            : (trade.detectedPrice ?? 0);

          db.insert(schema.paperTrades).values({
            decisionJournalId: decisionId.id,
            walletAddress: trade.walletAddress,
            marketId: trade.marketId,
            outcome: trade.outcome,
            side: trade.side,
            entryPrice,
            currentPrice: entryPrice,
            simulatedPositionSize: positionSize,
            unrealizedPnl: 0,
            realizedPnl: 0,
            status: "open",
            openedAt: nowISO(),
          }).run();
        }
      }
    } catch (e) {
      ERR(`Failed to score trade ${trade.id}`, e);
      errors++;
    }
  }

  // 4. Summary
  LOG("═══════════════════════════════════════════");
  LOG("  score-trades complete");
  LOG(`  Trades scored: ${scored}`);
  LOG(`  paper_copy: ${paperCopy}, watchlist: ${watchlist}, skip: ${skipped}`);
  LOG(`  Errors: ${errors}`);
  LOG("═══════════════════════════════════════════");
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
