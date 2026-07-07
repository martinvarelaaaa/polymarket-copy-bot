// CLI: report-daily
// Generates end-of-day report, creates DailyReport record.
//
// Usage: npx tsx src/cli/report-daily.ts [--date=YYYY-MM-DD]

import { db, schema } from "@/db";
import { nowISO, toISODate, formatCurrency, formatPercent } from "@/lib/utils";
import { eq, gte, lt, and, sql, desc } from "drizzle-orm";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
const ERR = (msg: string, e?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, e ?? "");

interface CliArgs {
  date: string; // YYYY-MM-DD
}

function parseArgs(): CliArgs {
  const args: CliArgs = { date: toISODate() };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--date=")) {
      const d = arg.split("=")[1];
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) args.date = d;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  LOG(`report-daily starting (date=${args.date})`);

  const dayStart = `${args.date}T00:00:00.000Z`;
  const dayEnd = `${args.date}T23:59:59.999Z`;

  // Check if report already exists
  const existing = db.select({ id: schema.dailyReports.id })
    .from(schema.dailyReports)
    .where(eq(schema.dailyReports.date, args.date))
    .get();

  if (existing) {
    LOG(`Report for ${args.date} already exists (id=${existing.id}).`);
    // Continue anyway to regenerate
  }

  // ─── 1. Paper PnL ──────────────────────────────────
  const todayTrades = db.select({
    paperTrade: schema.paperTrades,
  })
    .from(schema.paperTrades)
    .where(
      and(
        gte(schema.paperTrades.openedAt, dayStart),
        lt(schema.paperTrades.openedAt, dayEnd),
      ),
    )
    .all();

  const todayPnl = todayTrades.reduce(
    (sum, { paperTrade }) => sum + (paperTrade.realizedPnl ?? 0) + (paperTrade.unrealizedPnl ?? 0),
    0,
  );

  // Total PnL across all paper trades
  const allTrades = db.select({ realizedPnl: schema.paperTrades.realizedPnl })
    .from(schema.paperTrades)
    .where(eq(schema.paperTrades.status, "resolved"))
    .all();
  const totalPaperPnl = allTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);

  // Win rate
  const resolvedToday = todayTrades.filter((t) => t.paperTrade.status === "resolved");
  const winsToday = resolvedToday.filter((t) => (t.paperTrade.realizedPnl ?? 0) > 0).length;
  const winRate = resolvedToday.length > 0 ? winsToday / resolvedToday.length : 0;

  // ─── 2. Positions ───────────────────────────────────
  const openPositions = db.select({ count: sql<number>`count(*)` })
    .from(schema.paperTrades)
    .where(eq(schema.paperTrades.status, "open"))
    .get()?.count ?? 0;

  // ─── 3. Signals ─────────────────────────────────────
  const todaysDecisions = db.select()
    .from(schema.decisionJournals)
    .where(
      and(
        gte(schema.decisionJournals.createdAt, dayStart),
        lt(schema.decisionJournals.createdAt, dayEnd),
      ),
    )
    .all();

  const newSignals = todaysDecisions.length;
  const copiedSignals = todaysDecisions.filter((d) => d.decision === "paper_copy").length;
  const watchedSignals = todaysDecisions.filter((d) => d.decision === "watchlist").length;
  const skippedSignals = todaysDecisions.filter((d) => d.decision === "skip").length;

  // ─── 4. Best/Worst wallets ──────────────────────────
  const topWallets = db.select()
    .from(schema.walletProfiles)
    .where(eq(schema.walletProfiles.status, "track"))
    .orderBy(desc(schema.walletProfiles.globalScore))
    .limit(5)
    .all();

  const bottomWallets = db.select()
    .from(schema.walletProfiles)
    .where(eq(schema.walletProfiles.status, "track"))
    .orderBy(schema.walletProfiles.globalScore)
    .limit(5)
    .all();

  // ─── 5. Rule changes today ──────────────────────────
  const todaysRuleChanges = db.select()
    .from(schema.ruleChanges)
    .where(
      and(
        gte(schema.ruleChanges.createdAt, dayStart),
        lt(schema.ruleChanges.createdAt, dayEnd),
      ),
    )
    .all();

  // ─── 6. Generate summary ────────────────────────────
  const summary = [
    `📊 Daily Report - ${args.date}`,
    ``,
    `💰 Financial:`,
    `  Day PnL:          ${formatCurrency(todayPnl)}`,
    `  Total Paper PnL:  ${formatCurrency(totalPaperPnl)}`,
    `  Win Rate (today): ${formatPercent(winRate)}`,
    ``,
    `📈 Activity:`,
    `  Open Positions:   ${openPositions}`,
    `  New Signals:      ${newSignals}`,
    `  Paper Copies:     ${copiedSignals}`,
    `  Watchlisted:      ${watchedSignals}`,
    `  Skipped:          ${skippedSignals}`,
    ``,
    `⭐ Top Wallets:`,
    ...topWallets.map((w) =>
      `  ${w.address.slice(0, 8)}... | Score: ${(w.globalScore ?? 0).toFixed(2)} | Status: ${w.status}`,
    ),
    ``,
    `🔄 Rule Changes: ${todaysRuleChanges.length}`,
    ...(todaysRuleChanges.length > 0
      ? todaysRuleChanges.map((rc) => `  - ${rc.reason.slice(0, 100)}`)
      : ["  No changes today"]),
  ].join("\n");

  // ─── 7. Save report ─────────────────────────────────
  try {
    if (existing) {
      db.update(schema.dailyReports)
        .set({
          paperPnl: Math.round(todayPnl * 100) / 100,
          totalPaperPnl: Math.round(totalPaperPnl * 100) / 100,
          winRate: Math.round(winRate * 1000) / 1000,
          openPositions,
          newSignals,
          copiedSignals,
          watchedSignals,
          skippedSignals,
          bestWalletsJson: JSON.stringify(topWallets.map((w) => ({
            address: w.address,
            score: w.globalScore,
            status: w.status,
          }))),
          worstWalletsJson: JSON.stringify(bottomWallets.map((w) => ({
            address: w.address,
            score: w.globalScore,
            status: w.status,
          }))),
          ruleChangesJson: JSON.stringify(todaysRuleChanges.map((rc) => ({
            reason: rc.reason,
            createdAt: rc.createdAt,
          }))),
          summary,
        })
        .where(eq(schema.dailyReports.id, existing.id))
        .run();

      LOG(`Updated existing report for ${args.date} (id=${existing.id})`);
    } else {
      db.insert(schema.dailyReports).values({
        date: args.date,
        paperPnl: Math.round(todayPnl * 100) / 100,
        totalPaperPnl: Math.round(totalPaperPnl * 100) / 100,
        winRate: Math.round(winRate * 1000) / 1000,
        openPositions,
        newSignals,
        copiedSignals,
        watchedSignals,
        skippedSignals,
        bestWalletsJson: JSON.stringify(topWallets.map((w) => ({
          address: w.address,
          score: w.globalScore,
          status: w.status,
        }))),
        worstWalletsJson: JSON.stringify(bottomWallets.map((w) => ({
          address: w.address,
          score: w.globalScore,
          status: w.status,
        }))),
        ruleChangesJson: JSON.stringify(todaysRuleChanges.map((rc) => ({
          reason: rc.reason,
          createdAt: rc.createdAt,
        }))),
        summary,
        sentToTelegram: false,
        createdAt: nowISO(),
      }).run();

      LOG(`Created new report for ${args.date}`);
    }
  } catch (e) {
    ERR("Failed to save daily report", e);
    return;
  }

  // ─── 8. Output summary to console ───────────────────
  LOG("═══════════════════════════════════════════");
  LOG(summary);
  LOG("═══════════════════════════════════════════");
  LOG("  report-daily complete");
}

main().catch((e) => {
  ERR("Fatal error", e);
  process.exit(1);
});
