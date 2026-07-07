// CLI: update-rules
// Automatic rule updater. Analyzes performance data, adjusts thresholds.
//
// Usage: npx tsx src/cli/update-rules.ts [--dry-run]

import { db, schema } from "@/db";
import { nowISO, clamp } from "@/lib/utils";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { DEFAULT_RULES } from "@/lib/constants";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  return {
    dryRun: process.argv.includes("--dry-run"),
  };
}

async function main() {
  const args = parseArgs();
  LOG(`update-rules starting (dry-run=${args.dryRun})`);

  // 1. Load active rules
  const activeRuleSet = db.select()
    .from(schema.ruleSets)
    .where(eq(schema.ruleSets.active, true))
    .orderBy(desc(schema.ruleSets.version))
    .get();

  let currentRules = DEFAULT_RULES;
  let currentVersion = 1;

  if (activeRuleSet) {
    try {
      currentRules = JSON.parse(activeRuleSet.rulesJson);
      currentVersion = activeRuleSet.version;
    } catch {
      LOG("Failed to parse active rule set, using defaults");
    }
  }

  // Check if auto-update is enabled
  if (!currentRules.improvement?.auto_update_enabled) {
    LOG("Auto-update is disabled in current rules. Skipping.");
    return;
  }

  // 2. Gather performance data
  const minEvidence = currentRules.improvement?.min_evidence_trades ?? 10;

  // Count recent reviews
  const reviewCount = db.select({ count: sql<number>`count(*)` })
    .from(schema.outcomeReviews)
    .get();

  if (!reviewCount || reviewCount.count < minEvidence) {
    LOG(`Insufficient evidence: ${reviewCount?.count ?? 0} reviews (need ${minEvidence}). Skipping.`);
    return;
  }

  // Get recent reviews for analysis
  const recentReviews = db.select()
    .from(schema.outcomeReviews)
    .orderBy(desc(schema.outcomeReviews.reviewTime))
    .limit(100)
    .all();

  const goodCount = recentReviews.filter((r) => r.wasDecisionGood === true).length;
  const badCount = recentReviews.filter((r) => r.wasDecisionGood === false).length;
  const total = goodCount + badCount;
  const goodRatio = total > 0 ? goodCount / total : 0.5;

  LOG(`Performance analysis: ${goodCount}/${total} good decisions (${(goodRatio * 100).toFixed(1)}%)`);

  // 3. Propose rule changes
  const changes: Array<{ path: string; old: number; new: number; reason: string }> = [];
  const newRules = JSON.parse(JSON.stringify(currentRules)) as typeof currentRules;
  const lr = currentRules.improvement?.learning_rate ?? 0.05;

  // Adjust paper_copy threshold based on performance
  if (goodRatio > 0.75) {
    // Performing well - could lower thresholds to capture more trades
    const oldThreshold = newRules.trade_scoring.paper_copy_threshold;
    newRules.trade_scoring.paper_copy_threshold = clamp(oldThreshold - lr, 0.50, 0.90);
    if (newRules.trade_scoring.paper_copy_threshold !== oldThreshold) {
      changes.push({
        path: "trade_scoring.paper_copy_threshold",
        old: oldThreshold,
        new: newRules.trade_scoring.paper_copy_threshold,
        reason: `Good decision rate ${(goodRatio * 100).toFixed(1)}% > 75% - lowering threshold to capture more trades`,
      });
    }
  } else if (goodRatio < 0.50) {
    // Performing poorly - raise thresholds to be more selective
    const oldThreshold = newRules.trade_scoring.paper_copy_threshold;
    newRules.trade_scoring.paper_copy_threshold = clamp(oldThreshold + lr, 0.50, 0.90);
    if (newRules.trade_scoring.paper_copy_threshold !== oldThreshold) {
      changes.push({
        path: "trade_scoring.paper_copy_threshold",
        old: oldThreshold,
        new: newRules.trade_scoring.paper_copy_threshold,
        reason: `Good decision rate ${(goodRatio * 100).toFixed(1)}% < 50% - raising threshold to be more selective`,
      });
    }
  }

  // Adjust position size range based on volatility
  const avgPnl = recentReviews.reduce((sum, r) => sum + (r.simulatedPnl ?? 0), 0) / (recentReviews.length || 1);
  if (avgPnl > 2) {
    const oldMax = newRules.paper_trading.max_position_size;
    newRules.paper_trading.max_position_size = Math.min(oldMax + 2, 50);
    if (newRules.paper_trading.max_position_size !== oldMax) {
      changes.push({
        path: "paper_trading.max_position_size",
        old: oldMax,
        new: newRules.paper_trading.max_position_size,
        reason: `Average PnL $${avgPnl.toFixed(2)} > $2 - increasing max position size`,
      });
    }
  } else if (avgPnl < -1) {
    const oldMin = newRules.paper_trading.min_position_size;
    newRules.paper_trading.max_position_size = Math.max(oldMin, newRules.paper_trading.max_position_size - 2);
    if (newRules.paper_trading.max_position_size !== newRules.paper_trading.min_position_size) {
      changes.push({
        path: "paper_trading.max_position_size",
        old: oldMin,
        new: newRules.paper_trading.max_position_size,
        reason: `Average PnL $${avgPnl.toFixed(2)} < -$1 - decreasing max position size to limit risk`,
      });
    }
  }

  // Update rule version
  newRules.version = currentVersion + 1;

  // 4. Check daily change limit
  const today = nowISO().split("T")[0];
  const changesToday = db.select({ count: sql<number>`count(*)` })
    .from(schema.ruleChanges)
    .where(gte(schema.ruleChanges.createdAt, today))
    .get();

  const maxChangesToday = currentRules.improvement?.max_changes_per_day ?? 3;
  if ((changesToday?.count ?? 0) >= maxChangesToday) {
    LOG(`Max daily changes (${maxChangesToday}) reached. Skipping.`);
    return;
  }

  if (changes.length === 0) {
    LOG("No rule changes needed. Performance is within acceptable range.");
    return;
  }

  LOG(`Proposed ${changes.length} rule changes:`);
  for (const c of changes) {
    LOG(`  ${c.path}: ${c.old} → ${c.new} (${c.reason})`);
  }

  if (args.dryRun) {
    LOG("DRY RUN - no changes applied.");
    return;
  }

  // 5. Apply changes
  try {
    // Deactivate old rule set
    if (activeRuleSet) {
      db.update(schema.ruleSets)
        .set({ active: false, updatedAt: nowISO() })
        .where(eq(schema.ruleSets.id, activeRuleSet.id))
        .run();
    }

    // Create new rule set
    const newRuleSet = db.insert(schema.ruleSets).values({
      version: newRules.version,
      active: true,
      rulesJson: JSON.stringify(newRules, null, 2),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }).returning({ id: schema.ruleSets.id }).get();

    // Record changes
    if (newRuleSet) {
      db.insert(schema.ruleChanges).values({
        oldRuleSetId: activeRuleSet?.id ?? null,
        newRuleSetId: newRuleSet.id,
        changedBy: "hermes",
        reason: `Auto-update: ${changes.map((c) => c.reason).join("; ")}`,
        evidenceSummary: JSON.stringify({
          goodRatio,
          avgPnl,
          reviewCount: recentReviews.length,
          goodCount,
          badCount,
        }),
        beforeJson: JSON.stringify(currentRules),
        afterJson: JSON.stringify(newRules),
        expectedImprovement: changes.map((c) => c.reason).join(" | "),
        createdAt: nowISO(),
      }).run();
    }

    LOG(`Rule set v${newRules.version} activated with ${changes.length} changes.`);
  } catch (e) {
    ERR("Failed to apply rule changes", e);
    return;
  }

  // 6. Summary
  LOG("═══════════════════════════════════════════");
  LOG("  update-rules complete");
  LOG(`  Previous version: v${currentVersion}`);
  LOG(`  New version: v${newRules.version}`);
  LOG(`  Changes applied: ${changes.length}`);
  LOG(`  Performance: ${goodCount}/${total} good (${(goodRatio * 100).toFixed(1)}%)`);
  LOG("═══════════════════════════════════════════");
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
