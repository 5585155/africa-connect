import { useState } from 'react'
import { useCurrency } from '../context/CurrencyContext'
import { useWatchlist } from '../context/WatchlistContext'
import { formatMoney } from '../lib/currency'
import { formatHarvestDate } from '../lib/dates'
import type { SellerListing } from '../types'
import ProductDetailModal from './ProductDetailModal'

const STATUS_STYLES: Record<string, string> = {
  'Sold Out': 'bg-clay-600/10 text-clay-700',
  'In Transit': 'bg-earth-600/10 text-earth-700',
}

export default function CropCard({ listing }: { listing: SellerListing }) {
  const [open, setOpen] = useState(false)
  const { isSaved, toggleSaved } = useWatchlist()
  const { currency, convert } = useCurrency()
  const saved = isSaved(listing.id)
  const soldOut = listing.status === 'Sold Out'

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="flex cursor-pointer flex-col rounded-2xl border border-sand-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand-100 text-3xl">
            {listing.image.startsWith('data:') ? (
              <img src={listing.image} alt="" className="h-full w-full object-cover" />
            ) : (
              listing.image
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleSaved(listing.id)
              }}
              aria-label={saved ? 'Remove from watchlist' : 'Save to watchlist'}
              aria-pressed={saved}
              className="flex h-7 w-7 items-center justify-center rounded-full text-earth-700 hover:bg-sand-100"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5"
                fill={saved ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"
                />
              </svg>
            </button>
            {listing.status !== 'Available' ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[listing.status]}`}>
                {listing.status}
              </span>
            ) : (
              listing.verifiedStatus && (
                <span className="flex items-center gap-1 rounded-full bg-earth-600/10 px-2.5 py-1 text-xs font-semibold text-earth-700">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                  Verified
                </span>
              )
            )}
          </div>
        </div>

        <h3 className="mt-4 text-lg font-semibold text-earth-950">{listing.cropName}</h3>
        <p className="text-sm text-earth-700">{listing.category}</p>

        {listing.complianceNote && (
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-clay-600/10 px-2.5 py-1 text-xs font-semibold text-clay-700">
            ⚖️ Export Regulated
          </span>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-sm text-earth-800">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 6-7.5 10.5-7.5 10.5S4.5 16.5 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          {listing.originCountry}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-sand-200 pt-4 text-sm">
          <div>
            <dt className="text-earth-700/70">Available</dt>
            <dd className="font-semibold text-earth-950">{listing.availableQuantity} t</dd>
          </div>
          <div>
            <dt className="text-earth-700/70">Price / ton</dt>
            <dd className="font-semibold text-earth-950">
              ${listing.unitPriceUSD.toLocaleString()}
              {currency !== 'USD' && (
                <span className="ml-1 font-normal text-earth-700/70">
                  ≈ {formatMoney(convert(listing.unitPriceUSD, 'USD', currency), currency)}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-earth-700/70">Farmer</dt>
            <dd className="font-semibold text-earth-950">{listing.farmerName}</dd>
          </div>
          <div>
            <dt className="text-earth-700/70">Harvested</dt>
            <dd className="font-semibold text-earth-950">
              {formatHarvestDate(listing.harvestDate, { month: 'short', year: 'numeric' })}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          disabled={soldOut}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          className="mt-5 rounded-xl bg-earth-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-earth-700 disabled:cursor-not-allowed disabled:bg-sand-200 disabled:text-earth-700/60"
        >
          {soldOut ? 'Sold Out' : 'Contact Farmer'}
        </button>
      </div>

      {open && <ProductDetailModal listing={listing} onClose={() => setOpen(false)} />}
    </>
  )
}
