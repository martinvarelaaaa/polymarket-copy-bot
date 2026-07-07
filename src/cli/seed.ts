// CLI: seed
// Seeds the database with demo data for development.
import { db, schema } from "../db";
import { nowISO, toISODate } from "../lib/utils";

const LOG = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function main() {
  LOG("Seeding demo data...");
  const now = nowISO();
  const today = toISODate();

  // Rule set v1
  LOG("  Creating rule set v1...");
  db.insert(schema.ruleSets).values({
    version: 1,
    active: true,
    rulesJson: JSON.stringify({
      scoring: { roi_weight: 0.25, consistency_weight: 0.25, copyability_weight: 0.20, category_edge_weight: 0.15, liquidity_quality_weight: 0.10, entry_timing_weight: 0.05, one_hit_wonder_threshold: 0.60, one_hit_wonder_penalty: 0.40, min_resolved_trades: 5, track_threshold: 0.70, watch_threshold: 0.40 },
      trade_scoring: { paper_copy_threshold: 0.65, watchlist_threshold: 0.40, max_spread: 0.08, min_liquidity: 300, max_price_moved: 0.15, max_time_since_entry_ms: 3600000 },
      paper_trading: { min_position_size: 5, max_position_size: 20, default_position_size: 10 },
    }),
    createdAt: now,
    updatedAt: now,
  }).run();

  // Demo wallets
  const demoWallets = [
    { addr: "0xDEMO_0001", name: "AlphaWhale_1", roi: 0.85, wr: 0.72, rank: 1 },
    { addr: "0xDEMO_0002", name: "BetMaster_2", roi: 0.62, wr: 0.68, rank: 2 },
    { addr: "0xDEMO_0003", name: "SignalTrader_3", roi: 0.55, wr: 0.64, rank: 3 },
    { addr: "0xDEMO_0004", name: "MarketMaven_4", roi: 0.48, wr: 0.61, rank: 4 },
    { addr: "0xDEMO_0005", name: "EdgeSeeker_5", roi: 0.41, wr: 0.59, rank: 5 },
    { addr: "0xDEMO_0006", name: "DataDriven_6", roi: 0.37, wr: 0.57, rank: 6 },
    { addr: "0xDEMO_0007", name: "TrendRider_7", roi: 0.32, wr: 0.55, rank: 7 },
    { addr: "0xDEMO_0008", name: "ValueHunter_8", roi: 0.28, wr: 0.53, rank: 8 },
    { addr: "0xDEMO_0009", name: "ProbPlayer_9", roi: 0.22, wr: 0.51, rank: 9 },
    { addr: "0xDEMO_0010", name: "QuantMind_10", roi: 0.18, wr: 0.50, rank: 10 },
    { addr: "0xDEMO_0011", name: "SwiftTrade_11", roi: 0.15, wr: 0.48, rank: 11 },
    { addr: "0xDEMO_0012", name: "LogicBet_12", roi: 0.12, wr: 0.47, rank: 12 },
    { addr: "0xDEMO_0013", name: "RiskWise_13", roi: 0.09, wr: 0.46, rank: 13 },
    { addr: "0xDEMO_0014", name: "ColdStart_14", roi: 0.06, wr: 0.45, rank: 14 },
    { addr: "0xDEMO_0015", name: "NewHorizon_15", roi: 0.03, wr: 0.44, rank: 15 },
    { addr: "0xDEMO_0016", name: "OneHitWonder_16", roi: 0.55, wr: 0.38, rank: 16 },
    { addr: "0xDEMO_0017", name: "IlliquidWhale_17", roi: 0.70, wr: 0.60, rank: 17 },
    { addr: "0xDEMO_0018", name: "LateEntry_18", roi: 0.30, wr: 0.48, rank: 18 },
    { addr: "0xDEMO_0019", name: "SpreadKiller_19", roi: 0.20, wr: 0.42, rank: 19 },
    { addr: "0xDEMO_0020", name: "SmallTime_20", roi: 0.05, wr: 0.41, rank: 20 },
  ];

  LOG(`  Creating ${demoWallets.length} wallet profiles...`);
  for (const w of demoWallets) {
    const consistency = Math.min(1, 0.4 + w.wr * 0.6 + (Math.random() - 0.5) * 0.1);
    const copyability = Math.min(1, 0.5 + w.roi * 0.5 + (Math.random() - 0.5) * 0.1);
    const ohwPenalty = w.name.includes("OneHit") ? 0.35 : w.roi > 0.60 && Math.random() > 0.7 ? 0.2 : 0;
    const globalScore = Math.max(0, Math.min(1,
      w.roi * 0.25 + consistency * 0.25 + copyability * 0.20 + 0.15 + 0.10 - ohwPenalty
    ));
    const status = globalScore >= 0.70 ? "track" : globalScore >= 0.40 ? "watch" : "ignore";

    db.insert(schema.walletProfiles).values({
      address: w.addr,
      label: w.name,
      sourceRank: w.rank,
      status,
      roi30d: w.roi,
      consistencyScore: consistency,
      copyabilityScore: copyability,
      oneHitWonderPenalty: ohwPenalty,
      globalScore,
      bestCategory: ["Politics", "Crypto", "Sports", "Economics"][w.rank % 4],
      categoryStrengthsJson: JSON.stringify({ Politics: 0.5 + Math.random() * 0.3, Crypto: 0.4 + Math.random() * 0.3 }),
      averageTradeSize: 30 + Math.random() * 300,
      tradeCount30d: Math.floor(30 + Math.random() * 200),
      resolvedTradeCount30d: Math.floor(10 + Math.random() * 80),
      winRate30d: w.wr,
      averageLiquidity: w.name.includes("Illiquid") ? 100 : 500 + Math.random() * 3000,
      averageSpread: w.name.includes("Spread") ? 0.12 : 0.01 + Math.random() * 0.06,
      averageEntryTiming: w.name.includes("Late") ? 0.8 : 0.2 + Math.random() * 0.5,
      copyabilityNotes: status === "track" ? "Good candidate for copy trading" : status === "watch" ? "Monitor for improvement" : "Skip - not suitable",
      riskNotes: ohwPenalty > 0.2 ? "Profit concentrated in few trades" : w.name.includes("Illiquid") ? "Low liquidity" : null,
      lastScannedAt: now,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  // Demo markets
  const markets = [
    { id: "market-demo-001", cid: "cond-001", q: "Will BTC be above $100k by Dec 2026?", cat: "Crypto" },
    { id: "market-demo-002", cid: "cond-002", q: "Will Fed cut rates by July 2026?", cat: "Economics" },
    { id: "market-demo-003", cid: "cond-003", q: "Will Lakers win 2026 NBA Finals?", cat: "Sports" },
    { id: "market-demo-004", cid: "cond-004", q: "Will Democrats win 2028 presidency?", cat: "Politics" },
    { id: "market-demo-005", cid: "cond-005", q: "Will ETH flip BTC market cap in 2026?", cat: "Crypto" },
  ];

  // Create observed trades and decisions for tracked wallets
  LOG("  Creating observed trades, decisions, and paper trades...");
  const tracked = demoWallets.filter(w => {
    const s = Math.max(0, Math.min(1, w.roi * 0.25 + 0.5 * 0.25 + 0.6 * 0.20 + 0.15 + 0.10));
    return s >= 0.70;
  });

  for (const w of tracked) {
    for (const m of markets.slice(0, 2)) {
      const price = 0.3 + Math.random() * 0.4;
      const ts = new Date(Date.now() - Math.random() * 86400000 * 5).toISOString();

      // Observed Trade
      const otResult = db.insert(schema.observedTrades).values({
        walletAddress: w.addr,
        marketId: m.id,
        conditionId: m.cid,
        marketQuestion: m.q,
        marketCategory: m.cat,
        outcome: Math.random() > 0.5 ? "YES" : "NO",
        side: Math.random() > 0.3 ? "BUY" : "SELL",
        walletEntryPrice: price,
        detectedPrice: price + (Math.random() - 0.5) * 0.02,
        size: 50 + Math.random() * 200,
        timestamp: ts,
        rawTradeJson: JSON.stringify({ source: "demo" }),
        createdAt: now,
      }).run();

      // Decision
      const decision = Math.random() > 0.6 ? "paper_copy" : Math.random() > 0.5 ? "watchlist" : "skip";
      const simSize = decision === "paper_copy" ? Math.round((5 + Math.random() * 15) * 100) / 100 : null;

      const djResult = db.insert(schema.decisionJournals).values({
        observedTradeId: Number(otResult.lastInsertRowid),
        walletAddress: w.addr,
        marketId: m.id,
        decision,
        copyScore: 0.4 + Math.random() * 0.5,
        confidence: 0.5 + Math.random() * 0.3,
        reasonsJson: JSON.stringify({ thesis: "Good setup", timing: "early entry" }),
        risksJson: JSON.stringify({ spread: "acceptable", liquidity: "adequate" }),
        walletQualityScore: 0.6 + Math.random() * 0.3,
        roiScore: 0.5 + Math.random() * 0.3,
        consistencyScore: 0.5 + Math.random() * 0.3,
        copyabilityScore: 0.5 + Math.random() * 0.3,
        categoryFitScore: 0.5 + Math.random() * 0.3,
        entryTimingScore: 0.4 + Math.random() * 0.3,
        spreadScore: 0.5 + Math.random() * 0.3,
        liquidityScore: 0.5 + Math.random() * 0.3,
        thesisScore: 0.5 + Math.random() * 0.3,
        simulatedPositionSize: simSize,
        createdAt: now,
      }).run();

      // Paper Trade for paper_copy decisions
      if (decision === "paper_copy") {
        const entryPrice = price + (Math.random() - 0.5) * 0.03;
        const currentPrice = entryPrice + (Math.random() - 0.5) * 0.06;
        const uPnl = Math.round((currentPrice - entryPrice) * (simSize || 10) * 100) / 100;

        db.insert(schema.paperTrades).values({
          decisionJournalId: Number(djResult.lastInsertRowid),
          walletAddress: w.addr,
          marketId: m.id,
          outcome: Math.random() > 0.5 ? "YES" : "NO",
          side: "BUY",
          entryPrice: Math.round(entryPrice * 10000) / 10000,
          currentPrice: Math.round(currentPrice * 10000) / 10000,
          simulatedPositionSize: simSize || 10,
          unrealizedPnl: uPnl,
          realizedPnl: 0,
          status: "open",
          openedAt: ts,
        }).run();

        // Some resolved trades
        if (Math.random() > 0.5) {
          const won = Math.random() > 0.4;
          const resPrice = won ? 1.0 : 0.0;
          const rPnl = Math.round((resPrice - entryPrice) * (simSize || 10) * 100) / 100;
          db.insert(schema.paperTrades).values({
            decisionJournalId: Number(djResult.lastInsertRowid),
            walletAddress: w.addr,
            marketId: m.id,
            outcome: won ? "YES" : "NO",
            side: "BUY",
            entryPrice: Math.round(entryPrice * 10000) / 10000,
            currentPrice: resPrice,
            simulatedPositionSize: simSize || 10,
            realizedPnl: rPnl,
            unrealizedPnl: 0,
            status: "resolved",
            openedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
            resolvedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          }).run();
        }
      }
    }
  }

  // Market snapshots
  LOG("  Creating market snapshots...");
  for (const m of markets) {
    db.insert(schema.marketSnapshots).values({
      marketId: m.id,
      conditionId: m.cid,
      question: m.q,
      category: m.cat,
      yesPrice: 0.3 + Math.random() * 0.4,
      noPrice: 0.3 + Math.random() * 0.4,
      bestBid: 0.30 + Math.random() * 0.1,
      bestAsk: 0.33 + Math.random() * 0.1,
      spread: 0.02 + Math.random() * 0.03,
      liquidity: 500 + Math.random() * 5000,
      volume: 10000 + Math.random() * 50000,
      timeToResolution: "15 days",
      collectedAt: now,
      rawMarketJson: JSON.stringify({ source: "demo" }),
    }).run();
  }

  // Daily report
  LOG("  Creating demo daily report...");
  db.insert(schema.dailyReports).values({
    date: today,
    paperPnl: -2.34,
    totalPaperPnl: 15.67,
    winRate: 0.55,
    openPositions: 3,
    newSignals: 12,
    copiedSignals: 4,
    watchedSignals: 5,
    skippedSignals: 3,
    bestWalletsJson: JSON.stringify(["0xDEMO_0001", "0xDEMO_0003"]),
    worstWalletsJson: JSON.stringify(["0xDEMO_0016"]),
    ruleChangesJson: JSON.stringify([]),
    summary: "DEMO: Moderate day. 4 paper copies, 2 in profit. Watching 3 wallets.",
    sentToTelegram: false,
    createdAt: now,
  }).run();

  // Summary
  const allWallets = db.select().from(schema.walletProfiles).all();
  const allDecisions = db.select().from(schema.decisionJournals).all();
  const allPaper = db.select().from(schema.paperTrades).all();

  LOG(`\nSeed complete!`);
  LOG(`  Wallets: ${allWallets.length}`);
  LOG(`  Decisions: ${allDecisions.length}`);
  LOG(`  Paper Trades: ${allPaper.length}`);
  LOG(`\nRun \`npm run dev\` to start the dashboard.`);
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
