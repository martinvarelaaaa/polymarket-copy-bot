// ─── Polymarket Trade Monitoring Adapter ─────────────────────
// Read-only public endpoints. No API key required.

const CLOB_API = "https://clob.polymarket.com";

// ─── Types ───────────────────────────────────────────────────

export interface RecentTrade {
  /** Unique trade ID */
  id: string;
  /** Market condition ID */
  marketId: string;
  /** CLOB token ID */
  tokenId: string;
  /** Wallet address of the trader (0x...) or DEMO */
  walletAddress: string;
  /** Transaction hash */
  txHash: string;
  /** Trade side */
  side: "BUY" | "SELL";
  /** Price per share */
  price: number;
  /** Number of shares */
  size: number;
  /** Total trade value (price × size) */
  value: number;
  /** Timestamp of the trade */
  timestamp: string;
  /** Whether this is demo/mock data */
  isDemo: boolean;
  /** Outcome label (optional) */
  outcome?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

const DEMO_WALLET_PREFIX = "0xDEMO";

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      console.error(
        `[trades] HTTP ${res.status} for ${url}: ${res.statusText}`
      );
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`[trades] Fetch failed for ${url}:`, err);
    return null;
  }
}

// ─── API Functions ───────────────────────────────────────────

/**
 * Fetch recent trades for a market from CLOB API.
 * GET clob.polymarket.com/data/trades?market={marketId}&limit={limit}
 */
export async function fetchRecentTrades(
  marketId: string,
  limit = 50
): Promise<RecentTrade[] | null> {
  const url = `${CLOB_API}/data/trades?market=${encodeURIComponent(marketId)}&limit=${limit}`;
  const data = await fetchJSON<
    Array<{
      id?: string;
      transaction_hash?: string;
      side?: string;
      price?: string;
      size?: string;
      created_at?: string;
      asset_id?: string;
      condition_id?: string;
      maker_address?: string;
      taker_address?: string;
      outcome?: string;
    }>
  >(url);

  if (!data) return null;

  return data.map((t) => {
    const price = Number(t.price ?? 0);
    const size = Number(t.size ?? 0);

    return {
      id: t.id ?? t.transaction_hash ?? "",
      marketId,
      tokenId: t.asset_id ?? "",
      walletAddress: t.maker_address ?? t.taker_address ?? "",
      txHash: t.transaction_hash ?? "",
      side: t.side === "SELL" ? "SELL" : "BUY",
      price,
      size,
      value: Math.round(price * size * 1e6) / 1e6,
      timestamp: t.created_at ?? new Date().toISOString(),
      isDemo: false,
      outcome: t.outcome,
    };
  });
}

// ─── Demo Data ───────────────────────────────────────────────

/**
 * Generate clearly-labeled DEMO trade data for testing.
 * All wallet addresses start with "0xDEMO" and isDemo is true.
 */
export function generateDemoTrades(
  walletAddress: string,
  marketId: string,
  count = 10
): RecentTrade[] {
  const sides: Array<"BUY" | "SELL"> = ["BUY", "SELL"];
  const basePrice = 0.35 + Math.random() * 0.30; // 0.35–0.65
  const now = Date.now();
  const intervalMs = 60000; // 1 minute apart

  const trades: RecentTrade[] = [];
  for (let i = 0; i < count; i++) {
    const side = sides[Math.floor(Math.random() * sides.length)];
    const price = Math.round((basePrice + (Math.random() - 0.5) * 0.06) * 1000) / 1000;
    const size = Math.round((10 + Math.random() * 200) * 100) / 100;
    const timestamp = new Date(now - (count - i) * intervalMs).toISOString();

    trades.push({
      id: `demo-trade-${i.toString().padStart(6, "0")}`,
      marketId,
      tokenId: `demo-token-${marketId}`,
      walletAddress:
        walletAddress.startsWith(DEMO_WALLET_PREFIX)
          ? walletAddress
          : `${DEMO_WALLET_PREFIX}_${i.toString().padStart(4, "0")}`,
      txHash: `0x${"a".repeat(64)}`,
      side,
      price,
      size,
      value: Math.round(price * size * 1e6) / 1e6,
      timestamp,
      isDemo: true,
      outcome: Math.random() > 0.5 ? "Yes" : "No",
    });
  }

  return trades;
}
