// CLI: monitor-trades
// Monitors tracked wallets for new trades, creates ObservedTrade records.
//
// Usage: npx tsx src/cli/monitor-trades.ts [--since=1h] [--limit=50]

import { db, schema } from "@/db";
import { fetchWalletTrades } from "@/lib/adapters";
import { nowISO } from "@/lib/utils";
import { eq, and, gte } from "drizzle-orm";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  since: string; // e.g. "1h", "30m", or ISO timestamp
  limit: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { since: "1h", limit: 50 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--since=")) {
      args.since = arg.split("=")[1];
    } else if (arg.startsWith("--limit=")) {
      args.limit = parseInt(arg.split("=")[1], 10) || 50;
    }
  }
  return args;
}

function parseSince(since: string): string {
  // If it's already an ISO timestamp, use it directly
  if (since.includes("T")) return since;

  // Parse relative time: "1h", "30m", "2d", "1w"
  const match = since.match(/^(\d+)([hmdw])$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const ms = value * ({
      h: 3600_000,
      m: 60_000,
      d: 86_400_000,
      w: 604_800_000,
    }[unit] ?? 3600_000);
    return new Date(Date.now() - ms).toISOString();
  }

  // Default: 1 hour ago
  return new Date(Date.now() - 3600_000).toISOString();
}

async function main() {
  const args = parseArgs();
  const sinceTimestamp = parseSince(args.since);
  LOG(`monitor-trades starting (since=${sinceTimestamp}, limit=${args.limit})`);

  // 1. Fetch tracked wallets
  const wallets = db.select({
    address: schema.walletProfiles.address,
  })
    .from(schema.walletProfiles)
    .where(eq(schema.walletProfiles.status, "track"))
    .orderBy(schema.walletProfiles.globalScore)
    .limit(args.limit)
    .all();

  LOG(`Monitoring ${wallets.length} tracked wallets`);

  let totalTrades = 0;
  let newTrades = 0;
  let errors = 0;

  // 2. Fetch trades for each wallet
  for (const wallet of wallets) {
    try {
      const trades = await fetchWalletTrades(wallet.address, sinceTimestamp);
      totalTrades += trades.length;

      for (const trade of trades) {
        // Check if this trade is already recorded (dedupe by wallet+marketId+timestamp-ish)
        const existing = db.select({ id: schema.observedTrades.id })
          .from(schema.observedTrades)
          .where(
            and(
              eq(schema.observedTrades.walletAddress, wallet.address),
              eq(schema.observedTrades.marketId, trade.marketId),
              gte(schema.observedTrades.timestamp, sinceTimestamp),
            ),
          )
          .get();

        if (existing) continue;

        db.insert(schema.observedTrades).values({
          walletAddress: wallet.address,
          marketId: trade.marketId,
          conditionId: trade.conditionId,
          marketQuestion: trade.marketQuestion,
          marketCategory: trade.marketCategory,
          outcome: trade.outcome,
          side: trade.side,
          walletEntryPrice: trade.price,
          detectedPrice: trade.price,
          size: trade.size,
          timestamp: trade.timestamp,
          rawTradeJson: JSON.stringify(trade),
          createdAt: nowISO(),
        }).run();

        newTrades++;
      }
    } catch (e) {
      ERR(`Failed to monitor wallet ${wallet.address}`, e);
      errors++;
    }

    // Rate limiting
    if (wallets.indexOf(wallet) % 5 === 0 && wallets.indexOf(wallet) > 0) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // 3. Summary
  LOG("═══════════════════════════════════════════");
  LOG("  monitor-trades complete");
  LOG(`  Wallets monitored: ${wallets.length}`);
  LOG(`  Total trades fetched: ${totalTrades}`);
  LOG(`  New trades recorded: ${newTrades}`);
  LOG(`  Errors: ${errors}`);
  LOG("═══════════════════════════════════════════");
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
