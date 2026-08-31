import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { CONVERTER_CURRENCIES, type ConverterCurrency } from '../lib/currency'
import type { Language } from '../types'
import { LANGUAGES } from '../types'
import UserMenu from './UserMenu'

const NAV_LINKS = [
  { label: 'Marketplace', to: '/marketplace' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Community', to: '/community' },
  { label: 'Support', to: '/support' },
  { label: 'Invest', to: '/invest' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const { currency, setCurrency, source: rateSource } = useCurrency()
  const [language, setLanguage] = useState<Language>('en')

  return (
    <header className="sticky top-0 z-50 bg-earth-800 text-sand-50 shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-earth-600 text-base">
            🌍
          </span>
          Africa Connect
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-sm font-medium text-sand-100 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <UserMenu />
          <RegionDropdown
            open={regionOpen}
            setOpen={setRegionOpen}
            currency={currency}
            setCurrency={setCurrency}
            rateSource={rateSource}
            language={language}
            setLanguage={setLanguage}
          />
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-sand-100 hover:bg-earth-700 md:hidden"
        >
          <span className="sr-only">Toggle menu</span>
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-earth-700 bg-earth-800 px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-sm font-medium text-sand-100 hover:bg-earth-700 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-3 flex flex-col gap-3 border-t border-earth-700 pt-3">
            <UserMenu fullWidth />
            <RegionDropdown
              open={regionOpen}
              setOpen={setRegionOpen}
              currency={currency}
              setCurrency={setCurrency}
              rateSource={rateSource}
              language={language}
              setLanguage={setLanguage}
              fullWidth
            />
          </div>
        </div>
      )}
    </header>
  )
}

function RegionDropdown({
  open,
  setOpen,
  currency,
  setCurrency,
  rateSource,
  language,
  setLanguage,
  fullWidth = false,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  currency: ConverterCurrency
  setCurrency: (currency: ConverterCurrency) => void
  rateSource: 'live' | 'fallback'
  language: Language
  setLanguage: (language: Language) => void
  fullWidth?: boolean
}) {
  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 rounded-md border border-earth-600 bg-earth-800 px-3 py-1.5 text-sm font-medium text-sand-100 hover:bg-earth-700 ${
          fullWidth ? 'w-full' : ''
        }`}
      >
        <span>
          {currency} · {LANGUAGES.find((l) => l.code === language)?.label}
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-earth-200 bg-white p-3 text-earth-950 shadow-lg">
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-earth-700">Currency</p>
              <span
                className={`flex items-center gap-1 text-[10px] font-medium ${
                  rateSource === 'live' ? 'text-earth-600' : 'text-clay-600'
                }`}
                title={rateSource === 'live' ? 'Live exchange rates' : 'Offline — using static rates'}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${rateSource === 'live' ? 'bg-earth-600' : 'bg-clay-600'}`} />
                {rateSource === 'live' ? 'Live rates' : 'Static rates'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {CONVERTER_CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrency(c.code)}
                  className={`rounded-md px-2 py-1.5 text-left text-sm ${
                    currency === c.code
                      ? 'bg-earth-800 text-white'
                      : 'hover:bg-sand-100'
                  }`}
                >
                  {c.code}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-earth-700">Language</p>
            <div className="grid grid-cols-2 gap-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  className={`rounded-md px-2 py-1.5 text-left text-sm ${
                    language === l.code
                      ? 'bg-earth-800 text-white'
                      : 'hover:bg-sand-100'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
