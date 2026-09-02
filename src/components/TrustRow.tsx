const ITEMS = [
  { icon: '✅', label: 'Supplier verification signals' },
  { icon: '🔒', label: 'Escrow-ready trade workflow' },
  { icon: '⚖️', label: 'Export requirements surfaced' },
]

/**
 * Compact trust-signal strip pointing at real, existing UI (verification
 * badges on listings, the escrow-funding flow, compliance notes) without
 * overclaiming what's actually live — escrow only actually moves money once
 * a real payment gateway is configured (see EscrowPaymentModal's sandbox
 * fallbacks), and "verified" reflects a farmer-set flag, not a completed
 * external verification process.
 */
export default function TrustRow() {
  return (
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 pb-8 sm:px-6 lg:px-8">
      {ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-sm font-medium text-earth-700">
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </span>
      ))}
    </div>
  )
}
