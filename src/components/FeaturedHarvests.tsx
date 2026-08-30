import { useMemo } from 'react'
import { useCrops } from '../context/CropContext'
import { filterCrops } from '../lib/filterCrops'
import type { CropCategory } from '../types'
import CategoryTabs from './CategoryTabs'
import CropCard from './CropCard'

export default function FeaturedHarvests({
  crop,
  location,
  category,
  onCategoryChange,
}: {
  crop: string
  location: string
  category: string
  onCategoryChange: (category: string) => void
}) {
  const { listings } = useCrops()
  const categories: CropCategory[] = useMemo(() => Array.from(new Set(listings.map((c) => c.category))), [listings])

  const results = useMemo(
    () => filterCrops(listings, { crop, location, category }),
    [listings, crop, location, category],
  )

  return (
    <section id="featured-harvests" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-earth-950 sm:text-3xl">Featured Harvests</h2>
          <p className="mt-1 text-earth-700">
            {results.length} listing{results.length === 1 ? '' : 's'}
            {crop && <> matching “{crop}”</>}
            {location && <> in “{location}”</>}
          </p>
        </div>
        <CategoryTabs categories={categories} active={category} onChange={onCategoryChange} />
      </div>

      {results.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((listing) => (
            <CropCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-sand-200 bg-white py-16 text-center text-earth-700">
          No harvests match your search. Try a different crop or location.
        </div>
      )}
    </section>
  )
}
