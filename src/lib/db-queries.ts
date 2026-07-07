// Dashboard API utilities - reads from SQLite DB
import { db, schema } from "@/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export async function getDashboardStats() {
  const openPaperTrades = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.paperTrades)
    .where(eq(schema.paperTrades.status, "open"))
    .get();

  const resolvedPaperTrades = db
    .select({ realizedPnl: schema.paperTrades.realizedPnl })
    .from(schema.paperTrades)
    .where(eq(schema.paperTrades.status, "resolved"))
    .all();

  const totalPnl = resolvedPaperTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const wins = resolvedPaperTrades.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const totalResolved = resolvedPaperTrades.length;
  const winRate = totalResolved > 0 ? wins / totalResolved : 0;

  const trackingWallets = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.walletProfiles)
    .where(eq(schema.walletProfiles.status, "track"))
    .get();

  const todaySignals = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.decisionJournals)
    .where(
      gte(
        schema.decisionJournals.createdAt,
        new Date().toISOString().split("T")[0]
      )
    )
    .get();

  const latestRules = db
    .select()
    .from(schema.ruleSets)
    .where(eq(schema.ruleSets.active, true))
    .orderBy(desc(schema.ruleSets.version))
    .limit(1)
    .get();

  return {
    totalPnl,
    winRate,
    openPositions: openPaperTrades?.count ?? 0,
    totalResolved,
    trackingWallets: trackingWallets?.count ?? 0,
    todaySignals: todaySignals?.count ?? 0,
    activeRuleVersion: latestRules?.version ?? 1,
  };
}

export async function getWallets(status?: string) {
  return db
    .select()
    .from(schema.walletProfiles)
    .where(status ? eq(schema.walletProfiles.status, status) : undefined)
    .orderBy(desc(schema.walletProfiles.globalScore))
    .limit(500)
    .all();
}

export async function getWalletByAddress(address: string) {
  return db
    .select()
    .from(schema.walletProfiles)
    .where(eq(schema.walletProfiles.address, address))
    .get();
}

export async function getDecisions(limit = 50) {
  return db
    .select()
    .from(schema.decisionJournals)
    .orderBy(desc(schema.decisionJournals.createdAt))
    .limit(limit)
    .all();
}

export async function getPaperTrades(limit = 50) {
  return db
    .select()
    .from(schema.paperTrades)
    .orderBy(desc(schema.paperTrades.openedAt))
    .limit(limit)
    .all();
}

export async function getObservations(limit = 50) {
  return db
    .select()
    .from(schema.observedTrades)
    .orderBy(desc(schema.observedTrades.timestamp))
    .limit(limit)
    .all();
}

export async function getRuleSets() {
  return db
    .select()
    .from(schema.ruleSets)
    .orderBy(desc(schema.ruleSets.version))
    .limit(20)
    .all();
}

export async function getRuleChanges(limit = 50) {
  return db
    .select()
    .from(schema.ruleChanges)
    .orderBy(desc(schema.ruleChanges.createdAt))
    .limit(limit)
    .all();
}

export async function getDailyReports(limit = 30) {
  return db
    .select()
    .from(schema.dailyReports)
    .orderBy(desc(schema.dailyReports.date))
    .limit(limit)
    .all();
}
