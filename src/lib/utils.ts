export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

export function weightedScore(
  components: Record<string, { value: number; weight: number }>
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const c of Object.values(components)) {
    weightedSum += c.value * c.weight;
    totalWeight += c.weight;
  }
  if (totalWeight === 0) return 0;
  return clamp(weightedSum / totalWeight, 0, 1);
}

export function calculateOneHitWonderPenalty(
  trades: Array<{ profit: number }>,
  totalProfit: number
): number {
  if (totalProfit <= 0 || trades.length < 2) return 0;
  const sorted = [...trades].sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit));
  const topShare = Math.abs(sorted[0].profit) / Math.abs(totalProfit);
  return topShare > 0.6 ? Math.min(0.4, (topShare - 0.6) * 1.0) : 0;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(value);
}

export function nowISO(): string { return new Date().toISOString(); }
export function toISODate(): string { return new Date().toISOString().split('T')[0]; }
