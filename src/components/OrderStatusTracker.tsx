import { ORDER_STAGES, type OrderStatus } from '../types'

export default function OrderStatusTracker({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  const currentIndex = ORDER_STAGES.indexOf(status)

  return (
    <ol className="flex items-center">
      {ORDER_STAGES.map((stage, i) => {
        const done = i <= currentIndex
        return (
          <li key={stage} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-earth-800 text-white' : 'bg-sand-200 text-earth-700/60'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              {!compact && (
                <span
                  className={`max-w-[6rem] text-center text-[11px] leading-tight ${
                    done ? 'font-medium text-earth-950' : 'text-earth-700/60'
                  }`}
                >
                  {stage}
                </span>
              )}
            </div>
            {i < ORDER_STAGES.length - 1 && (
              <span className={`mx-1.5 h-0.5 flex-1 ${i < currentIndex ? 'bg-earth-800' : 'bg-sand-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
