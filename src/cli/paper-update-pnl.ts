// CLI: paper-update-pnl
// Updates paper trade PnL every hour. Fetches current market prices, updates unrealized PnL.
//
// Usage: npx tsx src/cli/paper-update-pnl.ts [--batch=50]

import { db, schema } from "@/db";
import { fetchMarketPrices } from "@/lib/adapters";
import { nowISO } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  batch: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { batch: 50 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--batch=")) {
      args.batch = parseInt(arg.split("=")[1], 10) || 50;
    }
  }
  return args;
}

function calculateUnrealizedPnl(
  side: string | null,
  outcome: string | null,
  entryPrice: number,
  currentYesPrice: number,
  positionSize: number,
): number {
  if (!side || !outcome) return 0;

  const price = outcome === "YES" ? currentYesPrice : (1 - currentYesPrice);

  if (side === "BUY") {
    // Long position: profit if price goes up
    return ((price - entryPrice) / entryPrice) * positionSize;
  } else {
    // Short/sell position: profit if price goes down
    return ((entryPrice - price) / entryPrice) * positionSize;
  }
}

async function main() {
  const args = parseArgs();
  LOG(`paper-update-pnl starting (batch=${args.batch})`);

  // 1. Fetch open paper trades
  const openTrades = db.select()
    .from(schema.paperTrades)
    .where(eq(schema.paperTrades.status, "open"))
    .all();

  LOG(`Found ${openTrades.length} open paper trades`);

  if (openTrades.length === 0) {
    LOG("No open trades to update. Done.");
    return;
  }

  // 2. Batch fetch market prices for all unique market IDs
  const marketIds = [...new Set(openTrades.map((t) => t.marketId))];
  LOG(`Fetching prices for ${marketIds.length} unique markets...`);
  const prices = await fetchMarketPrices(marketIds);
  LOG(`Fetched prices for ${prices.size} markets`);

  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  let totalPnl = 0;

  // 3. Update each paper trade
  for (const trade of openTrades) {
    try {
      const marketPrice = prices.get(trade.marketId);

      if (!marketPrice) {
        unchanged++;
        continue;
      }

      const currentPrice = marketPrice.yesPrice;
      const unrealizedPnl = calculateUnrealizedPnl(
        trade.side,
        trade.outcome,
        trade.entryPrice,
        currentPrice,
        trade.simulatedPositionSize,
      );

      totalPnl += unrealizedPnl;

      // Update trade
      db.update(schema.paperTrades)
        .set({
          currentPrice,
          unrealizedPnl: Math.round(unrealizedPnl * 100) / 100, // Round to 2 decimal places
        })
        .where(eq(schema.paperTrades.id, trade.id))
        .run();

      // Create PnL snapshot (throttled: only if price changed significantly or hourly)
      const lastSnapshot = db.select({ price: schema.pnlSnapshots.price })
        .from(schema.pnlSnapshots)
        .where(eq(schema.pnlSnapshots.paperTradeId, trade.id))
        .orderBy(schema.pnlSnapshots.collectedAt)
        .limit(1)
        .all();

      const shouldSnapshot = lastSnapshot.length === 0
        || Math.abs((lastSnapshot[lastSnapshot.length - 1]?.price ?? 0) - currentPrice) > 0.005;

      if (shouldSnapshot) {
        db.insert(schema.pnlSnapshots).values({
          paperTradeId: trade.id,
          price: currentPrice,
          pnl: Math.round(unrealizedPnl * 100) / 100,
          collectedAt: nowISO(),
        }).run();
      }

      updated++;
    } catch (e) {
      ERR(`Failed to update PnL for trade ${trade.id}`, e);
      errors++;
    }
  }

  // 4. Summary
  LOG("═══════════════════════════════════════════");
  LOG("  paper-update-pnl complete");
  LOG(`  Open trades: ${openTrades.length}`);
  LOG(`  Markets priced: ${prices.size}/${marketIds.length}`);
  LOG(`  Updated: ${updated}, Unchanged: ${unchanged}, Errors: ${errors}`);
  LOG(`  Total unrealized PnL: $${totalPnl.toFixed(2)}`);
  LOG("═══════════════════════════════════════════");
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
