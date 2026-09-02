const STEPS = ['Review specifications', 'Request quote', 'Negotiate', 'Accept offer', 'Fund escrow'] as const

export type TradeJourneyStep = 1 | 2 | 3 | 4 | 5

/**
 * Compact, read-only progress strip narrating where a listing/order sits in
 * the trade flow. Purely presentational — doesn't gate or drive any action,
 * just orients the buyer/farmer within a journey that otherwise spans three
 * separate views (listing modal, messages, escrow modal).
 */
export default function TradeJourneySteps({ current }: { current: TradeJourneyStep }) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Trade journey progress">
      {STEPS.map((label, i) => {
        const step = (i + 1) as TradeJourneyStep
        const done = step < current
        const active = step === current
        return (
          <li key={label} className="flex flex-1 items-center gap-1.5 sm:gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                aria-current={active ? 'step' : undefined}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? 'bg-earth-800 text-white'
                    : active
                      ? 'border-2 border-earth-800 text-earth-800'
                      : 'border border-sand-300 text-earth-700/50'
                }`}
              >
                {done ? '✓' : step}
              </span>
              <span
                className={`hidden truncate text-center text-[11px] leading-tight sm:block ${
                  active ? 'font-semibold text-earth-950' : done ? 'text-earth-700' : 'text-earth-700/50'
                }`}
              >
                {label}
              </span>
            </div>
            {step < STEPS.length && (
              <div className={`h-px flex-1 ${done ? 'bg-earth-800' : 'bg-sand-300'}`} aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}
