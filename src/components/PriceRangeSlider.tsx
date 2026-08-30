export default function PriceRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
}: {
  min: number
  max: number
  valueMin: number
  valueMax: number
  onChange: (range: { min: number; max: number }) => void
}) {
  const lowPercent = ((valueMin - min) / (max - min)) * 100
  const highPercent = ((valueMax - min) / (max - min)) * 100

  function handleMinChange(next: number) {
    onChange({ min: Math.min(next, valueMax - 1), max: valueMax })
  }

  function handleMaxChange(next: number) {
    onChange({ min: valueMin, max: Math.max(next, valueMin + 1) })
  }

  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-sand-200">
        <div
          className="absolute h-1.5 rounded-full bg-earth-700"
          style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={valueMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          className="range-thumb pointer-events-none absolute inset-0 h-1.5 w-full appearance-none bg-transparent"
          aria-label="Minimum price"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={valueMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          className="range-thumb pointer-events-none absolute inset-0 h-1.5 w-full appearance-none bg-transparent"
          aria-label="Maximum price"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm font-medium text-earth-800">
        <span>${valueMin.toLocaleString()}</span>
        <span>${valueMax.toLocaleString()}</span>
      </div>
    </div>
  )
}
