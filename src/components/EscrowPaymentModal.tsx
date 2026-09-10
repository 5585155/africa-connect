import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../context/CurrencyContext'
import { formatMoney, type ConverterCurrency } from '../lib/currency'
import { isFlutterwaveConfigured, openFlutterwaveCheckout } from '../lib/flutterwave'
import { getStripe, isStripeConfigured, createStripePaymentIntent } from '../lib/stripe'
import { isSupabaseConfigured } from '../lib/supabase'
import { createPaymentAttempt } from '../lib/paymentAttempts'
import PaystackButton, { isPaystackConfigured } from './PaystackButton'
import { computeEscrowBreakdown } from '../lib/escrow'
import { guardPaymentStart } from '../lib/containment'

function generateReference(prefix: string): string {
  return `${prefix}-${Date.now()}`
}

export type PaymentMethod = 'flutterwave' | 'stripe' | 'paystack'

export interface EscrowPaymentResult {
  method: PaymentMethod
  reference: string
  sandbox: boolean
}

/** Currencies Flutterwave's inline checkout actually settles in — anything else falls back to USD for the charge itself. */
const FLUTTERWAVE_CURRENCIES: ConverterCurrency[] = ['USD', 'KES', 'NGN', 'GHS']

/** Currencies Paystack's inline checkout actually settles in — anything else falls back to NGN for the charge itself. */
const PAYSTACK_CURRENCIES: ConverterCurrency[] = ['NGN', 'GHS', 'USD']

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
  {
    id: 'paystack',
    label: 'Paystack',
    description: 'Cards, bank transfer, and USSD — popular across Nigeria and Ghana',
    icon: '💰',
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

  const paystackCurrency = PAYSTACK_CURRENCIES.includes(currency) ? currency : 'NGN'
  const paystackAmount = convert(totalUSD, 'USD', paystackCurrency)

  const [complianceChecked, setComplianceChecked] = useState(false)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Server-authoritative payment attempt (see src/lib/paymentAttempts.ts) —
  // only exists against a real Supabase project. Local mock mode has no
  // server to ask, so it keeps the pre-existing client-only simulation.
  const [attempt, setAttempt] = useState<{ id: string; amount: number; currency: string } | null>(null)
  const [attemptLoading, setAttemptLoading] = useState(false)
  const [attemptError, setAttemptError] = useState<string | null>(null)
  const cardMountRef = useRef<HTMLDivElement>(null)
  // Stripe's own StripeCardElement type requires importing @stripe/stripe-js's
  // full Elements type surface for one local ref — not worth the import noise.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardElementRef = useRef<any>(null)

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
  const usesServerAuthority = isSupabaseConfigured && method !== null && !methodIsSandbox

  // Creates the server-side payment attempt as soon as a real (non-sandbox)
  // method is selected, so it's ready before the buyer clicks Pay rather
  // than adding a round trip to that click.
  useEffect(() => {
    setAttempt(null)
    setAttemptError(null)
    if (!usesServerAuthority || !method) return

    const attemptCurrency =
      method === 'flutterwave'
        ? FLUTTERWAVE_CURRENCIES.includes(currency)
          ? currency
          : 'USD'
        : method === 'paystack'
          ? paystackCurrency
          : 'USD'

    let cancelled = false
    setAttemptLoading(true)
    createPaymentAttempt(orderId, method, attemptCurrency)
      .then((result) => {
        if (!cancelled) setAttempt({ id: result.paymentAttemptId, amount: result.amount, currency: result.currency })
      })
      .catch((error) => {
        if (!cancelled) setAttemptError(error instanceof Error ? error.message : 'Could not start this payment.')
      })
      .finally(() => {
        if (!cancelled) setAttemptLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, usesServerAuthority])

  // Mounts a real Stripe Card Element once Stripe is the selected method and
  // this checkout is going through the real (not simulated) path.
  useEffect(() => {
    if (method !== 'stripe' || !isStripeConfigured || !usesServerAuthority) return
    let card: any = null
    let cancelled = false
    getStripe().then((stripe) => {
      if (cancelled || !stripe || !cardMountRef.current) return
      const elements = stripe.elements()
      card = elements.create('card', { style: { base: { fontSize: '14px' } } })
      card.mount(cardMountRef.current)
      cardElementRef.current = card
    })
    return () => {
      cancelled = true
      if (card) card.unmount()
      cardElementRef.current = null
    }
  }, [method, usesServerAuthority])

  async function handlePay() {
    // Defensive — the button that calls this is not rendered at all while
    // contained (see the early return in the JSX below), but this guard
    // stays here too so this function can never initialize a real charge or
    // a simulation on its own if it's ever reached another way.
    const guard = guardPaymentStart()
    if (!guard.allowed) {
      setStatus('error')
      setErrorMessage(guard.message ?? null)
      return
    }
    if (!method) return
    setStatus('processing')
    setErrorMessage(null)

    try {
      if (method === 'flutterwave') {
        if (isFlutterwaveConfigured) {
          if (usesServerAuthority && !attempt) {
            throw new Error(attemptError ?? 'Still preparing this payment — try again in a moment.')
          }
          const flwCurrency = FLUTTERWAVE_CURRENCIES.includes(currency) ? currency : 'USD'
          const response = await openFlutterwaveCheckout({
            amount: attempt?.amount ?? Math.round(convert(totalUSD, 'USD', flwCurrency) * 100) / 100,
            currency: attempt?.currency ?? flwCurrency,
            email: user?.email ?? 'buyer@example.com',
            name: user?.name ?? 'Africa Connect Buyer',
            title: `Escrow — ${quantity} t ${cropName}`,
            description: 'Africa Connect protected escrow trade',
            orderId,
            paymentAttemptId: attempt?.id,
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
      if (isStripeConfigured && usesServerAuthority) {
        if (!attempt) throw new Error(attemptError ?? 'Still preparing this payment — try again in a moment.')
        const stripe = await getStripe()
        const card = cardElementRef.current
        if (!stripe || !card) throw new Error('Stripe failed to load')

        const clientSecret = await createStripePaymentIntent(attempt.id)
        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card },
        })
        if (error) throw new Error(error.message || 'Your card was declined.')
        if (paymentIntent?.status !== 'succeeded') {
          throw new Error(`Payment status: ${paymentIntent?.status ?? 'unknown'} — it did not complete.`)
        }
        onConfirm({ method: 'stripe', reference: paymentIntent.id, sandbox: false })
        return
      }

      // Sandbox — no VITE_STRIPE_PUBLIC_KEY configured, or no Supabase project to verify against
      if (isStripeConfigured) {
        const stripe = await getStripe()
        if (!stripe) throw new Error('Stripe failed to load')
        // The SDK load above proves the key is valid, but with no Supabase
        // project there's no server to create a real PaymentIntent against
        // (see api/create-stripe-intent.ts) or a webhook to fund the order
        // once paid — so the charge itself is still simulated here.
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
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong starting the payment. Please try again.')
    }
  }

  const canPay = complianceChecked && method !== null && status !== 'processing' && !(usesServerAuthority && attemptLoading)
  const paymentStartGuard = guardPaymentStart()

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

        {!paymentStartGuard.allowed ? (
          // No payment method list, no Pay button, no PaystackButton — none
          // of the elements that could start a checkout or a simulation are
          // rendered at all while contained, not just disabled.
          <div className="p-5">
            <p role="alert" className="rounded-lg bg-clay-600/10 px-3 py-2.5 text-sm text-clay-700">
              {paymentStartGuard.message}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl border border-sand-200 py-2.5 text-sm font-semibold text-earth-800 hover:bg-sand-100"
            >
              Close
            </button>
          </div>
        ) : (
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
                const configured =
                  option.id === 'flutterwave'
                    ? isFlutterwaveConfigured
                    : option.id === 'stripe'
                      ? isStripeConfigured
                      : isPaystackConfigured
                // Flutterwave/Stripe simulate a successful charge when unconfigured so the
                // escrow flow can still be tested end to end; Paystack has no such fallback
                // (a pk_test_... key already gives a real sandbox), so it's just disabled.
                const badgeLabel = configured ? null : option.id === 'paystack' ? 'Not configured' : 'Sandbox'
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
                        {badgeLabel && (
                          <span className="rounded-full bg-clay-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-clay-700">
                            {badgeLabel}
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
            {method === 'stripe' && isStripeConfigured && !isSupabaseConfigured && (
              <p className="mt-2 rounded-lg bg-sand-50 p-2.5 text-xs text-earth-700">
                🧪 No Supabase project connected — the Stripe key loads, but there's no server to create a real
                charge or webhook to confirm it, so this will simulate a successful payment.
              </p>
            )}
            {method === 'stripe' && isStripeConfigured && usesServerAuthority && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-earth-800">Card details</p>
                <div ref={cardMountRef} className="rounded-lg border border-sand-200 px-3 py-2.5" />
                {attemptLoading && <p className="mt-1.5 text-xs text-earth-700/70">Preparing secure payment…</p>}
                {attemptError && (
                  <p role="alert" className="mt-1.5 text-xs text-clay-700">
                    {attemptError}
                  </p>
                )}
              </div>
            )}
            {method === 'paystack' && !isPaystackConfigured && (
              <p className="mt-2 rounded-lg bg-sand-50 p-2.5 text-xs text-earth-700">
                ⚠️ No VITE_PAYSTACK_PUBLIC_KEY configured on this deployment — Paystack has no built-in simulation,
                so a pk_test_... key is needed to test this path.
              </p>
            )}
            {method === 'paystack' && isPaystackConfigured && usesServerAuthority && attemptLoading && (
              <p className="mt-2 rounded-lg bg-sand-50 p-2.5 text-xs text-earth-700">Preparing secure payment…</p>
            )}
            {method === 'paystack' && attemptError && (
              <p role="alert" className="mt-2 text-xs text-clay-700">
                {attemptError}
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

            {method === 'paystack' ? (
              <PaystackButton
                className="flex-1"
                disabled={!complianceChecked || (usesServerAuthority && (attemptLoading || !attempt))}
                email={user?.email ?? ''}
                amount={attempt?.amount ?? paystackAmount}
                currency={attempt?.currency ?? paystackCurrency}
                userId={user?.id ?? user?.email ?? ''}
                orderId={orderId}
                paymentAttemptId={attempt?.id}
                label="Pay with Paystack"
                onSuccessCallback={(reference) => onConfirm({ method: 'paystack', reference, sandbox: false })}
              />
            ) : (
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
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
