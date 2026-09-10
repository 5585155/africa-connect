import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { getSupabaseAdmin } from './_lib/supabaseAdmin'
import { verifyBearerToken } from './_lib/verifyAuth'

interface PaymentAttemptRow {
  id: string
  order_id: string
  buyer_id: string
  amount: number
  currency: string
  status: string
}

/**
 * Creates a real Stripe PaymentIntent for an existing payment attempt (see
 * api/create-payment-attempt.ts) and returns its client secret, which the
 * browser confirms with Stripe Elements — see EscrowPaymentModal.tsx. This
 * is what src/lib/stripe.ts's doc comment used to flag as missing: "the
 * charge itself is simulated once the SDK is confirmed to load." Amount and
 * currency come only from the payment_attempts row, never from the request
 * body, so a client can't request a PaymentIntent for less than the
 * server already decided the order costs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.error('[create-stripe-intent] STRIPE_SECRET_KEY not configured on this deployment')
    return res.status(500).json({ error: 'Stripe is not configured on this deployment' })
  }

  const auth = await verifyBearerToken(req)
  if (!auth) {
    return res.status(401).json({ error: 'Sign in again before starting a payment.' })
  }

  const { paymentAttemptId } = (req.body ?? {}) as { paymentAttemptId?: string }
  if (!paymentAttemptId || typeof paymentAttemptId !== 'string') {
    return res.status(400).json({ error: 'paymentAttemptId is required' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('[create-stripe-intent] Supabase admin client not configured')
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
  }

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from('payment_attempts')
    .select('id, order_id, buyer_id, amount, currency, status')
    .eq('id', paymentAttemptId)
    .maybeSingle()

  if (attemptError) {
    console.error('[create-stripe-intent] failed to load payment attempt', paymentAttemptId, attemptError)
    return res.status(500).json({ error: 'Could not load this payment attempt' })
  }
  const row = attempt as PaymentAttemptRow | null
  if (!row || row.buyer_id !== auth.userId) {
    return res.status(404).json({ error: 'Payment attempt not found' })
  }
  if (row.status !== 'pending') {
    return res.status(409).json({ error: `This payment attempt is already ${row.status}.` })
  }

  const stripe = new Stripe(secretKey)

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(row.amount * 100),
      currency: row.currency.toLowerCase(),
      metadata: { order_id: row.order_id, payment_attempt_id: row.id },
      automatic_payment_methods: { enabled: true },
    })

    return res.status(200).json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error('[create-stripe-intent] Stripe PaymentIntent creation failed', paymentAttemptId, error)
    return res.status(502).json({ error: 'Stripe could not start this payment. Please try again.' })
  }
}
