import { Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { generateDemandRadar, suggestOptimalPrice } from '../lib/demandForecast'
import type { SellerListing } from '../types'

export default function AIPricingRadar({ listings }: { listings: SellerListing[] }) {
  const activeListings = useMemo(() => listings.filter((l) => l.status === 'Available'), [listings])
  const primaryCategory = activeListings[0]?.category
  const radarData = useMemo(
    () => (primaryCategory ? generateDemandRadar(primaryCategory) : []),
    [primaryCategory],
  )

  if (activeListings.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-earth-700" />
        <h2 className="text-lg font-bold text-earth-950">AI Pricing Suggestion &amp; Demand Radar</h2>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-earth-800">Suggested pricing</p>
          <div className="flex flex-col gap-2">
            {activeListings.slice(0, 4).map((listing) => {
              const { suggestedPriceUSD, deltaPercent, rationale } = suggestOptimalPrice(listing)
              const rising = deltaPercent >= 0
              return (
                <div key={listing.id} className="rounded-xl border border-sand-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-earth-950">{listing.cropName}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        rising ? 'bg-earth-600/10 text-earth-700' : 'bg-clay-600/10 text-clay-700'
                      }`}
                    >
                      {rising ? '+' : ''}
                      {deltaPercent}% suggested
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-earth-800">
                    Current: ${listing.unitPriceUSD.toLocaleString()}/t → Suggested: $
                    {suggestedPriceUSD.toLocaleString()}/t
                  </p>
                  <p className="mt-1 text-xs text-earth-700/70">{rationale}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-earth-800">Demand Radar — {primaryCategory}</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="var(--color-sand-200)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'var(--color-earth-700)' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--color-earth-700)' }} axisLine={false} />
                <Radar
                  dataKey="score"
                  stroke="var(--color-earth-700)"
                  fill="var(--color-earth-500)"
                  fillOpacity={0.45}
                  isAnimationActive={false}
                />
                <Tooltip
                  formatter={(value) => [`${value} / 100`, 'Demand score']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-sand-200)' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-earth-700/60">
        Simulated AI analysis for demonstration — pricing decisions remain yours.
      </p>
    </div>
  )
}
