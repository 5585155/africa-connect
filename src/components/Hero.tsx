import type { FormEvent } from 'react'

const CROP_SUGGESTIONS = ['Maize', 'Coffee', 'Cassava', 'Cocoa', 'Rice', 'Avocado']

export default function Hero({
  crop,
  location,
  onCropChange,
  onLocationChange,
  onSubmit,
}: {
  crop: string
  location: string
  onCropChange: (crop: string) => void
  onLocationChange: (location: string) => void
  onSubmit?: () => void
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-earth-800 via-earth-700 to-earth-900 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, var(--color-earth-500) 0, transparent 40%), radial-gradient(circle at 80% 60%, var(--color-clay-600) 0, transparent 45%)',
        }}
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
        <span className="mb-4 rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-sand-100">
          Connecting African farmers to buyers, directly
        </span>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Fresh produce, sourced straight from the farm
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-sand-100">
          Search thousands of listings across the continent by crop type or
          location, and connect directly with the farmers and buyers behind
          them.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex w-full max-w-3xl flex-col gap-3 rounded-2xl bg-white p-3 text-earth-950 shadow-2xl sm:flex-row sm:items-center sm:gap-2"
        >
          <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 sm:border-r sm:border-sand-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-earth-700" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18c-4 3-6 6-6 9s2 6 6 9c4-3 6-6 6-9s-2-6-6-9Z" />
            </svg>
            <input
              type="text"
              value={crop}
              onChange={(e) => onCropChange(e.target.value)}
              list="crop-suggestions"
              placeholder="Crop type, e.g. Maize"
              className="w-full bg-transparent text-sm outline-none placeholder:text-earth-700/60"
            />
            <datalist id="crop-suggestions">
              {CROP_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-earth-700" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 6-7.5 10.5-7.5 10.5S4.5 16.5 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            <input
              type="text"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="Location, e.g. Nairobi, Kenya"
              className="w-full bg-transparent text-sm outline-none placeholder:text-earth-700/60"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-earth-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-earth-700"
          >
            Search Produce
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-sand-100">
          <span className="text-sand-100/70">Popular:</span>
          {CROP_SUGGESTIONS.slice(0, 4).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCropChange(c)}
              className="rounded-full border border-white/20 px-3 py-1 transition-colors hover:bg-white/10"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
