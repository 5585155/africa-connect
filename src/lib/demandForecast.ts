import type { SellerListing } from '../types'

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

export interface DemandAxis {
  axis: string
  score: number
}

const DEMAND_AXES = ['Local Market', 'Regional Export', 'International Export', 'Processing Demand', 'Retail Demand']

/** Deterministic per category so the same crop category always renders the same radar shape. */
export function generateDemandRadar(category: string): DemandAxis[] {
  const rand = seededRandom(hashString(category))
  return DEMAND_AXES.map((axis) => ({ axis, score: Math.round(35 + rand() * 60) }))
}

export interface PricingSuggestion {
  suggestedPriceUSD: number
  deltaPercent: number
  rationale: string
}

const RISING_RATIONALES = [
  'Demand for {crop} from {country} is trending up — buyers are paying more for verified, certified lots.',
  'Regional export buyers are actively sourcing {crop} right now, giving room to price above your current rate.',
  'Certified {crop} from {country} is outperforming uncertified lots this season on price.',
]

const SOFT_RATIONALES = [
  '{crop} supply from {country} is elevated this season — pricing slightly below market may move volume faster.',
  'Buyer inquiries for {crop} have slowed this month; a modest discount could keep your listing competitive.',
  'Several nearby farms are listing {crop} at similar volumes — a small price adjustment may attract offers sooner.',
]

/** Deterministic per listing so pricing guidance doesn't jump around between renders. */
export function suggestOptimalPrice(listing: SellerListing): PricingSuggestion {
  const rand = seededRandom(hashString(`${listing.id}-price`))
  const deltaPercent = Math.round((rand() * 20 - 6) * 10) / 10
  const suggestedPriceUSD = Math.round(listing.unitPriceUSD * (1 + deltaPercent / 100))
  const pool = deltaPercent >= 0 ? RISING_RATIONALES : SOFT_RATIONALES
  const template = pool[hashString(`${listing.id}-reason`) % pool.length]
  const rationale = template.replace('{crop}', listing.cropName).replace('{country}', listing.originCountry)
  return { suggestedPriceUSD, deltaPercent, rationale }
}
