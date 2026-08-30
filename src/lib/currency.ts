export type ConverterCurrency = 'USD' | 'EUR' | 'KES' | 'NGN' | 'GHS'

export const CONVERTER_CURRENCIES: { code: ConverterCurrency; label: string }[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
]

// Mock exchange rates against 1 USD. For demo purposes only — not live rates.
const USD_RATES: Record<ConverterCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  KES: 129.5,
  NGN: 1610,
  GHS: 14.8,
}

export function convertFromUSD(amountUSD: number, target: ConverterCurrency): number {
  return amountUSD * USD_RATES[target]
}

export function formatMoney(amount: number, currency: ConverterCurrency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount)
}
