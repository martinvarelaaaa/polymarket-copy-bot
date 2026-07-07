// CLI: review-outcomes
// Reviews resolved markets, creates OutcomeReview records.
//
// Usage: npx tsx src/cli/review-outcomes.ts [--limit=50]

import { db, schema } from "@/db";
import { fetchMarketOutcome, fetchMarketPriceAtTime } from "@/lib/adapters";
import { nowISO } from "@/lib/utils";
import { eq, and, isNull } from "drizzle-orm";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  limit: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { limit: 50 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--limit=")) {
      args.limit = parseInt(arg.split("=")[1], 10) || 50;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  LOG(`review-outcomes starting (limit=${args.limit})`);

  // 1. Fetch paper trades with decisions that need review
  //    (closed paper trades without outcome reviews)
  const tradesToReview = db.select({
    paperTrade: schema.paperTrades,
    decision: schema.decisionJournals,
  })
    .from(schema.paperTrades)
    .innerJoin(
      schema.decisionJournals,
      eq(schema.paperTrades.decisionJournalId, schema.decisionJournals.id),
    )
    .leftJoin(
      schema.outcomeReviews,
      eq(schema.paperTrades.id, schema.outcomeReviews.paperTradeId),
    )
    .where(
      and(
        eq(schema.paperTrades.status, "closed"),
        isNull(schema.outcomeReviews.id),
      ),
    )
    .limit(args.limit)
    .all();

  LOG(`Found ${tradesToReview.length} trades to review`);

  let reviewed = 0;
  let errors = 0;
  let goodDecisions = 0;
  let badDecisions = 0;

  // 2. Also check open trades whose markets may have resolved
  const openTrades = db.select({
    paperTrade: schema.paperTrades,
    decision: schema.decisionJournals,
  })
    .from(schema.paperTrades)
    .innerJoin(
      schema.decisionJournals,
      eq(schema.paperTrades.decisionJournalId, schema.decisionJournals.id),
    )
    .where(eq(schema.paperTrades.status, "open"))
    .limit(args.limit)
    .all();

  LOG(`Checking ${openTrades.length} open trades for resolution`);

  // Combine unique market IDs
  const allMarketIds = [
    ...new Set([
      ...tradesToReview.map((t) => t.paperTrade.marketId),
      ...openTrades.map((t) => t.paperTrade.marketId),
    ]),
  ];

  // 3. Check outcomes for all markets
  const outcomes = new Map<string, Awaited<ReturnType<typeof fetchMarketOutcome>>>();
  for (const marketId of allMarketIds) {
    try {
      const outcome = await fetchMarketOutcome(marketId);
      if (outcome?.resolved) {
        outcomes.set(marketId, outcome);
      }
    } catch { /* skip individual market errors */ }
  }

  LOG(`${outcomes.size} markets have resolved`);

  // 4. Process closed trades
  for (const { paperTrade, decision } of tradesToReview) {
    try {
      const outcome = outcomes.get(paperTrade.marketId);

      // Fetch price data at different timeframes for analysis
      const openTime = new Date(paperTrade.openedAt);
      const priceAfter1h = await fetchMarketPriceAtTime(
        paperTrade.marketId,
        new Date(openTime.getTime() + 3600_000).toISOString(),
      );
      const priceAfter6h = await fetchMarketPriceAtTime(
        paperTrade.marketId,
        new Date(openTime.getTime() + 6 * 3600_000).toISOString(),
      );
      const priceAfter24h = await fetchMarketPriceAtTime(
        paperTrade.marketId,
        new Date(openTime.getTime() + 24 * 3600_000).toISOString(),
      );

      // Determine if decision was good
      const lessons: string[] = [];
      let wasDecisionGood: boolean | null = null;

      if (outcome?.resolved && paperTrade.realizedPnl != null) {
        // If it was a paper_copy and had positive PnL, it was good
        // If it was a skip and the trade would have been profitable, it was a miss
        if (decision.decision === "paper_copy") {
          wasDecisionGood = paperTrade.realizedPnl > 0;
          if (!wasDecisionGood) {
            lessons.push("Paper copy resulted in a loss - review entry criteria");
          }
        } else if (decision.decision === "skip") {
          lessons.push("Trade was skipped - review scoring thresholds");
        } else if (decision.decision === "watchlist") {
          lessons.push("Trade was on watchlist - consider lowering thresholds");
        }

        if (priceAfter1h != null && priceAfter24h != null && priceAfter1h > 0) {
          const direction1h = priceAfter1h > paperTrade.entryPrice ? "up" : "down";
          const direction24h = priceAfter24h > paperTrade.entryPrice ? "up" : "down";
          lessons.push(`Short-term (1h): price moved ${direction1h}, 24h: ${direction24h}`);
        }
      } else {
        wasDecisionGood = null; // Unclear
      }

      db.insert(schema.outcomeReviews).values({
        decisionJournalId: decision.id,
        paperTradeId: paperTrade.id,
        reviewTime: nowISO(),
        priceAfter1h: priceAfter1h ?? undefined,
        priceAfter6h: priceAfter6h ?? undefined,
        priceAfter24h: priceAfter24h ?? undefined,
        finalOutcome: outcome?.outcome ?? null,
        simulatedPnl: paperTrade.realizedPnl ?? paperTrade.unrealizedPnl ?? 0,
        wasDecisionGood: wasDecisionGood ?? undefined,
        lessonsJson: JSON.stringify(lessons),
        createdAt: nowISO(),
      }).run();

      reviewed++;
      if (wasDecisionGood === true) goodDecisions++;
      else if (wasDecisionGood === false) badDecisions++;
    } catch (e) {
      ERR(`Failed to review trade ${paperTrade.id}`, e);
      errors++;
    }
  }

  // 5. Process open trades whose markets resolved
  for (const { paperTrade, decision } of openTrades) {
    const outcome = outcomes.get(paperTrade.marketId);
    if (!outcome?.resolved) continue;

    try {
      // Close the paper trade with realized PnL
      const finalPnl = calculateFinalPnl(paperTrade, outcome);
      db.update(schema.paperTrades)
        .set({
          status: "resolved",
          realizedPnl: Math.round(finalPnl * 100) / 100,
          closedAt: outcome.resolutionTime ?? nowISO(),
          resolvedAt: outcome.resolutionTime ?? nowISO(),
        })
        .where(eq(schema.paperTrades.id, paperTrade.id))
        .run();

      // Check if already reviewed
      const existingReview = db.select({ id: schema.outcomeReviews.id })
        .from(schema.outcomeReviews)
        .where(eq(schema.outcomeReviews.paperTradeId, paperTrade.id))
        .get();

      if (!existingReview) {
        const lessons: string[] = [];
        if (finalPnl > 0) {
          lessons.push("Paper copy was profitable - copy strategy working well");
        } else {
          lessons.push("Paper copy resulted in loss - consider adjusting entry criteria");
        }

        db.insert(schema.outcomeReviews).values({
          decisionJournalId: decision.id,
          paperTradeId: paperTrade.id,
          reviewTime: nowISO(),
          finalOutcome: outcome.outcome,
          simulatedPnl: Math.round(finalPnl * 100) / 100,
          wasDecisionGood: finalPnl > 0 ? true : (finalPnl < 0 ? false : undefined),
          lessonsJson: JSON.stringify(lessons),
          createdAt: nowISO(),
        }).run();

        reviewed++;
        if (finalPnl > 0) goodDecisions++;
        else if (finalPnl < 0) badDecisions++;
      }
    } catch (e) {
      ERR(`Failed to resolve trade ${paperTrade.id}`, e);
      errors++;
    }
  }

  // 6. Summary
  LOG("═══════════════════════════════════════════");
  LOG("  review-outcomes complete");
  LOG(`  Trades reviewed: ${reviewed}`);
  LOG(`  Good decisions: ${goodDecisions}, Bad decisions: ${badDecisions}`);
  LOG(`  Resolved markets: ${outcomes.size}`);
  LOG(`  Errors: ${errors}`);
  LOG("═══════════════════════════════════════════");
}

function calculateFinalPnl(
  trade: typeof schema.paperTrades.$inferSelect,
  outcome: NonNullable<Awaited<ReturnType<typeof fetchMarketOutcome>>>,
): number {
  if (!trade.side || !trade.outcome) return 0;

  const won =
    (trade.outcome === "YES" && outcome.outcome?.toLowerCase().includes("yes")) ||
    (trade.outcome === "NO" && outcome.outcome?.toLowerCase().includes("no"));

  if (trade.side === "BUY") {
    if (won) {
      // Bought YES at entryPrice, resolves to 1.0
      const payout = trade.outcome === "YES" ? 1 * trade.simulatedPositionSize : 1 * trade.simulatedPositionSize;
      return payout - (trade.entryPrice * trade.simulatedPositionSize);
    } else {
      return -(trade.entryPrice * trade.simulatedPositionSize);
    }
  } else {
    // SELL side
    if (won) {
      return trade.entryPrice * trade.simulatedPositionSize;
    } else {
      return -(trade.entryPrice * trade.simulatedPositionSize);
    }
  }
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
