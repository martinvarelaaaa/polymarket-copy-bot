// ─── Polymarket Leaderboard Adapter ──────────────────────────
// Read-only public endpoints. No API key required.

const BULLPEN_API = "https://bullpen.polymarket.com";

// ─── Types ───────────────────────────────────────────────────

export interface LeaderboardTrader {
  /** Wallet address (0x...) or DEMO identifier */
  walletAddress: string;
  /** Display name */
  username: string;
  /** Total PnL in USD */
  pnl: number;
  /** ROI as a decimal (0.15 = 15%) */
  roi: number;
  /** Total volume traded */
  volume: number;
  /** Number of trades */
  tradeCount: number;
  /** Markets traded */
  marketsTraded: number;
  /** Win rate (0.65 = 65%) */
  winRate: number;
  /** Average position size */
  avgPositionSize: number;
  /** Whether this is demo/mock data */
  isDemo: boolean;
  /** Lookback period in days */
  lookbackDays: number;
  /** Rank in leaderboard */
  rank: number;
  /** Profile avatar URL (optional) */
  avatarUrl?: string;
}

export interface LeaderboardResponse {
  traders: LeaderboardTrader[];
  total: number;
  lookbackDays: number;
  updatedAt: string;
  isDemo: boolean;
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
        `[leaderboard] HTTP ${res.status} for ${url}: ${res.statusText}`
      );
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`[leaderboard] Fetch failed for ${url}:`, err);
    return null;
  }
}

// ─── API Functions ───────────────────────────────────────────

/**
 * Fetch leaderboard from Polymarket Bullpen API.
 * GET bullpen.polymarket.com/leaderboard
 */
export async function fetchLeaderboard(
  limit = 50,
  lookbackDays = 30
): Promise<LeaderboardResponse | null> {
  const url = `${BULLPEN_API}/leaderboard?limit=${limit}&lookback=${lookbackDays}`;
  const data = await fetchJSON<{
    leaderboard?: Array<Record<string, unknown>>;
    total?: number;
  }>(url);

  if (!data) return null;

  const rawTraders = data.leaderboard ?? [];

  const traders: LeaderboardTrader[] = rawTraders.map((t, i) => ({
    walletAddress: (t.walletAddress as string) ?? (t.address as string) ?? "",
    username:
      (t.username as string) ??
      (t.displayName as string) ??
      (t.name as string) ??
      `Trader ${i + 1}`,
    pnl: Number(t.pnl ?? t.profit ?? t.profitLoss ?? 0),
    roi: Number(t.roi ?? t.returnOnInvestment ?? t.return ?? 0),
    volume: Number(t.volume ?? t.totalVolume ?? 0),
    tradeCount: Number(t.tradeCount ?? t.trades ?? t.totalTrades ?? 0),
    marketsTraded: Number(t.marketsTraded ?? t.markets ?? 0),
    winRate: Number(t.winRate ?? t.winrate ?? t.winPercentage ?? 0),
    avgPositionSize: Number(t.avgPositionSize ?? t.averagePositionSize ?? 0),
    isDemo: false,
    lookbackDays,
    rank: (t.rank as number) ?? (i + 1),
    avatarUrl: t.avatarUrl as string | undefined,
  }));

  return {
    traders,
    total: data.total ?? traders.length,
    lookbackDays,
    updatedAt: new Date().toISOString(),
    isDemo: false,
  };
}

// ─── Demo Data ───────────────────────────────────────────────

/**
 * Generate clearly-labeled DEMO leaderboard data for testing.
 * All wallet addresses start with "0xDEMO" and isDemo is true.
 */
export function generateDemoLeaderboard(count = 10): LeaderboardResponse {
  const demoProfiles = [
    { name: "AlphaWhale", roi: 0.85, winRate: 0.72 },
    { name: "BetMaster", roi: 0.62, winRate: 0.68 },
    { name: "SignalTrader", roi: 0.55, winRate: 0.64 },
    { name: "MarketMaven", roi: 0.48, winRate: 0.61 },
    { name: "EdgeSeeker", roi: 0.41, winRate: 0.59 },
    { name: "DataDriven", roi: 0.37, winRate: 0.57 },
    { name: "TrendRider", roi: 0.32, winRate: 0.55 },
    { name: "ValueHunter", roi: 0.28, winRate: 0.53 },
    { name: "ProbPlayer", roi: 0.22, winRate: 0.51 },
    { name: "QuantMind", roi: 0.18, winRate: 0.50 },
    { name: "SwiftTrade", roi: 0.15, winRate: 0.48 },
    { name: "LogicBet", roi: 0.12, winRate: 0.47 },
    { name: "RiskWise", roi: 0.09, winRate: 0.46 },
    { name: "ColdStart", roi: 0.06, winRate: 0.45 },
    { name: "NewHorizon", roi: 0.03, winRate: 0.44 },
  ];

  const traders: LeaderboardTrader[] = [];
  for (let i = 0; i < count; i++) {
    const profile = demoProfiles[i % demoProfiles.length];
    // Add some jitter so not all identical
    const jitter = (Math.random() - 0.5) * 0.04;
    const roi = Math.max(0, Math.min(profile.roi + jitter, 1.0));
    const wr = Math.max(0, Math.min(profile.winRate + jitter / 2, 1.0));
    const volume = Math.round((50000 + Math.random() * 500000) * 100) / 100;
    const tradeCount = Math.floor(50 + Math.random() * 2000);

    traders.push({
      walletAddress: `${DEMO_WALLET_PREFIX}_${i.toString().padStart(4, "0")}`,
      username: `${profile.name}_${i + 1}`,
      pnl: Math.round(roi * volume * 100) / 100,
      roi: Math.round(roi * 1000) / 1000,
      volume,
      tradeCount,
      marketsTraded: Math.floor(5 + Math.random() * 50),
      winRate: Math.round(wr * 1000) / 1000,
      avgPositionSize: Math.round((50 + Math.random() * 500) * 100) / 100,
      isDemo: true,
      lookbackDays: 30,
      rank: i + 1,
    });
  }

  return {
    traders,
    total: traders.length,
    lookbackDays: 30,
    updatedAt: new Date().toISOString(),
    isDemo: true,
  };
}

/**
 * Check if a trader is demo data (wallet starts with "0xDEMO").
 */
export function isDemoLeaderboard(
  trader: Pick<LeaderboardTrader, "walletAddress" | "isDemo">
): boolean {
  if (trader.isDemo) return true;
  if (trader.walletAddress.startsWith(DEMO_WALLET_PREFIX)) return true;
  return false;
}
