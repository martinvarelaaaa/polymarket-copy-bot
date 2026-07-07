// CLI: scan-wallets
// Updates wallet profiles with latest data (ROI, win rate, etc.)
//
// Usage: npx tsx src/cli/scan-wallets.ts [--status=track] [--limit=100]

import { db, schema } from "@/db";
import { fetchWalletStats } from "@/lib/adapters";
import { nowISO, clamp } from "@/lib/utils";
import { eq, or, isNull } from "drizzle-orm";
import { DEFAULT_RULES } from "@/lib/constants";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  status?: string;
  limit: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { limit: 100 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--status=")) {
      args.status = arg.split("=")[1];
    } else if (arg.startsWith("--limit=")) {
      args.limit = parseInt(arg.split("=")[1], 10) || 100;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  LOG(`scan-wallets starting (status=${args.status || "all"}, limit=${args.limit})`);

  // 1. Fetch wallets to update
  let query = db.select().from(schema.walletProfiles);

  if (args.status) {
    query = query.where(eq(schema.walletProfiles.status, args.status));
  } else {
    // Don't update ignored wallets, and prioritize wallets that haven't been scanned recently
    query = query.where(
      or(
        eq(schema.walletProfiles.status, "track"),
        eq(schema.walletProfiles.status, "watch"),
      ),
    );
  }

  // Order by last scanned (nulls first) then limit
  const wallets = query
    .orderBy(schema.walletProfiles.lastScannedAt)
    .limit(args.limit)
    .all();

  LOG(`Found ${wallets.length} wallets to update`);

  let updated = 0;
  let errors = 0;
  let skipped = 0;

  // 2. Update each wallet
  for (const wallet of wallets) {
    try {
      const stats = await fetchWalletStats(wallet.address);

      if (!stats || stats.tradeCount30d === 0) {
        // Still update lastScannedAt even if no stats
        db.update(schema.walletProfiles)
          .set({ lastScannedAt: nowISO(), updatedAt: nowISO() })
          .where(eq(schema.walletProfiles.address, wallet.address))
          .run();
        skipped++;
        continue;
      }

      // Recalculate scores with latest data
      const tradeCount = stats.tradeCount30d;
      const resolvedCount = stats.resolvedTradeCount30d;
      const winRate = stats.winRate30d;
      const roi = stats.roi30d;

      const consistencyScore = resolvedCount >= DEFAULT_RULES.scoring.min_resolved_trades
        ? clamp(winRate ?? 0, 0, 1)
        : clamp((winRate ?? 0) * (resolvedCount / DEFAULT_RULES.scoring.min_resolved_trades), 0, 1);

      const copyabilityScore = clamp(
        (stats.averageTradeSize ? Math.min(stats.averageTradeSize / 100, 1) : 0.5) * 0.5
        + (tradeCount > 10 ? 0.5 : tradeCount / 20),
        0, 1,
      );

      const globalScore = clamp(
        (roi ?? 0) * DEFAULT_RULES.scoring.roi_weight
        + consistencyScore * DEFAULT_RULES.scoring.consistency_weight
        + copyabilityScore * DEFAULT_RULES.scoring.copyability_weight,
        0, 1,
      );

      // Update status based on latest scores
      let status: string;
      if (globalScore >= DEFAULT_RULES.scoring.track_threshold) status = "track";
      else if (globalScore >= DEFAULT_RULES.scoring.watch_threshold) status = "watch";
      else status = "ignore";

      db.update(schema.walletProfiles)
        .set({
          roi30d: roi,
          winRate30d: winRate,
          tradeCount30d: tradeCount,
          resolvedTradeCount30d: resolvedCount,
          averageTradeSize: stats.averageTradeSize,
          bestCategory: stats.bestCategory,
          categoryStrengthsJson: JSON.stringify(stats.categoryStrengths),
          consistencyScore,
          copyabilityScore,
          globalScore,
          status,
          lastScannedAt: nowISO(),
          updatedAt: nowISO(),
        })
        .where(eq(schema.walletProfiles.address, wallet.address))
        .run();

      updated++;
    } catch (e) {
      ERR(`Failed to update wallet ${wallet.address}`, e);
      errors++;
    }

    if ((updated + errors + skipped) % 10 === 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // 3. Summary
  LOG("═══════════════════════════════════════════");
  LOG("  scan-wallets complete");
  LOG(`  Wallets processed: ${wallets.length}`);
  LOG(`  Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  LOG("═══════════════════════════════════════════");
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
