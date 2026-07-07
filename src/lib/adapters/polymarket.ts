// ─── Polymarket CLOB / Gamma API Adapter ─────────────────────
// Read-only public endpoints. No API key, no signing, no transactions.

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

// ─── Types ───────────────────────────────────────────────────

export interface PolymarketMarket {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  marketSlug: string;
  icon: string;
  image: string;
  category: string;
  tags: string[];
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  enableOrderBook: boolean;
  archived: boolean;
  restricted: boolean;
  clobTokenIds: string[];
  negRisk: boolean;
  negRiskMarketId?: string;
  negRiskRequestId?: string;
  rewards: {
    rates: Record<string, number>;
    minSize: string;
    maxSpread: string;
  };
  events: PolymarketEvent[];
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  startDate: string;
  endDate: string;
  volume: number;
  liquidity: number;
  createdAt: string;
  updatedAt: string;
  closed: boolean;
  active: boolean;
}

export interface PolymarketPrice {
  tokenId: string;
  bestBid: number;
  bestAsk: number;
  midpoint: number;
  spread: number;
  lastPrice: number;
  volume24h: number;
}

export interface BookLevel {
  price: string;
  size: string;
}

export interface PolymarketOrderBook {
  bids: Record<string, BookLevel>;
  asks: Record<string, BookLevel>;
  market: string;
  assetId: string;
  hash: string;
}

export interface FetchMarketsParams {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  closed?: boolean;
  active?: boolean;
  archived?: boolean;
  tag?: string;
  relatedTags?: boolean;
  category?: string;
  title?: string;
  volumeMin?: number;
  liquidityMin?: number;
}

// ─── Helpers ─────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      console.error(
        `[polymarket] HTTP ${res.status} for ${url}: ${res.statusText}`
      );
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`[polymarket] Fetch failed for ${url}:`, err);
    return null;
  }
}

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null
  );

  if (entries.length === 0) return "";

  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  return `?${qs}`;
}

// ─── API Functions ───────────────────────────────────────────

/**
 * Fetch markets from Polymarket Gamma API.
 * GET gamma-api.polymarket.com/markets
 */
export async function fetchMarkets(
  params: FetchMarketsParams = {}
): Promise<PolymarketMarket[] | null> {
  const query = buildQuery(params as Record<string, unknown>);
  return fetchJSON<PolymarketMarket[]>(`${GAMMA_API}/markets${query}`);
}

/**
 * Fetch a single market by condition ID.
 * GET gamma-api.polymarket.com/markets/{conditionId}
 */
export async function fetchMarketByConditionId(
  conditionId: string
): Promise<PolymarketMarket | null> {
  return fetchJSON<PolymarketMarket>(
    `${GAMMA_API}/markets/${encodeURIComponent(conditionId)}`
  );
}

/**
 * Fetch order book prices for a single market (CLOB).
 * GET clob.polymarket.com/book?token_id={tokenId}
 */
export async function fetchMarketPrices(
  tokenId: string
): Promise<PolymarketOrderBook | null> {
  return fetchJSON<PolymarketOrderBook>(
    `${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`
  );
}

/**
 * Fetch order book prices for multiple markets in parallel.
 * Returns a map of tokenId → order book.
 */
export async function fetchMarketPricesBatch(
  tokenIds: string[]
): Promise<Map<string, PolymarketOrderBook | null>> {
  const results = await Promise.allSettled(
    tokenIds.map((id) => fetchMarketPrices(id))
  );

  const map = new Map<string, PolymarketOrderBook | null>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      map.set(tokenIds[i], result.value);
    } else {
      console.error(
        `[polymarket] Failed to fetch prices for ${tokenIds[i]}:`,
        result.reason
      );
      map.set(tokenIds[i], null);
    }
  });

  return map;
}

/**
 * Search markets by keyword.
 * GET gamma-api.polymarket.com/markets?title={query}&limit={limit}
 */
export async function searchMarkets(
  query: string,
  limit = 20
): Promise<PolymarketMarket[] | null> {
  return fetchMarkets({
    title: query,
    limit,
    order: "volume",
    ascending: false,
    active: true,
    closed: false,
  });
}

/**
 * Compute a simplified price summary from an order book.
 */
export function orderBookToPrice(orderBook: PolymarketOrderBook): PolymarketPrice {
  const bidKeys = Object.keys(orderBook.bids);
  const askKeys = Object.keys(orderBook.asks);

  const bestBid = bidKeys.length
    ? Math.max(...bidKeys.map(Number))
    : 0;

  const bestAsk = askKeys.length
    ? Math.min(...askKeys.map(Number))
    : 0;

  const midpoint = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;

  return {
    tokenId: orderBook.assetId,
    bestBid,
    bestAsk,
    midpoint,
    spread,
    lastPrice: midpoint,
    volume24h: 0,
  };
}
