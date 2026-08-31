import { useState } from 'react'
import PaystackPop from '@paystack/inline-js'

const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
export const isPaystackConfigured = Boolean(paystackPublicKey)

export interface PaystackButtonProps {
  email: string
  /** Amount in the currency's main unit (e.g. 5000 for ₦5,000) — converted to kobo/cents before sending to Paystack. */
  amount: number
  currency?: string
  userId: string
  onSuccessCallback?: (reference: string) => void
  label?: string
  className?: string
  /** Disables the button regardless of internal state — e.g. gating on a compliance checkbox in a parent form. */
  disabled?: boolean
}

export default function PaystackButton({
  email,
  amount,
  currency = 'NGN',
  userId,
  onSuccessCallback,
  label,
  className,
  disabled = false,
}: PaystackButtonProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handlePay() {
    if (!paystackPublicKey) {
      setStatus('error')
      setErrorMessage('Paystack is not configured on this deployment — set VITE_PAYSTACK_PUBLIC_KEY.')
      return
    }
    if (!email) {
      setStatus('error')
      setErrorMessage('An email address is required to start a Paystack payment.')
      return
    }
    if (!(amount > 0)) {
      setStatus('error')
      setErrorMessage('Enter an amount greater than zero.')
      return
    }

    setStatus('processing')
    setErrorMessage(null)

    try {
      const paystackPop = new PaystackPop()
      paystackPop.newTransaction({
        key: paystackPublicKey,
        email,
        amount: Math.round(amount * 100), // main units → kobo/cents
        currency,
        metadata: { user_id: userId },
        onSuccess: (transaction) => {
          setStatus('idle')
          onSuccessCallback?.(transaction.reference)
        },
        onCancel: () => {
          setStatus('idle')
        },
        onError: (error) => {
          setStatus('error')
          setErrorMessage(error?.message || 'Something went wrong starting the payment. Please try again.')
        },
      })
    } catch (error) {
      console.error('[PaystackButton] failed to start transaction', error)
      setStatus('error')
      setErrorMessage('Something went wrong starting the payment. Please try again.')
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handlePay}
        disabled={disabled || status === 'processing' || !isPaystackConfigured}
        className="w-full rounded-xl bg-earth-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-earth-700 disabled:cursor-not-allowed disabled:bg-sand-200 disabled:text-earth-700/60"
      >
        {status === 'processing' ? 'Processing…' : (label ?? `Pay ${currency} ${amount.toLocaleString()} with Paystack`)}
      </button>

      {!isPaystackConfigured && (
        <p className="mt-2 text-xs text-earth-700/70">
          Paystack isn't configured on this deployment yet — set VITE_PAYSTACK_PUBLIC_KEY.
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="mt-2 rounded-lg bg-clay-600/10 px-3 py-2 text-sm text-clay-700">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
