/**
 * Deterministic, seeded "AI" price forecast — simulated for demo purposes.
 * There is no real model or live market data behind this; the same listing
 * always produces the same chart so it feels stable across renders/reloads.
 */

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SEASONAL_REASONS = [
  'post-harvest export demand from regional buyers',
  'currency movements against the US dollar',
  'tighter regional supply ahead of the next planting window',
  'growing international demand for certified, traceable lots',
  'easing logistics and freight costs on major export corridors',
  'stronger buyer activity from verified export cooperatives',
]

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) || 1
}

function seededRandom(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

export interface PricePoint {
  month: string
  actual: number | null
  predicted: number | null
  range?: [number, number]
}

export interface PriceForecast {
  points: PricePoint[]
  changePercent: number
  insight: string
}

export function generatePriceForecast(listingId: string, currentPriceUSD: number): PriceForecast {
  const rand = seededRandom(hashString(listingId))
  const now = new Date()

  // Walk backward from today's price to build 6 months of "history".
  const historicalPrices: number[] = [currentPriceUSD]
  for (let i = 0; i < 5; i++) {
    const drift = (rand() - 0.5) * 0.08
    historicalPrices.unshift(Math.round(historicalPrices[0] / (1 + drift)))
  }

  // Overall 3-month trend, seeded per listing (-6% to +16%).
  const changePercent = Math.round((rand() * 22 - 6) * 10) / 10
  const monthlyTrend = changePercent / 100 / 3

  const predictedPrices: number[] = []
  let base = currentPriceUSD
  for (let i = 0; i < 3; i++) {
    base = base * (1 + monthlyTrend + (rand() - 0.5) * 0.02)
    predictedPrices.push(Math.round(base))
  }

  const points: PricePoint[] = []
  for (let i = 0; i < 6; i++) {
    const monthIndex = (now.getMonth() - (5 - i) + 120) % 12
    points.push({
      month: MONTH_LABELS[monthIndex],
      actual: historicalPrices[i],
      // Duplicate the final historical point into the predicted series so the dashed
      // AI projection line connects visually where the actual line ends.
      predicted: i === 5 ? historicalPrices[i] : null,
    })
  }
  for (let i = 0; i < 3; i++) {
    const monthIndex = (now.getMonth() + 1 + i) % 12
    const spread = Math.max(1, Math.round(predictedPrices[i] * (0.04 + i * 0.025)))
    points.push({
      month: MONTH_LABELS[monthIndex],
      actual: null,
      predicted: predictedPrices[i],
      range: [predictedPrices[i] - spread, predictedPrices[i] + spread],
    })
  }

  const reason = SEASONAL_REASONS[hashString(`${listingId}-reason`) % SEASONAL_REASONS.length]
  const direction = changePercent >= 0 ? 'increase' : 'decrease'
  const insight = `AI model predicts a ${Math.abs(changePercent)}% price ${direction} per ton over the next 3 months, driven by ${reason}.`

  return { points, changePercent, insight }
}
