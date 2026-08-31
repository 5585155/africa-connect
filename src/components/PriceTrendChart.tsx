import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { generatePriceForecast } from '../lib/priceForecast'

interface TooltipPayloadItem {
  dataKey: string
  value: number | [number, number]
}

function PriceTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null
  const actual = payload.find((p) => p.dataKey === 'actual')?.value as number | undefined
  const predicted = payload.find((p) => p.dataKey === 'predicted')?.value as number | undefined
  const range = payload.find((p) => p.dataKey === 'range')?.value as [number, number] | undefined

  return (
    <div className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-earth-950">{label}</p>
      {actual != null && <p className="mt-0.5 text-earth-800">Actual: ${actual.toLocaleString()}</p>}
      {predicted != null && <p className="mt-0.5 text-clay-700">AI Predicted: ${predicted.toLocaleString()}</p>}
      {range && (
        <p className="mt-0.5 text-earth-700/70">
          Confidence range: ${range[0].toLocaleString()}–${range[1].toLocaleString()}
        </p>
      )}
    </div>
  )
}

export default function PriceTrendChart({
  listingId,
  cropName,
  unitPriceUSD,
}: {
  listingId: string
  cropName: string
  unitPriceUSD: number
}) {
  const { points, changePercent, insight } = useMemo(
    () => generatePriceForecast(listingId, unitPriceUSD),
    [listingId, unitPriceUSD],
  )
  const rising = changePercent >= 0

  return (
    <div className="rounded-xl border border-sand-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-earth-950">Price Trend — {cropName}</h3>
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            rising ? 'bg-earth-600/10 text-earth-700' : 'bg-clay-600/10 text-clay-700'
          }`}
        >
          {rising ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {rising ? '+' : ''}
          {changePercent}% / 3mo
        </span>
      </div>

      <div className="mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={`range-${listingId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-earth-500)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-earth-500)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-sand-200)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-earth-700)' }} axisLine={{ stroke: 'var(--color-sand-200)' }} />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-earth-700)' }}
              width={48}
              axisLine={{ stroke: 'var(--color-sand-200)' }}
              tickFormatter={(value: number) => `$${value}`}
            />
            <Tooltip content={<PriceTooltip />} />
            <Area
              type="monotone"
              dataKey="range"
              stroke="none"
              fill={`url(#range-${listingId})`}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="var(--color-earth-800)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              name="AI Predicted"
              stroke="var(--color-clay-600)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-earth-600/5 p-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-earth-700" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-earth-700">AI Market Insight</p>
          <p className="mt-0.5 text-sm text-earth-800">{insight}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-earth-700/60">
        Simulated forecast for demonstration only — not real market data or financial advice.
      </p>
    </div>
  )
}
