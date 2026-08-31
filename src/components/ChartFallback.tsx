export default function ChartFallback({ height = 224 }: { height?: number }) {
  return (
    <div
      className="flex w-full animate-pulse items-center justify-center rounded-xl border border-sand-200 bg-sand-50 text-xs text-earth-700/60"
      style={{ height }}
    >
      Loading chart…
    </div>
  )
}
