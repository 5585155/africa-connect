import { useEffect, useState } from 'react'

const LOGISTICS_RATE_PER_TON = 18
const ESCROW_FEE_RATE = 0.025

export function computeEscrowBreakdown(quantity: number, unitPriceUSD: number) {
  const cropCostUSD = quantity * unitPriceUSD
  const logisticsUSD = quantity * LOGISTICS_RATE_PER_TON
  const escrowFeeUSD = Math.round(cropCostUSD * ESCROW_FEE_RATE)
  const totalUSD = cropCostUSD + logisticsUSD + escrowFeeUSD
  return { cropCostUSD, logisticsUSD, escrowFeeUSD, totalUSD }
}

export default function EscrowPaymentModal({
  cropName,
  quantity,
  unitPriceUSD,
  onConfirm,
  onClose,
}: {
  cropName: string
  quantity: number
  unitPriceUSD: number
  onConfirm: () => void
  onClose: () => void
}) {
  const { cropCostUSD, logisticsUSD, escrowFeeUSD, totalUSD } = computeEscrowBreakdown(quantity, unitPriceUSD)
  const [complianceChecked, setComplianceChecked] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="escrow-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-sand-200 bg-earth-800 p-5 text-white">
          <h2 id="escrow-modal-title" className="flex items-center gap-2 text-lg font-bold">
            🔒 Fund Escrow Trade
          </h2>
          <p className="mt-0.5 text-sm text-sand-100">
            {quantity} t of {cropName}
          </p>
        </div>

        <div className="p-5">
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-earth-700">
                Crop cost ({quantity} t × ${unitPriceUSD.toLocaleString()})
              </dt>
              <dd className="font-medium text-earth-950">${cropCostUSD.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-earth-700">Logistics estimate</dt>
              <dd className="font-medium text-earth-950">${logisticsUSD.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-earth-700">Escrow protection fee (2.5%)</dt>
              <dd className="font-medium text-earth-950">${escrowFeeUSD.toLocaleString()}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-sand-200 pt-2.5 text-base">
              <dt className="font-semibold text-earth-950">Total due at funding</dt>
              <dd className="font-bold text-earth-950">${totalUSD.toLocaleString()}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-lg border border-clay-600/30 bg-clay-600/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-clay-700">
              🛃 Export Compliance Check
            </p>
            <label className="mt-2 flex items-start gap-2.5 text-sm text-earth-800">
              <input
                type="checkbox"
                checked={complianceChecked}
                onChange={(e) => setComplianceChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-earth-800"
              />
              Verify Government Export License &amp; Phytosanitary Permit for this shipment before funds are released.
            </label>
          </div>

          <p className="mt-4 rounded-lg bg-sand-50 p-3 text-xs text-earth-700">
            Funds are held in escrow and only released to the farmer once you confirm delivery. This is a simulated
            payment for demo purposes — no real funds move.
          </p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-sand-200 py-2.5 text-sm font-semibold text-earth-800 hover:bg-sand-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!complianceChecked}
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-earth-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-earth-700 disabled:cursor-not-allowed disabled:bg-sand-200 disabled:text-earth-700/60"
            >
              Confirm & Fund
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
