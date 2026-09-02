import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ARROW = (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 text-earth-700/50 transition-transform group-hover:translate-x-0.5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
)

/** Full card styling applied directly to whichever element is actually interactive — never a div wrapped in a separate Link/button. */
const CARD_CLASSES =
  'group flex flex-col gap-1.5 rounded-2xl border border-sand-200 bg-white p-5 text-left transition-colors hover:border-earth-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-earth-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'

function CardBody({ icon, title, description, children }: { icon: string; title: string; description: string; children?: ReactNode }) {
  return (
    <>
      <span className="flex items-center gap-2 text-lg font-bold text-earth-950">
        {icon} {title}
        {ARROW}
      </span>
      <p className="text-sm text-earth-700">{description}</p>
      {children}
    </>
  )
}

/** Renders as a Link (`to`) or a button (`onClick`) — the polymorphic element itself carries CARD_CLASSES, so there's exactly one interactive element per card and no div-in-button/contents-hack nesting. */
function CardShell(
  props: { icon: string; title: string; description: string; children?: ReactNode } & (
    | { to: string; onClick?: undefined; disabled?: undefined }
    | { onClick: () => void; disabled?: boolean; to?: undefined }
  ),
) {
  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={CARD_CLASSES}>
        <CardBody icon={props.icon} title={props.title} description={props.description}>
          {props.children}
        </CardBody>
      </Link>
    )
  }
  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled} className={CARD_CLASSES}>
      <CardBody icon={props.icon} title={props.title} description={props.description}>
        {props.children}
      </CardBody>
    </button>
  )
}

/** Two-path entry point right under the Hero search — the two things a first-time visitor actually wants to do. */
export default function SourceOrSell() {
  const { user, switchRole } = useAuth()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  async function handleSwitchToFarmer() {
    setSwitching(true)
    setSwitchError(null)
    const result = await switchRole('farmer')
    setSwitching(false)
    if (result.error) {
      setSwitchError(result.error)
      return
    }
    navigate('/farmer/dashboard')
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pb-4 pt-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CardShell
          to="/marketplace"
          icon="🌍"
          title="Source Produce"
          description="Browse agricultural listings by crop, origin, and certification, and request a quote directly from the farmer."
        />

        {!user || user.role === 'farmer' ? (
          // Signed out (lands on /auth's Farmer + Sign Up defaults) or
          // already a farmer — a plain link is enough either way.
          <CardShell
            to={user ? '/farmer/dashboard' : '/auth'}
            icon="🌱"
            title="Sell Produce"
            description="List your harvest, field quotes from serious buyers, and get paid through a structured escrow workflow."
          />
        ) : (
          // Signed in as a buyer — /farmer/dashboard would just dead-end them
          // behind ProtectedRoute's "sign in required" gate, so this switches
          // their existing account's workspace instead, with visible
          // in-progress/error feedback rather than a silent redirect.
          <CardShell
            onClick={handleSwitchToFarmer}
            disabled={switching}
            icon="🌱"
            title="Sell Produce"
            description="List your harvest, field quotes from serious buyers, and get paid through a structured escrow workflow."
          >
            <span className="mt-1 text-xs font-semibold text-earth-800">
              {switching ? 'Switching to seller workspace…' : 'Switch to seller workspace →'}
            </span>
            {switchError && <span className="mt-1 text-xs text-clay-600">{switchError}</span>}
          </CardShell>
        )}
      </div>
    </section>
  )
}
