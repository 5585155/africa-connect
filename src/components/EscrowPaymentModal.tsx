import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'
import { formatMoney, type ConverterCurrency } from '../lib/currency'
import { isFlutterwaveConfigured, openFlutterwaveCheckout } from '../lib/flutterwave'
import { getStripe, isStripeConfigured } from '../lib/stripe'

const LOGISTICS_RATE_PER_TON = 18
const ESCROW_FEE_RATE = 0.025

function generateReference(prefix: string): string {
  return `${prefix}-${Date.now()}`
}

export function computeEscrowBreakdown(quantity: number, unitPriceUSD: number) {
  const cropCostUSD = quantity * unitPriceUSD
  const logisticsUSD = quantity * LOGISTICS_RATE_PER_TON
  const escrowFeeUSD = Math.round(cropCostUSD * ESCROW_FEE_RATE)
  const totalUSD = cropCostUSD + logisticsUSD + escrowFeeUSD
  return { cropCostUSD, logisticsUSD, escrowFeeUSD, totalUSD }
}

export type PaymentMethod = 'flutterwave' | 'stripe'

export interface EscrowPaymentResult {
  method: PaymentMethod
  reference: string
  sandbox: boolean
}

/** Currencies Flutterwave's inline checkout actually settles in — anything else falls back to USD for the charge itself. */
const FLUTTERWAVE_CURRENCIES: ConverterCurrency[] = ['USD', 'KES', 'NGN', 'GHS']

const PAYMENT_METHODS: {
  id: PaymentMethod
  label: string
  description: string
  icon: string
}[] = [
  {
    id: 'flutterwave',
    label: 'Flutterwave',
    description: 'Mobile Money (M-Pesa, MTN MoMo), local bank transfer, or African debit card',
    icon: '🌍',
  },
  {
    id: 'stripe',
    label: 'Stripe',
    description: 'Credit/debit card or wire transfer — best for USD/EUR buyers',
    icon: '💳',
  },
]

export default function EscrowPaymentModal({
  orderId,
  cropName,
  quantity,
  unitPriceUSD,
  onConfirm,
  onClose,
}: {
  orderId: string
  cropName: string
  quantity: number
  unitPriceUSD: number
  onConfirm: (result: EscrowPaymentResult) => void
  onClose: () => void
}) {
  const { user } = useAuth()
  const { currency, convert } = useCurrency()
  const { cropCostUSD, logisticsUSD, escrowFeeUSD, totalUSD } = computeEscrowBreakdown(quantity, unitPriceUSD)
  const convertedTotal = convert(totalUSD, 'USD', currency)

  const [complianceChecked, setComplianceChecked] = useState(false)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  const methodIsSandbox = method === 'flutterwave' ? !isFlutterwaveConfigured : method === 'stripe' ? !isStripeConfigured : false

  async function handlePay() {
    if (!method) return
    setStatus('processing')
    setErrorMessage(null)

    try {
      if (method === 'flutterwave') {
        if (isFlutterwaveConfigured) {
          const flwCurrency = FLUTTERWAVE_CURRENCIES.includes(currency) ? currency : 'USD'
          const response = await openFlutterwaveCheckout({
            amount: Math.round(convert(totalUSD, 'USD', flwCurrency) * 100) / 100,
            currency: flwCurrency,
            email: user?.email ?? 'buyer@example.com',
            name: user?.name ?? 'Africa Connect Buyer',
            title: `Escrow — ${quantity} t ${cropName}`,
            description: 'Africa Connect protected escrow trade',
            orderId,
          })
          if (!response || response.status !== 'successful') {
            setStatus('idle')
            setErrorMessage('Payment was not completed. You can try again.')
            return
          }
          onConfirm({
            method: 'flutterwave',
            reference: response.tx_ref || response.flw_ref || generateReference('FLW'),
            sandbox: false,
          })
          return
        }

        // Sandbox — no VITE_FLUTTERWAVE_PUBLIC_KEY configured
        await new Promise((resolve) => window.setTimeout(resolve, 1100))
        onConfirm({ method: 'flutterwave', reference: generateReference('FLW-SANDBOX'), sandbox: true })
        return
      }

      // Stripe
      if (isStripeConfigured) {
        const stripe = await getStripe()
        if (!stripe) throw new Error('Stripe failed to load')
        // No backend is available to create a PaymentIntent/Checkout Session,
        // so a real charge can't be confirmed from the client alone. The SDK
        // load above proves the key is valid; the charge itself is simulated.
        // api/stripe-webhook.ts is ready to receive payment_intent.succeeded
        // once a create-intent endpoint exists to set metadata.order_id.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1100))
      onConfirm({
        method: 'stripe',
        reference: generateReference(isStripeConfigured ? 'STRIPE-TEST' : 'STRIPE-SANDBOX'),
        sandbox: true,
      })
    } catch (error) {
      console.error('[EscrowPaymentModal] payment failed', error)
      setStatus('error')
      setErrorMessage('Something went wrong starting the payment. Please try again.')
    }
  }

  const canPay = complianceChecked && method !== null && status !== 'processing'

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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
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
              <div className="text-right">
                <dd className="font-bold text-earth-950">${totalUSD.toLocaleString()}</dd>
                {currency !== 'USD' && (
                  <dd className="text-xs font-medium text-earth-700">≈ {formatMoney(convertedTotal, currency)}</dd>
                )}
              </div>
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

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-earth-950">Payment method</p>
            <div className="flex flex-col gap-2">
              {PAYMENT_METHODS.map((option) => {
                const active = method === option.id
                const sandbox = option.id === 'flutterwave' ? !isFlutterwaveConfigured : !isStripeConfigured
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setMethod(option.id)
                      setStatus('idle')
                      setErrorMessage(null)
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      active ? 'border-earth-800 bg-earth-800/5' : 'border-sand-200 hover:border-earth-600'
                    }`}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-earth-950">{option.label}</span>
                        {sandbox && (
                          <span className="rounded-full bg-clay-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-clay-700">
                            Sandbox
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-earth-700">{option.description}</span>
                    </span>
                    <span
                      className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        active ? 'border-earth-800 bg-earth-800' : 'border-sand-300'
                      }`}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                )
              })}
            </div>

            {method && methodIsSandbox && (
              <p className="mt-2 rounded-lg bg-sand-50 p-2.5 text-xs text-earth-700">
                🧪 No live {method === 'flutterwave' ? 'Flutterwave' : 'Stripe'} public key configured — this will
                simulate a successful payment so you can test the escrow flow end to end.
              </p>
            )}
          </div>

          {errorMessage && (
            <p role="alert" className="mt-3 rounded-lg bg-clay-600/10 px-3 py-2 text-sm text-clay-700">
              {errorMessage}
            </p>
          )}

          <p className="mt-4 rounded-lg bg-sand-50 p-3 text-xs text-earth-700">
            Funds are held in escrow and only released to the farmer once you confirm delivery.
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
              disabled={!canPay}
              onClick={handlePay}
              className="flex-1 rounded-xl bg-earth-800 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-earth-700 disabled:cursor-not-allowed disabled:bg-sand-200 disabled:text-earth-700/60"
            >
              {status === 'processing'
                ? 'Processing…'
                : !method
                  ? 'Select a payment method'
                  : methodIsSandbox
                    ? `Simulate ${method === 'flutterwave' ? 'Flutterwave' : 'Stripe'} Payment`
                    : `Pay with ${method === 'flutterwave' ? 'Flutterwave' : 'Stripe'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
