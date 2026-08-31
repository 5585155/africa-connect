import { useMemo, useState } from 'react'
import CategoryTabs from '../components/CategoryTabs'
import CropCard from '../components/CropCard'
import MarketAnalyticsBanner from '../components/MarketAnalyticsBanner'
import PriceRangeSlider from '../components/PriceRangeSlider'
import { useCrops } from '../context/CropContext'
import { DEFAULT_FILTERS, filterCrops } from '../lib/filterCrops'
import type { CropCategory } from '../types'

export default function Marketplace() {
  const { listings } = useCrops()
  const CATEGORIES: CropCategory[] = useMemo(() => Array.from(new Set(listings.map((c) => c.category))), [listings])
  const MAX_PRICE = useMemo(() => Math.max(...listings.map((c) => c.unitPriceUSD), 0), [listings])

  const [crop, setCrop] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('All')
  const [priceRange, setPriceRange] = useState({ min: 0, max: MAX_PRICE })
  const [minQuantity, setMinQuantity] = useState(0)
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const results = useMemo(
    () =>
      filterCrops(listings, {
        crop,
        location,
        category,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        minQuantity,
        verifiedOnly,
      }),
    [listings, crop, location, category, priceRange, minQuantity, verifiedOnly],
  )

  function resetFilters() {
    setCrop('')
    setLocation('')
    setCategory('All')
    setPriceRange({ min: 0, max: MAX_PRICE })
    setMinQuantity(0)
    setVerifiedOnly(false)
  }

  const filtersActive =
    crop !== DEFAULT_FILTERS.crop ||
    location !== DEFAULT_FILTERS.location ||
    category !== DEFAULT_FILTERS.category ||
    priceRange.min !== 0 ||
    priceRange.max !== MAX_PRICE ||
    minQuantity !== DEFAULT_FILTERS.minQuantity ||
    verifiedOnly !== DEFAULT_FILTERS.verifiedOnly

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-earth-950">Marketplace</h1>
        <p className="mt-1 text-earth-700">Browse every listing and narrow down with advanced filters.</p>
      </div>

      <MarketAnalyticsBanner listings={listings} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border border-sand-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-earth-950">Filters</h2>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-clay-600 hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-5">
            <div>
              <label htmlFor="crop-filter" className="mb-1 block text-sm font-medium text-earth-800">
                Crop type
              </label>
              <input
                id="crop-filter"
                type="text"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                placeholder="e.g. Maize"
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>

            <div>
              <label htmlFor="location-filter" className="mb-1 block text-sm font-medium text-earth-800">
                Location
              </label>
              <input
                id="location-filter"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Kenya"
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-earth-800">Category</p>
              <CategoryTabs categories={CATEGORIES} active={category} onChange={setCategory} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-earth-800">Price range (USD / ton)</p>
              <PriceRangeSlider
                min={0}
                max={MAX_PRICE}
                valueMin={priceRange.min}
                valueMax={priceRange.max}
                onChange={setPriceRange}
              />
            </div>

            <div>
              <label htmlFor="min-quantity" className="mb-1 block text-sm font-medium text-earth-800">
                Minimum order quantity (tons)
              </label>
              <input
                id="min-quantity"
                type="number"
                min={0}
                value={minQuantity}
                onChange={(e) => setMinQuantity(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-earth-600"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-sand-200 px-3 py-2.5">
              <span className="text-sm font-medium text-earth-800">Verified farmers only</span>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 accent-earth-800"
              />
            </label>
          </div>
        </aside>

        <div>
          <p className="mb-4 text-earth-700">
            {results.length} listing{results.length === 1 ? '' : 's'} found
          </p>

          {results.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((listing) => (
                <CropCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-sand-200 bg-white py-16 text-center text-earth-700">
              No listings match your filters. Try widening your search.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
