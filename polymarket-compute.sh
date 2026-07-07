#!/bin/bash
# ─── Polymarket Copy Bot Cron Script ─────────────────────────
# Runs the full pipeline: scraper → compute → deploy
# Designed for Hermes cron (no_agent mode)
# Output goes to stdout → Hermes delivers to Telegram
set -e

cd /home/martin/code/polymarket-copy-bot || exit 1

echo "🤖 CopyBot Pipeline — $(date '+%Y-%m-%d %H:%M')"
echo ""

# Step 1: Scrape leaderboard
echo "▸ Scraping leaderboard..."
if npx tsx src/cli/scrape-leaderboard.ts 2>&1; then
  echo "  ✅ Leaderboard scraped"
else
  echo "  ⚠️ Scraper failed — using cached data"
fi

# Step 2: Full compute + deploy
echo ""
echo "▸ Computing signals & paper trades..."
npx tsx src/cli/compute.ts --deploy 2>&1

echo ""
echo "✅ Pipeline complete — $(date '+%H:%M')"
echo "🔗 https://polymarket-copy-bot-phi.vercel.app"
