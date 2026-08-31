import { ChevronDown, Radar as RadarIcon } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { SellerListing } from '../types'
import ChartFallback from './ChartFallback'

const MarketAnalyticsPanel = lazy(() => import('./MarketAnalyticsPanel'))

export default function MarketAnalyticsBanner({ listings }: { listings: SellerListing[] }) {
  const [expanded, setExpanded] = useState(false)

  const supplyByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const listing of listings) {
      totals.set(listing.category, (totals.get(listing.category) ?? 0) + listing.availableQuantity)
    }
    return [...totals.entries()]
      .map(([category, tons]) => ({ category, tons }))
      .sort((a, b) => b.tons - a.tons)
  }, [listings])

  const totalTons = supplyByCategory.reduce((sum, c) => sum + c.tons, 0)
  const verifiedShare = listings.length
    ? Math.round((listings.filter((l) => l.verifiedStatus).length / listings.length) * 100)
    : 0

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-sand-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-earth-950">
          <RadarIcon className="h-5 w-5 text-earth-700" />
          Market Analytics &amp; Crop Supply Radar
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-earth-700 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <Suspense fallback={<ChartFallback height={280} />}>
          <MarketAnalyticsPanel supplyByCategory={supplyByCategory} totalTons={totalTons} verifiedShare={verifiedShare} />
        </Suspense>
      )}
    </div>
  )
}
