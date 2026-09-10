import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY
export const isStripeConfigured = Boolean(stripePublicKey)

let stripePromise: Promise<Stripe | null> | null = null

/** Loads the real Stripe.js SDK for a configured publishable key. */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePublicKey) return Promise.resolve(null)
  if (!stripePromise) stripePromise = loadStripe(stripePublicKey)
  return stripePromise
}

/**
 * Asks api/create-stripe-intent.ts to create a real PaymentIntent for an
 * existing payment attempt (see src/lib/paymentAttempts.ts) and returns its
 * client secret. Only callable against a real Supabase project — a Supabase
 * session is required to authenticate the request.
 */
export async function createStripePaymentIntent(paymentAttemptId: string): Promise<string> {
  const { data: session } = await supabase!.auth.getSession()
  const token = session?.session?.access_token
  if (!token) throw new Error('You need to be signed in to start a payment.')

  const response = await fetch('/api/create-stripe-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paymentAttemptId }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body?.clientSecret) {
    throw new Error(body?.error || 'Stripe could not start this payment. Please try again.')
  }
  return body.clientSecret as string
}
