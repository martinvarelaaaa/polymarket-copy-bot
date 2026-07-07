// Polymarket API adapters
// Uses the Polymarket CLOB API and Gamma Markets API for data retrieval.

const POLYMARKET_CLOB_URL = process.env.POLYMARKET_CLOB_URL || "https://clob.polymarket.com";
const POLYMARKET_GAMMA_URL = process.env.POLYMARKET_GAMMA_URL || "https://gamma-api.polymarket.com";

interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
}

async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { retries = 3, timeoutMs = 15000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

// ─── Leaderboard ────────────────────────────────────────

export interface LeaderboardEntry {
  address: string;
  volume: number;
  profit: number;
  roi: number;
  trades: number;
  winRate: number;
  rank: number;
}

/**
 * Fetch top wallets from Polymarket leaderboard.
 * Uses the Gamma API /markets endpoint to approximate leaderboard data,
 * then enriches with user-level stats where available.
 */
export async function fetchLeaderboard(count = 500): Promise<LeaderboardEntry[]> {
  try {
    // Polymarket doesn't have a direct "leaderboard" API endpoint.
    // We use the Gamma API to fetch top markets and derive top traders,
    // or use a known leaderboard source.
    // For now, this returns a structured stub that can be replaced
    // with a real leaderboard data source (e.g., polymarket.com/leaderboard scraping
    // or a third-party API).

    const url = `${POLYMARKET_GAMMA_URL}/markets?limit=50&order=volume24h&ascending=false`;
    await fetchWithRetry(url); // prime the connection / validate endpoint

    // Derive leaderboard entries from market volume leaders (simplified).
    // In production, replace with actual leaderboard API.
    const entries: LeaderboardEntry[] = [];

    // Attempt to get real leaderboard data from Polymarket's leaderboard endpoint
    try {
      const lbUrl = `${POLYMARKET_CLOB_URL}/leaderboard?limit=${Math.min(count, 500)}`;
      const leaderboard = await fetchWithRetry(lbUrl);
      if (Array.isArray(leaderboard)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return leaderboard.map((entry: any, idx: number) => ({
          address: entry.user || entry.address || "",
          volume: entry.volume || 0,
          profit: entry.profit || 0,
          roi: entry.roi || 0,
          trades: entry.trades || entry.tradeCount || 0,
          winRate: entry.winRate || entry.win_rate || 0,
          rank: entry.rank || idx + 1,
        }));
      }
    } catch {
      // Leaderboard endpoint not available; fall through to stub
    }

    // Fallback: return empty — the CLI will log that no data was available
    return entries;
  } catch (error) {
    console.error("[adapters] fetchLeaderboard error:", error);
    return [];
  }
}

// ─── Wallet Stats ────────────────────────────────────────

export interface WalletStats {
  address: string;
  roi30d: number | null;
  winRate30d: number | null;
  tradeCount30d: number;
  resolvedTradeCount30d: number;
  averageTradeSize: number | null;
  bestCategory: string | null;
  categoryStrengths: Record<string, number>;
}

/**
 * Fetch detailed stats for a single wallet.
 */
export async function fetchWalletStats(address: string): Promise<WalletStats | null> {
  try {
    // Try the Polymarket activity feed for this user
    const url = `${POLYMARKET_GAMMA_URL}/activity?user=${address}&limit=100`;
    const activities = await fetchWithRetry(url);

    if (!Array.isArray(activities) || activities.length === 0) {
      return null;
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentActivity = activities.filter((a: any) => {
      const ts = new Date(a.timestamp || a.createdAt || 0).getTime();
      return ts >= thirtyDaysAgo;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades = recentActivity.filter((a: any) => a.type === "trade" || a.event === "order_filled");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalSize = trades.reduce((sum: number, t: any) => sum + (Number(t.usdcSize) || Number(t.size) || 0), 0);

    // Approximate category strengths from market data
    const categories: Record<string, number> = {};
    for (const t of trades) {
      const cat = t.marketCategory || t.category || "uncategorized";
      categories[cat] = (categories[cat] || 0) + 1;
    }
    const totalCat = Object.values(categories).reduce((a, b) => a + b, 0) || 1;
    const categoryStrengths: Record<string, number> = {};
    let bestCategory: string | null = null;
    let bestCount = 0;
    for (const [cat, count] of Object.entries(categories)) {
      categoryStrengths[cat] = count / totalCat;
      if (count > bestCount) {
        bestCount = count;
        bestCategory = cat;
      }
    }

    return {
      address,
      roi30d: null, // Requires profit/loss data; placeholder
      winRate30d: null, // Requires resolved trade data; placeholder
      tradeCount30d: trades.length,
      resolvedTradeCount30d: 0, // Placeholder
      averageTradeSize: trades.length > 0 ? totalSize / trades.length : null,
      bestCategory,
      categoryStrengths,
    };
  } catch (error) {
    console.error(`[adapters] fetchWalletStats error for ${address}:`, error);
    return null;
  }
}

// ─── Wallet Trades ───────────────────────────────────────

export interface WalletTrade {
  id: string;
  walletAddress: string;
  marketId: string;
  conditionId: string | null;
  marketQuestion: string | null;
  marketCategory: string | null;
  outcome: "YES" | "NO" | null;
  side: "BUY" | "SELL" | null;
  price: number;
  size: number;
  timestamp: string;
}

/**
 * Fetch recent trades for a wallet. If `since` is provided as ISO string,
 * only returns trades after that timestamp.
 */
export async function fetchWalletTrades(
  address: string,
  since?: string,
): Promise<WalletTrade[]> {
  try {
    const url = `${POLYMARKET_GAMMA_URL}/activity?user=${address}&limit=100`;
    const activities = await fetchWithRetry(url);

    if (!Array.isArray(activities)) return [];

    const sinceTs = since ? new Date(since).getTime() : 0;

    return activities
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) => {
        const ts = new Date(a.timestamp || a.createdAt || 0).getTime();
        return ts >= sinceTs && (a.type === "trade" || a.event === "order_filled");
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => ({
        id: a.id || a.transactionHash || `trade-${Date.now()}`,
        walletAddress: address,
        marketId: a.market || a.marketId || a.conditionId || "",
        conditionId: a.conditionId || null,
        marketQuestion: a.title || a.question || a.marketQuestion || null,
        marketCategory: a.category || a.marketCategory || null,
        outcome: a.outcome === "Yes" ? "YES" : a.outcome === "No" ? "NO" : null,
        side: a.side === "buy" || a.type === "buy" ? "BUY" : a.side === "sell" || a.type === "sell" ? "SELL" : null,
        price: Number(a.price || a.avgPrice || 0),
        size: Number(a.usdcSize || a.size || a.amount || 0),
        timestamp: a.timestamp || a.createdAt || new Date().toISOString(),
      }));
  } catch (error) {
    console.error(`[adapters] fetchWalletTrades error for ${address}:`, error);
    return [];
  }
}

// ─── Market Prices ───────────────────────────────────────

export interface MarketPrice {
  marketId: string;
  conditionId: string | null;
  question: string | null;
  category: string | null;
  yesPrice: number;
  noPrice: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  liquidity: number;
  volume: number;
  timeToResolution: string | null;
}

/**
 * Fetch current market price/snapshot for a given market.
 */
export async function fetchMarketPrice(marketId: string): Promise<MarketPrice | null> {
  try {
    // Try Gamma API market endpoint
    const url = `${POLYMARKET_GAMMA_URL}/markets/${marketId}`;
    const market = await fetchWithRetry(url);

    if (!market || market.error) {
      // Try CLOB API
      const clobUrl = `${POLYMARKET_CLOB_URL}/markets/${marketId}`;
      const clobMarket = await fetchWithRetry(clobUrl);
      if (!clobMarket || clobMarket.error) return null;

      const yesPrice = clobMarket.outcomePrices ? parseFloat(clobMarket.outcomePrices[0]) : 0;
      const noPrice = clobMarket.outcomePrices ? parseFloat(clobMarket.outcomePrices[1]) : 0;
      return {
        marketId,
        conditionId: clobMarket.conditionId || null,
        question: clobMarket.question || clobMarket.title || null,
        category: clobMarket.category || null,
        yesPrice,
        noPrice,
        bestBid: clobMarket.bestBid ?? yesPrice,
        bestAsk: clobMarket.bestAsk ?? yesPrice,
        spread: Math.abs((clobMarket.bestAsk ?? yesPrice) - (clobMarket.bestBid ?? yesPrice)),
        liquidity: parseFloat(clobMarket.liquidity || "0"),
        volume: parseFloat(clobMarket.volume24hr || clobMarket.volume || "0"),
        timeToResolution: clobMarket.endDate || clobMarket.resolutionTime || null,
      };
    }

    const yesPrice = market.outcomePrices ? parseFloat(market.outcomePrices[0]) : 0;
    const noPrice = market.outcomePrices ? parseFloat(market.outcomePrices[1]) : 0;

    return {
      marketId,
      conditionId: market.conditionId || null,
      question: market.question || market.title || null,
      category: market.category || null,
      yesPrice,
      noPrice,
      bestBid: market.bestBid ?? yesPrice,
      bestAsk: market.bestAsk ?? yesPrice,
      spread: Math.abs((market.bestAsk ?? yesPrice) - (market.bestBid ?? yesPrice)),
      liquidity: parseFloat(market.liquidity || "0"),
      volume: parseFloat(market.volume24hr || market.volume || "0"),
      timeToResolution: market.endDate || market.resolutionTime || null,
    };
  } catch (error) {
    console.error(`[adapters] fetchMarketPrice error for ${marketId}:`, error);
    return null;
  }
}

// ─── Market Outcome ──────────────────────────────────────

export interface MarketOutcome {
  marketId: string;
  question: string | null;
  resolved: boolean;
  outcome: string | null;
  resolutionTime: string | null;
}

/**
 * Check if a market has resolved and what the outcome is.
 */
export async function fetchMarketOutcome(marketId: string): Promise<MarketOutcome | null> {
  try {
    const url = `${POLYMARKET_GAMMA_URL}/markets/${marketId}`;
    const market = await fetchWithRetry(url);

    if (!market) return null;

    const resolved = market.resolved || market.isResolved || false;
    return {
      marketId,
      question: market.question || market.title || null,
      resolved,
      outcome: resolved ? (market.resolution || market.outcome || null) : null,
      resolutionTime: market.resolutionTime || market.resolvedAt || null,
    };
  } catch (error) {
    console.error(`[adapters] fetchMarketOutcome error for ${marketId}:`, error);
    return null;
  }
}

// ─── Market Prices for Multiple Markets ──────────────────

/**
 * Batch fetch current prices for multiple markets.
 */
export async function fetchMarketPrices(marketIds: string[]): Promise<Map<string, MarketPrice>> {
  const results = new Map<string, MarketPrice>();
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < marketIds.length; i += batchSize) {
    const batch = marketIds.slice(i, i + batchSize);
    const promises = batch.map(async (id) => {
      const price = await fetchMarketPrice(id);
      if (price) results.set(id, price);
    });
    await Promise.all(promises);
    // Small delay between batches
    if (i + batchSize < marketIds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return results;
}

// ─── Resolve Prices at Historical Timestamps ──────────────

/**
 * Fetch the price of a market at approximately a given ISO timestamp.
 * Uses the Gamma API timeseries endpoint if available.
 */
export async function fetchMarketPriceAtTime(
  marketId: string,
  timestamp: string,
): Promise<number | null> {
  try {
    const ts = new Date(timestamp).getTime();
    const bucketEnd = new Date(ts + 3600 * 1000).toISOString();

    const url = `${POLYMARKET_GAMMA_URL}/markets/${marketId}/prices?start=${timestamp}&end=${bucketEnd}&interval=1h`;
    const data = await fetchWithRetry(url);

    if (data && data.history && data.history.length > 0) {
      return parseFloat(data.history[0].price || data.history[0].yesPrice || "0");
    }
    return null;
  } catch {
    // Timeseries endpoint may not be available; return null
    return null;
  }
}

// ─── Re-exports from specialized adapters ──────────────────

export {
  fetchMarkets,
  fetchMarketByConditionId,
  fetchMarketPrices as fetchClobMarketPrices,
  fetchMarketPricesBatch,
  searchMarkets,
  orderBookToPrice,
} from "./polymarket";

export type {
  PolymarketMarket,
  PolymarketEvent,
  PolymarketPrice,
  BookLevel,
  PolymarketOrderBook,
  FetchMarketsParams,
} from "./polymarket";

export {
  fetchLeaderboard as fetchBullpenLeaderboard,
  generateDemoLeaderboard,
  isDemoLeaderboard,
} from "./leaderboard";

export type {
  LeaderboardTrader,
  LeaderboardResponse,
} from "./leaderboard";

export {
  fetchRecentTrades,
  generateDemoTrades,
} from "./trades";

export type { RecentTrade } from "./trades";
