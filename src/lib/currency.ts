import { useEffect, useState } from 'react'

export type ConverterCurrency = 'USD' | 'EUR' | 'KES' | 'NGN' | 'GHS' | 'ETB'

export const CONVERTER_CURRENCIES: { code: ConverterCurrency; label: string }[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'ETB', label: 'ETB — Ethiopian Birr' },
]

/** Static rates against 1 USD — used until a live fetch succeeds, and forever if it never does. */
const STATIC_FALLBACK_RATES: Record<ConverterCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  KES: 129.5,
  NGN: 1610,
  GHS: 14.8,
  ETB: 123.5,
}

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD'
const CACHE_KEY = 'ac-exchange-rates'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // refresh at most once a day
const FETCH_TIMEOUT_MS = 6000

export type RateSource = 'live' | 'fallback'

export interface RateSnapshot {
  rates: Record<ConverterCurrency, number>
  fetchedAt: number
  source: RateSource
}

const FALLBACK_SNAPSHOT: RateSnapshot = { rates: STATIC_FALLBACK_RATES, fetchedAt: 0, source: 'fallback' }

function readCache(): RateSnapshot | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RateSnapshot
    if (!parsed?.rates || typeof parsed.fetchedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(snapshot: RateSnapshot) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot))
  } catch {
    // storage unavailable — the in-memory snapshot still works for this session
  }
}

/** Best-effort synchronous read for code that can't await a fetch (e.g. first paint). */
export function getRatesSync(): RateSnapshot {
  return readCache() ?? FALLBACK_SNAPSHOT
}

async function fetchLiveRates(): Promise<RateSnapshot> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(EXCHANGE_RATE_API_URL, { signal: controller.signal })
    if (!response.ok) throw new Error(`Exchange rate API responded ${response.status}`)

    const body = (await response.json()) as { result?: string; rates?: Record<string, number> }
    if (body.result !== 'success' || !body.rates) throw new Error('Exchange rate API returned an unexpected payload')

    const rates = CONVERTER_CURRENCIES.reduce(
      (acc, { code }) => {
        acc[code] = typeof body.rates![code] === 'number' ? body.rates![code] : STATIC_FALLBACK_RATES[code]
        return acc
      },
      {} as Record<ConverterCurrency, number>,
    )

    const snapshot: RateSnapshot = { rates, fetchedAt: Date.now(), source: 'live' }
    writeCache(snapshot)
    return snapshot
  } finally {
    window.clearTimeout(timeout)
  }
}

/** Returns cached rates instantly, refetching in the background at most once per CACHE_TTL_MS. Never throws. */
export async function ensureFreshRates(): Promise<RateSnapshot> {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached

  try {
    return await fetchLiveRates()
  } catch (error) {
    console.warn('[currency] live exchange rate fetch failed, using fallback rates', error)
    return cached ?? FALLBACK_SNAPSHOT
  }
}

/** Unified converter used across cards, product modals, and checkout forms. */
export function convertCurrency(
  amount: number,
  from: ConverterCurrency,
  to: ConverterCurrency,
  rates: Record<ConverterCurrency, number> = getRatesSync().rates,
): number {
  if (from === to) return amount
  const amountUSD = amount / rates[from]
  return amountUSD * rates[to]
}

export function formatMoney(amount: number, currency: ConverterCurrency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount)
}

/** Drives a live/cached/fallback rate snapshot, fetching once on mount. */
export function useExchangeRates() {
  const [snapshot, setSnapshot] = useState<RateSnapshot>(() => getRatesSync())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ensureFreshRates()
      .then((next) => {
        if (!cancelled) setSnapshot(next)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    ...snapshot,
    loading,
    convert: (amount: number, from: ConverterCurrency, to: ConverterCurrency) =>
      convertCurrency(amount, from, to, snapshot.rates),
  }
}
