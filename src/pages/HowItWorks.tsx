interface Step {
  title: string
  description: string
  icon: string
}

const FARMER_STEPS: Step[] = [
  {
    title: 'List your produce',
    description: 'Create a listing with crop type, quantity, price, and harvest date in minutes.',
    icon: '📋',
  },
  {
    title: 'Receive buyer inquiries',
    description: 'Any signed-in buyer can message you about a listing — there’s no identity-verification step yet, so use the same judgment you would with any new trade contact.',
    icon: '✅',
  },
  {
    title: 'Secure payment via escrow',
    description: 'Buyer funds are held safely and released once delivery is confirmed on your end.',
    icon: '🔒',
  },
  {
    title: 'Coordinate delivery',
    description: 'Arrange trucking or export freight directly with the buyer over the order’s message thread, and mark each stage complete as it happens. There’s no logistics-partner integration yet — freight itself is still coordinated outside the platform.',
    icon: '🚚',
  },
]

const BUYER_STEPS: Step[] = [
  {
    title: 'Browse verified farms',
    description: 'Filter by crop, country, category, and price to find sources fast. Each listing still shows the farmer’s certifications and verified badge, even though those aren’t filterable criteria yet.',
    icon: '🔍',
  },
  {
    title: 'Request trade samples',
    description: 'Ask any farmer directly in the message thread to ship a sample before you commit to a full order — there’s no dedicated sample-request feature yet, so this is arranged manually between you.',
    icon: '📦',
  },
  {
    title: 'Negotiate with live rates',
    description: 'Discuss pricing in your own currency with built-in multi-currency conversion.',
    icon: '💱',
  },
  {
    title: 'Execute protected trades',
    description: 'Confirm the order and pay into escrow — funds only release once you’re satisfied.',
    icon: '🤝',
  },
]

function StepTrack({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative flex flex-col gap-8 border-l-2 border-sand-200 pl-8">
      {steps.map((step, i) => (
        <li key={step.title} className="relative">
          <span className="absolute -left-[calc(2rem+1px)] flex h-9 w-9 items-center justify-center rounded-full bg-earth-800 text-sm font-bold text-white">
            {i + 1}
          </span>
          <div className="flex items-start gap-3 rounded-xl border border-sand-200 bg-white p-4">
            <span className="text-2xl">{step.icon}</span>
            <div>
              <h3 className="font-semibold text-earth-950">{step.title}</h3>
              <p className="mt-1 text-sm text-earth-700">{step.description}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-earth-950 sm:text-4xl">How Africa Connect Works</h1>
        <p className="mt-3 text-earth-700">
          Whether you're growing it or buying it, every trade follows a transparent, protected path from listing to
          delivery.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          <div className="mb-6 flex items-center gap-2">
            <span className="rounded-full bg-earth-800 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              For Farmers
            </span>
          </div>
          <StepTrack steps={FARMER_STEPS} />
        </div>

        <div>
          <div className="mb-6 flex items-center gap-2">
            <span className="rounded-full bg-clay-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              For Buyers
            </span>
          </div>
          <StepTrack steps={BUYER_STEPS} />
        </div>
      </div>
    </div>
  )
}
