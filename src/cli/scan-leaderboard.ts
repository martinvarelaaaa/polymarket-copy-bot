// CLI: scan-leaderboard
// Scans top 500 wallets from Polymarket leaderboard, creates WalletProfile records in DB.
//
// Usage: npx tsx src/cli/scan-leaderboard.ts [--lookback-days=30] [--count=500]

import { db, schema } from "@/db";
import { fetchLeaderboard, fetchWalletStats } from "@/lib/adapters";
import { nowISO, clamp, calculateOneHitWonderPenalty } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { DEFAULT_RULES } from "@/lib/constants";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  lookbackDays: number;
  count: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { lookbackDays: 30, count: 500 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--lookback-days=")) {
      args.lookbackDays = parseInt(arg.split("=")[1], 10) || 30;
    } else if (arg.startsWith("--count=")) {
      args.count = Math.min(parseInt(arg.split("=")[1], 10) || 500, 500);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  LOG(`scan-leaderboard starting (count=${args.count}, lookback=${args.lookbackDays}d)`);

  const scanId = await (async () => {
    try {
      const result = db.insert(schema.leaderboardScans).values({
        source: "polymarket",
        scannedAt: nowISO(),
        walletCount: 0,
        lookbackDays: args.lookbackDays,
      }).returning({ id: schema.leaderboardScans.id }).get();
      return result?.id ?? 1;
    } catch (e) {
      ERR("Failed to create scan record", e);
      return 0;
    }
  })();

  // 1. Fetch leaderboard
  LOG("Fetching leaderboard from Polymarket...");
  let leaders = await fetchLeaderboard(args.count);
  LOG(`Fetched ${leaders.length} leaderboard entries`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  // 2. Process each wallet
  for (const entry of leaders) {
    if (!entry.address) {
      errors++;
      continue;
    }

    try {
      // Fetch additional stats
      const stats = await fetchWalletStats(entry.address);

      // Build wallet profile data
      const roi30d = entry.roi ?? stats?.roi30d ?? null;
      const winRate = entry.winRate ?? stats?.winRate30d ?? null;
      const tradeCount = stats?.tradeCount30d ?? entry.trades ?? 0;
      const resolvedCount = stats?.resolvedTradeCount30d ?? 0;
      const avgSize = stats?.averageTradeSize ?? null;
      const bestCategory = stats?.bestCategory ?? null;

      // Scoring
      const consistencyScore = resolvedCount >= DEFAULT_RULES.scoring.min_resolved_trades
        ? clamp(winRate ?? 0, 0, 1)
        : clamp((winRate ?? 0) * (resolvedCount / DEFAULT_RULES.scoring.min_resolved_trades), 0, 1);

      const copyabilityScore = clamp(
        (avgSize ? Math.min(avgSize / 100, 1) : 0.5) * 0.5
        + (tradeCount > 10 ? 0.5 : tradeCount / 20),
        0, 1,
      );

      const oneHitPenalty = 0; // Will need resolved trade-level data to compute properly

      const globalScore = clamp(
        (roi30d ?? 0) * DEFAULT_RULES.scoring.roi_weight
        + consistencyScore * DEFAULT_RULES.scoring.consistency_weight
        + copyabilityScore * DEFAULT_RULES.scoring.copyability_weight,
        0, 1,
      );

      // Determine status
      let status: string;
      if (globalScore >= DEFAULT_RULES.scoring.track_threshold) status = "track";
      else if (globalScore >= DEFAULT_RULES.scoring.watch_threshold) status = "watch";
      else status = "ignore";

      const profileData = {
        address: entry.address,
        label: null,
        sourceRank: entry.rank,
        status,
        roi30d,
        consistencyScore,
        copyabilityScore,
        oneHitWonderPenalty: oneHitPenalty,
        globalScore,
        bestCategory,
        categoryStrengthsJson: stats ? JSON.stringify(stats.categoryStrengths) : null,
        averageTradeSize: avgSize,
        tradeCount30d: tradeCount,
        resolvedTradeCount30d: resolvedCount,
        winRate30d: winRate,
        averageLiquidity: null,
        averageSpread: null,
        averageEntryTiming: null,
        copyabilityNotes: null,
        riskNotes: null,
        lastScannedAt: nowISO(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      // Upsert: check if wallet already exists
      const existing = db.select({ id: schema.walletProfiles.id })
        .from(schema.walletProfiles)
        .where(eq(schema.walletProfiles.address, entry.address))
        .get();

      if (existing) {
        db.update(schema.walletProfiles)
          .set({ ...profileData, createdAt: undefined })
          .where(eq(schema.walletProfiles.address, entry.address))
          .run();
        updated++;
      } else {
        db.insert(schema.walletProfiles).values(profileData).run();
        created++;
      }
    } catch (e) {
      ERR(`Failed to process wallet ${entry.address}`, e);
      errors++;
    }

    // Small delay to avoid rate limiting
    if ((created + updated + errors) % 10 === 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // 3. Update scan record
  const total = created + updated;
  if (scanId > 0) {
    try {
      db.update(schema.leaderboardScans)
        .set({ walletCount: total, rawSummaryJson: JSON.stringify({ created, updated, errors, total }) })
        .where(eq(schema.leaderboardScans.id, scanId))
        .run();
    } catch { /* ignore */ }
  }

  // 4. Summary
  LOG("═══════════════════════════════════════════");
  LOG("  scan-leaderboard complete");
  LOG(`  Total leaderboard entries: ${leaders.length}`);
  LOG(`  Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
  LOG(`  Scan ID: ${scanId}`);
  LOG("═══════════════════════════════════════════");
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
