# Safety — Polymarket Copy Trading Bot

## Read this before using any part of this system.

---

## Version 1: Paper Trading Only

Version 1 is a **research tool**, not a trading bot.

- ✅ Paper trades only ($5–$20 simulated positions)
- ✅ No real money at risk
- ✅ No private keys stored or requested
- ✅ No transaction signing capability
- ✅ Read-only Polymarket API adapters
- ✅ All API calls use public endpoints — no API keys needed
- ✅ Demo data clearly labeled with "0xDEMO" prefix

---

## Why Real Execution Is Disabled

Real execution is **intentionally disabled** because:

1. **Copy trading is dangerous.** Past performance does not predict future results. A wallet that made 80% ROI last month can lose everything next month.

2. **Leaderboard wallets are not vetted.** Polymarket leaderboards show historical PnL. They do not show risk management, position sizing, leverage, external hedges, or lucky timing.

3. **Data can be stale or misleading.** Public APIs may lag behind order book reality. Prices you see in the dashboard may already be outdated by seconds to minutes.

4. **Liquidity is critical.** A trade that looks profitable at the leaderboard wallet's entry price may be un-executable at that price due to spread, slippage, or low liquidity.

5. **Wide spreads destroy edge.** Many markets on Polymarket have spreads of 3–8%. A wallet showing 10% ROI may have a realizable edge of only 2% after accounting for spread.

6. **Entry timing matters.** If a wallet bought YES at $0.30 and the bot detects the trade at $0.40, the opportunity may already be gone.

---

## Risks of Stale Data

- Leaderboard data refreshes periodically, not in real-time.
- Trade data from the CLOB API reflects past executions, not current order book state.
- Market prices in the dashboard may not reflect the latest prices on the order book.
- Always verify data freshness before making decisions.

---

## Risks of Low Liquidity

- Low-liquidity markets have wide spreads and high slippage.
- A $10 trade in a market with $50 liquidity may move the price significantly.
- Leaderboard wallets may profit from trades you cannot replicate at the same size.
- The bot's `min_liquidity` rule is a guardrail — do not lower it without understanding the consequences.

---

## Risks of Wide Spreads

- If a market has a YES bid of $0.35 and YES ask of $0.40, the spread is 14%.
- A trade must move at least 14% in your favor just to break even.
- Many wallets show positive PnL that would not survive spread costs.

---

## Risks of Copy Trading

- **You are following, not understanding.** Copy trading outsources decision-making to an observed address. You do not know their thesis, risk tolerance, or exit strategy.

- **Adversarial behavior.** A malicious actor could pump a wallet's stats, attract copy traders, and dump on them.

- **Correlation risk.** Copying multiple wallets in the same category amplifies exposure to a single event.

- **False confidence.** A system that scores wallets well and shows positive paper PnL creates false confidence. Paper trading is not live trading.

---

## Why Private Keys Should Never Be Stored

This application intentionally has **no code** for:
- Storing private keys
- Signing transactions
- Connecting to wallets
- Submitting orders to Polymarket
- Spending funds

If you fork this project and add real execution:
- Use a separate, secure key management system.
- Implement multi-signature approval.
- Set maximum position size limits.
- Add circuit breaker rules.
- Never store private keys in environment variables, code, or the database.

---

## When and How to Add Real Execution

Real execution should only be added after:

1. **Paper trading shows consistent positive expectancy** over at least 30 days with 50+ resolved paper trades.
2. **The bot's filtered strategy beats blind copy** by a meaningful margin.
3. **All rule changes are understood and backtested.**
4. **You have read and accept** Polymarket's Terms of Service and understand the legal status of prediction markets in your jurisdiction.

When ready:
1. Fork this repo.
2. Add execution adapters behind a feature flag.
3. Start with minimum position sizes ($1–$2).
4. Monitor every trade manually for the first week.
5. Gradually increase autonomy only after proving results.

---

**Not financial advice. Not investment advice. Not trading advice. For research purposes only.**
