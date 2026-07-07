# Hermes Polymarket Copy Trading Bot

A paper-trading research system that scans Polymarket leaderboard wallets, scores them, and simulates copy trades to evaluate strategies — **without ever placing real trades.**

**Not financial advice. Version 1 is paper trading only.**

---

## What This Bot Does

- Scans the top 500 wallets on Polymarket (or via demo data)
- Scores each wallet on ROI, consistency, copyability, and risk
- Penalizes one-hit wonders and illiquid traders
- Detects new trades from tracked wallets
- Scores whether each trade is worth copying
- Paper trades copy candidates using $5–$20 simulated positions
- Updates paper PnL every hour
- Reviews outcomes when markets resolve
- Compares bot-filtered strategy against blind leaderboard copy
- Automatically updates rules based on performance
- Sends end-of-day reports via Hermes Agent to Telegram
- Shows everything in a clean, dark-themed Vercel dashboard

## What This Bot Does NOT Do

- ❌ Place real trades
- ❌ Sign blockchain transactions
- ❌ Store or request private keys
- ❌ Spend money
- ❌ Connect to wallets
- ❌ Provide financial advice
- ❌ Guarantee any future results

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
git clone <your-repo-url>
cd polymarket-copy-bot
npm install
```

### Environment Variables

Create `.env.local` (all optional for v1):

```env
# Polymarket API (optional — uses public endpoints if unset)
POLYMARKET_API_KEY=

# Set to "true" to use demo data instead of live Polymarket
DEMO_MODE=true

# Database path (default: ./data/bot.db)
DB_PATH=./data/bot.db

# Telegram bot token for reports (optional)
TELEGRAM_BOT_TOKEN=

# Telegram chat ID for reports (optional)
TELEGRAM_CHAT_ID=
```

### Database Setup

```bash
npm run db:migrate   # Create tables
npm run seed          # Populate with demo data
```

### Run Locally

```bash
npm run dev           # Start dashboard at http://localhost:3000
```

### CLI Commands

```bash
npm run scan:leaderboard    # Scan top 500 wallets
npm run scan:wallets        # Update wallet profiles
npm run monitor:trades      # Monitor tracked wallets for new trades
npm run score:trades        # Score new trades (paper_copy/watchlist/skip)
npm run paper:update-pnl    # Update paper trade PnL
npm run review:outcomes     # Review resolved market outcomes
npm run update:rules        # Auto-update rules based on performance
npm run report:daily        # Generate end-of-day report
```

---

## Deploy to Vercel

```bash
vercel deploy
```

Note: Vercel uses serverless functions. The database writes from the dashboard may not work serverlessly without a hosted database. For a full deployment, consider using Turso (SQLite over HTTP) or Supabase.

### Add to Max HQ

In Max HQ, add an iframe or link widget pointing to your deployed Vercel URL. The dashboard is responsive and designed to fit within a tile-based layout.

---

## How Hermes Operates It

Hermes Agent should run via cron jobs:

```
# Every 6 hours: scan leaderboard
0 */6 * * * npm run scan:leaderboard && npm run scan:wallets

# Every 15 minutes: monitor trades
*/15 * * * * npm run monitor:trades && npm run score:trades

# Every hour: update PnL
0 * * * * npm run paper:update-pnl

# Daily at 8pm: review + update rules + report
0 20 * * * npm run review:outcomes && npm run update:rules && npm run report:daily
```

Hermes reads the report output and sends it to Telegram with an executive summary.

---

## How Leaderboard Scan Works

1. Fetches the top N wallets from Polymarket's public leaderboard API (or uses demo data)
2. For each wallet, extracts ROI, win rate, volume, trade count
3. Creates a `WalletProfile` record in the database
4. Computes scores for consistency, copyability, one-hit-wonder penalty
5. Assigns status: `track`, `watch`, or `ignore`

## How Wallet Scoring Works

- **ROI (25%):** Raw return over 30 days, normalized
- **Consistency (25%):** Win rate and variance across trades
- **Copyability (20%):** Spread quality, liquidity, entry timing
- **Category Edge (15%):** Specialization in profitable categories
- **Liquidity Quality (10%):** Average market liquidity
- **Entry Timing (5%):** How early wallet enters trades
- **One-Hit-Wonder Penalty:** Up to 40% reduction if most profit came from one trade

## How Paper Trading Works

- For each `paper_copy` decision, a simulated trade is created
- Position size: $5–$20 based on confidence
- PnL is calculated as: `(current_price - entry_price) * position_size`
- Updated every hour from current market prices
- Resolved when the market resolves or the bot decides to exit
- All paper trades are labeled as simulated

## How Self-Improvement Works

1. The bot reviews resolved paper trades
2. It compares bot-filtered outcomes against blind-copy and skipped trades
3. It identifies patterns: wide spreads losing, late entries failing, etc.
4. It adjusts rule thresholds (min liquidity, max spread, etc.) by small increments
5. Every change is logged with before/after values, reason, and evidence
6. Maximum 3 changes per day, minimum 10 trades of evidence required

## How to Interpret the Dashboard

- **Overview:** Quick snapshot — are we profitable on paper?
- **Wallet Rankings:** Which wallets are worth copying?
- **Signals:** What new trades are we seeing?
- **Paper Trades:** Active simulated positions and PnL
- **Journal:** Every decision explained
- **Performance:** PnL charts, win rates, benchmarks
- **Rules:** Current thresholds and change history
- **Reports:** End-of-day and weekly summaries

---

## Tech Stack

- Next.js 15 + React
- TypeScript
- Tailwind CSS
- Drizzle ORM + SQLite (local)
- Recharts (charts)
- Polymarket public APIs
- Vercel-ready

---

**Not financial advice. Not investment advice. For research purposes only.**
