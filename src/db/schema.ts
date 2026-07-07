import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

// ─── Leaderboard Scan ────────────────────────────────────────
export const leaderboardScans = sqliteTable(
  'leaderboard_scans',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull().default('polymarket'),
    scannedAt: text('scanned_at').notNull(),
    walletCount: integer('wallet_count').notNull(),
    lookbackDays: integer('lookback_days').notNull().default(30),
    rawSummaryJson: text('raw_summary_json'),
  },
  (t) => [index('idx_scan_scanned').on(t.scannedAt)],
);

// ─── Wallet Profile ─────────────────────────────────────────
export const walletProfiles = sqliteTable(
  'wallet_profiles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    address: text('address').notNull().unique(),
    label: text('label'),
    sourceRank: integer('source_rank'),
    status: text('status').notNull().default('watch'), // track | watch | ignore
    roi30d: real('roi_30d'),
    consistencyScore: real('consistency_score').default(0),
    copyabilityScore: real('copyability_score').default(0),
    oneHitWonderPenalty: real('one_hit_wonder_penalty').default(0),
    globalScore: real('global_score').default(0),
    bestCategory: text('best_category'),
    categoryStrengthsJson: text('category_strengths_json'),
    averageTradeSize: real('average_trade_size'),
    tradeCount30d: integer('trade_count_30d').default(0),
    resolvedTradeCount30d: integer('resolved_trade_count_30d').default(0),
    winRate30d: real('win_rate_30d'),
    averageLiquidity: real('average_liquidity'),
    averageSpread: real('average_spread'),
    averageEntryTiming: real('average_entry_timing'),
    copyabilityNotes: text('copyability_notes'),
    riskNotes: text('risk_notes'),
    lastScannedAt: text('last_scanned_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_wallet_status').on(t.status),
    index('idx_wallet_score').on(t.globalScore),
  ],
);

// ─── Observed Trade ─────────────────────────────────────────
export const observedTrades = sqliteTable(
  'observed_trades',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    walletAddress: text('wallet_address').notNull(),
    marketId: text('market_id').notNull(),
    conditionId: text('condition_id'),
    marketQuestion: text('market_question'),
    marketCategory: text('market_category'),
    outcome: text('outcome'), // YES | NO
    side: text('side'), // BUY | SELL
    walletEntryPrice: real('wallet_entry_price'),
    detectedPrice: real('detected_price'),
    size: real('size'),
    timestamp: text('timestamp').notNull(),
    rawTradeJson: text('raw_trade_json'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_trade_wallet').on(t.walletAddress),
    index('idx_trade_market').on(t.marketId),
  ],
);

// ─── Market Snapshot ────────────────────────────────────────
export const marketSnapshots = sqliteTable(
  'market_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    marketId: text('market_id').notNull(),
    conditionId: text('condition_id'),
    question: text('question'),
    category: text('category'),
    yesPrice: real('yes_price'),
    noPrice: real('no_price'),
    bestBid: real('best_bid'),
    bestAsk: real('best_ask'),
    spread: real('spread'),
    liquidity: real('liquidity'),
    volume: real('volume'),
    timeToResolution: text('time_to_resolution'),
    collectedAt: text('collected_at').notNull(),
    rawMarketJson: text('raw_market_json'),
  },
  (t) => [index('idx_market_snap').on(t.marketId, t.collectedAt)],
);

// ─── Decision Journal ───────────────────────────────────────
export const decisionJournals = sqliteTable(
  'decision_journals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    observedTradeId: integer('observed_trade_id').references(() => observedTrades.id),
    walletAddress: text('wallet_address').notNull(),
    marketId: text('market_id').notNull(),
    decision: text('decision').notNull(), // paper_copy | watchlist | skip
    copyScore: real('copy_score').default(0),
    confidence: real('confidence').default(0),
    reasonsJson: text('reasons_json'),
    risksJson: text('risks_json'),
    walletQualityScore: real('wallet_quality_score').default(0),
    roiScore: real('roi_score').default(0),
    consistencyScore: real('consistency_score').default(0),
    copyabilityScore: real('copyability_score').default(0),
    categoryFitScore: real('category_fit_score').default(0),
    entryTimingScore: real('entry_timing_score').default(0),
    spreadScore: real('spread_score').default(0),
    liquidityScore: real('liquidity_score').default(0),
    thesisScore: real('thesis_score').default(0),
    simulatedPositionSize: real('simulated_position_size'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_decision_wallet').on(t.walletAddress)],
);

// ─── Paper Trade ────────────────────────────────────────────
export const paperTrades = sqliteTable(
  'paper_trades',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    decisionJournalId: integer('decision_journal_id').references(() => decisionJournals.id),
    walletAddress: text('wallet_address').notNull(),
    marketId: text('market_id').notNull(),
    outcome: text('outcome'), // YES | NO
    side: text('side'), // BUY | SELL
    entryPrice: real('entry_price').notNull(),
    currentPrice: real('current_price'),
    simulatedPositionSize: real('simulated_position_size').notNull(),
    unrealizedPnl: real('unrealized_pnl').default(0),
    realizedPnl: real('realized_pnl').default(0),
    status: text('status').notNull().default('open'), // open | closed | resolved
    openedAt: text('opened_at').notNull(),
    closedAt: text('closed_at'),
    resolvedAt: text('resolved_at'),
  },
  (t) => [index('idx_paper_status').on(t.status)],
);

// ─── PnL Snapshot ───────────────────────────────────────────
export const pnlSnapshots = sqliteTable('pnl_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paperTradeId: integer('paper_trade_id').references(() => paperTrades.id),
  price: real('price').notNull(),
  pnl: real('pnl').notNull(),
  collectedAt: text('collected_at').notNull(),
});

// ─── Outcome Review ─────────────────────────────────────────
export const outcomeReviews = sqliteTable('outcome_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  decisionJournalId: integer('decision_journal_id').references(() => decisionJournals.id),
  paperTradeId: integer('paper_trade_id').references(() => paperTrades.id),
  reviewTime: text('review_time').notNull(),
  priceAfter1h: real('price_after_1h'),
  priceAfter6h: real('price_after_6h'),
  priceAfter24h: real('price_after_24h'),
  finalOutcome: text('final_outcome'),
  simulatedPnl: real('simulated_pnl'),
  wasDecisionGood: integer('was_decision_good', { mode: 'boolean' }),
  lessonsJson: text('lessons_json'),
  createdAt: text('created_at').notNull(),
});

// ─── Rule Set ───────────────────────────────────────────────
export const ruleSets = sqliteTable('rule_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  version: integer('version').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  rulesJson: text('rules_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Rule Change ────────────────────────────────────────────
export const ruleChanges = sqliteTable('rule_changes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  oldRuleSetId: integer('old_rule_set_id').references(() => ruleSets.id),
  newRuleSetId: integer('new_rule_set_id').references(() => ruleSets.id),
  changedBy: text('changed_by').notNull().default('hermes'),
  reason: text('reason').notNull(),
  evidenceSummary: text('evidence_summary'),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  expectedImprovement: text('expected_improvement'),
  createdAt: text('created_at').notNull(),
});

// ─── Daily Report ───────────────────────────────────────────
export const dailyReports = sqliteTable('daily_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  paperPnl: real('paper_pnl').default(0),
  totalPaperPnl: real('total_paper_pnl').default(0),
  winRate: real('win_rate').default(0),
  openPositions: integer('open_positions').default(0),
  newSignals: integer('new_signals').default(0),
  copiedSignals: integer('copied_signals').default(0),
  watchedSignals: integer('watched_signals').default(0),
  skippedSignals: integer('skipped_signals').default(0),
  bestWalletsJson: text('best_wallets_json'),
  worstWalletsJson: text('worst_wallets_json'),
  ruleChangesJson: text('rule_changes_json'),
  summary: text('summary'),
  sentToTelegram: integer('sent_to_telegram', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
});
