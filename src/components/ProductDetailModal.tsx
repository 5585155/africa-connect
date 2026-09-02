import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'
import { useMessaging } from '../context/MessagingContext'
import { useOrders } from '../context/OrdersContext'
import { cropFallbackIcon, isImageSource } from '../lib/cropVisuals'
import { CONVERTER_CURRENCIES, formatMoney, type ConverterCurrency } from '../lib/currency'
import { formatHarvestDate } from '../lib/dates'
import { isSupabaseConfigured } from '../lib/supabase'
import type { SellerListing } from '../types'
import ChartFallback from './ChartFallback'
import TradeJourneySteps from './TradeJourneySteps'

const PriceTrendChart = lazy(() => import('./PriceTrendChart'))

export default function ProductDetailModal({
  listing,
  onClose,
}: {
  listing: SellerListing
  onClose: () => void
}) {
  const { user } = useAuth()
  const { startThread } = useMessaging()
  const { createOrder } = useOrders()
  const { currency: displayCurrency, convert } = useCurrency()
  const navigate = useNavigate()
  const [currency, setCurrency] = useState<ConverterCurrency>(displayCurrency)
  const [quantity, setQuantity] = useState(1)
  const [contactError, setContactError] = useState<string | null>(null)
  const [contacting, setContacting] = useState(false)
  const soldOut = listing.status === 'Sold Out'
  // `conversations.farmer_id` / `orders.farmer_id` are NOT NULL in Supabase — a
  // listing with no linked farmer account (e.g. demo/seed catalog data) can
  // never actually be contacted there, so disable it up front instead of
  // letting the click silently do nothing.
  const missingFarmerLink = isSupabaseConfigured && !listing.farmerId
  const contactDisabled = soldOut || missingFarmerLink || contacting

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const totalUSD = listing.unitPriceUSD * quantity
  const converted = convert(totalUSD, 'USD', currency)

  async function handleContactFarmer() {
    console.log('[ProductDetailModal] Request Quote clicked', {
      listingId: listing.id,
      farmerId: listing.farmerId,
      userId: user?.id ?? null,
      contactDisabled,
    })

    if (!user) {
      // Give a visible reason before leaving — an instant, silent redirect
      // reads as "the button did nothing" (which is exactly the bug report
      // this was written to fix): show why, then hand off to /auth.
      setContactError('Please sign in to contact this farmer — redirecting you to sign in…')
      window.setTimeout(() => {
        onClose()
        navigate('/auth')
      }, 900)
      return
    }

    setContactError(null)
    setContacting(true)

    try {
      const threadId = await startThread({
        listingId: listing.id,
        cropName: listing.cropName,
        counterpartName: listing.farmerName,
        counterpartId: listing.farmerId,
        initialMessage: `Hi ${listing.farmerName}, I'm interested in your ${listing.cropName} — is ${quantity} ton${
          quantity === 1 ? '' : 's'
        } still available at $${listing.unitPriceUSD.toLocaleString()}/ton?`,
      })

      if (!threadId) {
        throw new Error('Could not start this conversation. Please try again.')
      }

      // Awaited so the order row is guaranteed to exist (idempotent — reuses
      // the existing order when this thread already has one) before we hand
      // off to /messages, instead of firing the insert and hoping it lands
      // before that page renders the offer bubble.
      await createOrder({
        threadId,
        listingId: listing.id,
        cropName: listing.cropName,
        farmerName: listing.farmerName,
        farmerId: listing.farmerId,
        buyerName: user.name,
        quantity,
        unitPriceUSD: listing.unitPriceUSD,
      })

      onClose()
      navigate(`/messages?thread=${threadId}`)
    } catch (error) {
      console.error('[ProductDetailModal] handleContactFarmer failed', error)
      setContactError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
      setContacting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-sand-200 bg-earth-800 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-4xl">
              {isImageSource(listing.image) ? (
                <img src={listing.image} alt="" className="h-full w-full object-cover" />
              ) : (
                cropFallbackIcon(listing.cropName, listing.category)
              )}
            </div>
            <div>
              <h2 id="product-modal-title" className="text-xl font-bold">
                {listing.cropName}
              </h2>
              <p className="text-sand-100">
                {listing.category} · {listing.originCountry}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-b border-sand-200 bg-sand-50 px-6 py-4">
          <TradeJourneySteps current={1} />
        </div>

        <div className="p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {listing.status !== 'Available' && (
              <span className="inline-flex items-center rounded-full bg-clay-600/10 px-3 py-1 text-sm font-semibold text-clay-700">
                {listing.status}
              </span>
            )}
            {listing.verifiedStatus && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-earth-600/10 px-3 py-1 text-sm font-semibold text-earth-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
                Verified Farmer
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-xl bg-sand-50 p-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-earth-700/70">Available</dt>
              <dd className="mt-0.5 font-semibold text-earth-950">{listing.availableQuantity} t</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-earth-700/70">Price / ton</dt>
              <dd className="mt-0.5 font-semibold text-earth-950">${listing.unitPriceUSD.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-earth-700/70">Farmer</dt>
              <dd className="mt-0.5 font-semibold text-earth-950">{listing.farmerName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-earth-700/70">Harvest date</dt>
              <dd className="mt-0.5 font-semibold text-earth-950">
                {formatHarvestDate(listing.harvestDate)}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-earth-950">Specification</h3>
            <dl className="divide-y divide-sand-200 rounded-xl border border-sand-200 text-sm">
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-earth-700/70">Category</dt>
                <dd className="font-medium text-earth-950">{listing.category}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-earth-700/70">Country of origin</dt>
                <dd className="font-medium text-earth-950">{listing.originCountry}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-earth-700/70">Supplier verification</dt>
                <dd className="font-medium text-earth-950">
                  {listing.verifiedStatus ? 'Verified farmer' : 'Not yet verified'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-earth-700/70">Export channel</dt>
                <dd className="font-medium text-earth-950">
                  {listing.exportMonopoly ? 'State-approved board / LBC aggregator' : 'Direct export'}
                </dd>
              </div>
              <div className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-earth-700/70">Certifications</dt>
                <dd className="font-medium text-earth-950">
                  {listing.certifications.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {listing.certifications.map((cert) => (
                        <span
                          key={cert}
                          className="rounded-full border border-earth-600/30 bg-earth-600/10 px-2.5 py-0.5 text-xs font-semibold text-earth-700"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-earth-700/70">None on file</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {(listing.complianceNote || listing.exportMonopoly) && (
            <div className="mt-5 rounded-xl border border-clay-600/30 bg-clay-600/5 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-clay-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
                  />
                </svg>
                Regulatory &amp; Export Compliance
              </h3>
              {listing.complianceNote && (
                <p className="mt-1.5 text-sm text-earth-800">{listing.complianceNote}</p>
              )}
              {listing.exportMonopoly && (
                <p className="mt-1.5 text-xs font-medium text-clay-700">
                  Export managed via state-approved LBC / Board aggregator.
                </p>
              )}
            </div>
          )}

          <div className="mt-5">
            <Suspense fallback={<ChartFallback height={340} />}>
              <PriceTrendChart listingId={listing.id} cropName={listing.cropName} unitPriceUSD={listing.unitPriceUSD} />
            </Suspense>
          </div>

          <div className="mt-6 rounded-xl border border-sand-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-earth-950">Currency converter</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="modal-quantity" className="mb-1 block text-xs font-medium text-earth-700">
                  Quantity (tons)
                </label>
                <input
                  id="modal-quantity"
                  type="number"
                  min={1}
                  max={listing.availableQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(listing.availableQuantity, Number(e.target.value))))}
                  className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="modal-currency" className="mb-1 block text-xs font-medium text-earth-700">
                  Convert to
                </label>
                <select
                  id="modal-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as ConverterCurrency)}
                  className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:border-earth-600"
                >
                  {CONVERTER_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-earth-800 px-4 py-3 text-white">
              <span className="text-sm text-sand-100">
                {quantity} t × ${listing.unitPriceUSD.toLocaleString()} = ${totalUSD.toLocaleString()}
              </span>
              <span className="text-lg font-bold">{formatMoney(converted, currency)}</span>
            </div>
            <p className="mt-1.5 text-xs text-earth-700/60">
              Indicative rate only. Final settlement rate is confirmed at time of trade.
            </p>
          </div>

          {contactError && (
            <p role="alert" className="mt-4 rounded-lg bg-clay-600/10 px-3 py-2 text-sm text-clay-700">
              {contactError}
            </p>
          )}

          <button
            type="button"
            disabled={contactDisabled}
            onClick={handleContactFarmer}
            className="mt-4 w-full rounded-xl bg-earth-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-earth-700 disabled:cursor-not-allowed disabled:bg-sand-200 disabled:text-earth-700/60"
          >
            {soldOut
              ? 'Sold Out'
              : contacting
                ? 'Starting conversation…'
                : missingFarmerLink
                  ? 'Not Linked to a Farmer Account'
                  : 'Request Quote'}
          </button>
          {missingFarmerLink && (
            <p className="mt-1.5 text-xs text-earth-700/60">
              This listing isn't linked to a farmer account yet, so it can't be contacted directly.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
