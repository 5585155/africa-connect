// Server-side mirror of src/lib/currency.ts's conversion, used only to
// independently recompute what a checkout should cost — see
// api/create-payment-attempt.ts. Duplicated rather than imported because
// src/lib/currency.ts is browser-only (window.fetch with an AbortController
// tied to a timeout, window.localStorage caching); the actual conversion
// math and fallback table are kept identical on purpose and must stay that
// way if either file's rates change.
export type SupportedCurrency = 'USD' | 'EUR' | 'KES' | 'NGN' | 'GHS' | 'ETB'

const STATIC_FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  KES: 129.5,
  NGN: 1610,
  GHS: 14.8,
  ETB: 123.5,
}

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD'
const FETCH_TIMEOUT_MS = 4000

let cachedRates: { rates: Record<SupportedCurrency, number>; fetchedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // short-lived — serverless functions don't share memory across cold starts anyway

async function fetchLiveRates(): Promise<Record<SupportedCurrency, number>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL, { signal: controller.signal })
    if (!response.ok) throw new Error(`Exchange rate API responded ${response.status}`)
    const body = (await response.json()) as { result?: string; rates?: Record<string, number> }
    if (body.result !== 'success' || !body.rates) throw new Error('Exchange rate API returned an unexpected payload')

    const rates = {} as Record<SupportedCurrency, number>
    for (const code of Object.keys(STATIC_FALLBACK_RATES) as SupportedCurrency[]) {
      rates[code] = typeof body.rates[code] === 'number' ? body.rates[code] : STATIC_FALLBACK_RATES[code]
    }
    return rates
  } finally {
    clearTimeout(timeout)
  }
}

/** Best-effort live rates with a same-process cache; never throws — falls back to the static table. */
export async function getServerFxRates(): Promise<Record<SupportedCurrency, number>> {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_TTL_MS) return cachedRates.rates
  try {
    const rates = await fetchLiveRates()
    cachedRates = { rates, fetchedAt: Date.now() }
    return rates
  } catch (error) {
    console.warn('[api/fx] live exchange rate fetch failed, using static fallback rates', error)
    return STATIC_FALLBACK_RATES
  }
}

export function convertWithRates(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  rates: Record<SupportedCurrency, number>,
): number {
  if (from === to) return amount
  const amountUSD = amount / rates[from]
  return amountUSD * rates[to]
}

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return value in STATIC_FALLBACK_RATES
}
