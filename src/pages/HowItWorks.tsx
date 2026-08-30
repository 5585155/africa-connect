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
    title: 'Receive verified inquiries',
    description: 'Only identity-checked buyers can message you, so every inquiry is worth your time.',
    icon: '✅',
  },
  {
    title: 'Secure payment via escrow',
    description: 'Buyer funds are held safely and released once delivery is confirmed on your end.',
    icon: '🔒',
  },
  {
    title: 'Coordinate delivery',
    description: 'Arrange regional trucking or export freight with logistics partners built into the platform.',
    icon: '🚚',
  },
]

const BUYER_STEPS: Step[] = [
  {
    title: 'Browse verified farms',
    description: 'Filter by crop, country, certification, and price to find trusted sources fast.',
    icon: '🔍',
  },
  {
    title: 'Request trade samples',
    description: 'Ask any farmer to ship a sample before you commit to a full order.',
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
