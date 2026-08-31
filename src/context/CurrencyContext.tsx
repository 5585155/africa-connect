import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { convertCurrency, useExchangeRates, type ConverterCurrency, type RateSource } from '../lib/currency'

interface CurrencyContextValue {
  currency: ConverterCurrency
  setCurrency: (currency: ConverterCurrency) => void
  rates: Record<ConverterCurrency, number>
  source: RateSource
  loading: boolean
  fetchedAt: number
  convert: (amount: number, from?: ConverterCurrency, to?: ConverterCurrency) => number
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useLocalStorage<ConverterCurrency>('ac-display-currency', 'USD')
  const { rates, source, loading, fetchedAt } = useExchangeRates()

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      rates,
      source,
      loading,
      fetchedAt,
      convert: (amount, from = 'USD', to = currency) => convertCurrency(amount, from, to, rates),
    }),
    [currency, setCurrency, rates, source, loading, fetchedAt],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
