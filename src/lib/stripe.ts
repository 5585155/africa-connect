import { loadStripe, type Stripe } from '@stripe/stripe-js'

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY
export const isStripeConfigured = Boolean(stripePublicKey)

let stripePromise: Promise<Stripe | null> | null = null

/**
 * Loads the real Stripe.js SDK for a configured publishable key. Note this app
 * has no backend to create a PaymentIntent/Checkout Session, so confirming an
 * actual charge isn't possible from the client alone — this only validates
 * that the key loads. See EscrowPaymentModal for how the charge is simulated
 * once the SDK is confirmed live.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePublicKey) return Promise.resolve(null)
  if (!stripePromise) stripePromise = loadStripe(stripePublicKey)
  return stripePromise
}
