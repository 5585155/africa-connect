import { Sparkles } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'

interface CategorySupply {
  category: string
  tons: number
}

export default function MarketAnalyticsPanel({
  supplyByCategory,
  totalTons,
  verifiedShare,
}: {
  supplyByCategory: CategorySupply[]
  totalTons: number
  verifiedShare: number
}) {
  const topCategory = supplyByCategory[0]

  return (
    <div className="border-t border-sand-200 p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={supplyByCategory} outerRadius="72%">
              <PolarGrid stroke="var(--color-sand-200)" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: 'var(--color-earth-700)' }} />
              <PolarRadiusAxis tick={{ fontSize: 9, fill: 'var(--color-earth-700)' }} axisLine={false} />
              <Radar
                dataKey="tons"
                stroke="var(--color-earth-700)"
                fill="var(--color-earth-500)"
                fillOpacity={0.45}
                isAnimationActive={false}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString()} t`, 'Available supply']}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--color-sand-200)' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col justify-center gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-sand-50 p-3">
              <p className="text-xs text-earth-700/70">Total supply listed</p>
              <p className="mt-0.5 text-lg font-bold text-earth-950">{totalTons.toLocaleString()} t</p>
            </div>
            <div className="rounded-xl bg-sand-50 p-3">
              <p className="text-xs text-earth-700/70">Verified listings</p>
              <p className="mt-0.5 text-lg font-bold text-earth-950">{verifiedShare}%</p>
            </div>
          </div>

          {topCategory && (
            <div className="flex items-start gap-2 rounded-lg bg-earth-600/5 p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-earth-700" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-earth-700">AI Market Insight</p>
                <p className="mt-0.5 text-sm text-earth-800">
                  {topCategory.category} currently leads marketplace supply at {topCategory.tons.toLocaleString()}{' '}
                  tons across all listings — buyers may find the most competitive pricing here, while less-supplied
                  categories may command a premium.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-[11px] text-earth-700/60">
        Supply figures reflect current marketplace listings. AI insight is simulated for demonstration.
      </p>
    </div>
  )
}
