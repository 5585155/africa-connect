import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { getSupabaseAdmin } from './_lib/supabaseAdmin'

// Stripe's signature check needs the exact raw request bytes — Vercel's
// default JSON body parsing would re-serialize the body and break the
// signature, so it's disabled here and read manually below.
export const config = {
  api: {
    bodyParser: false,
  },
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

/** True if this is the first time this exact Stripe event has been seen — false (already processed) on a replay. */
async function claimEvent(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, eventId: string): Promise<boolean> {
  const { error } = await supabaseAdmin!.from('processed_webhook_events').insert({ provider: 'stripe', event_id: eventId })
  if (!error) return true
  // 23505 = unique_violation — this (provider, event_id) pair was already claimed by an earlier delivery of the same event.
  if (error.code === '23505') return false
  // Any other error (table missing, connection issue): fail open toward NOT
  // processing twice is impossible to guarantee here, so log loudly and let
  // the amount/currency check below remain the real backstop.
  console.error('[stripe-webhook] failed to record processed event, continuing anyway', eventId, error)
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not configured on this deployment')
    return res.status(500).json({ error: 'Stripe is not configured on this deployment' })
  }

  const signature = req.headers['stripe-signature']
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }

  const stripe = new Stripe(secretKey)
  const rawBody = await readRawBody(req)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error('[stripe-webhook] signature verification failed', error)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  if (event.type !== 'payment_intent.succeeded') {
    // Acknowledge every other event type so Stripe doesn't retry it forever.
    return res.status(200).json({ received: true, ignored: event.type })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('[stripe-webhook] Supabase admin client not configured (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
  }

  // Replay guard — must run before any order write, using the event's own
  // id so a redelivered event (Stripe explicitly does not guarantee
  // at-most-once delivery) is a safe no-op, not a second "Escrow Funded" update.
  const isNewEvent = await claimEvent(supabaseAdmin, event.id)
  if (!isNewEvent) {
    return res.status(200).json({ received: true, ignored: 'already processed' })
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const orderId = paymentIntent.metadata?.order_id
  const paymentAttemptId = paymentIntent.metadata?.payment_attempt_id

  if (!orderId) {
    console.warn('[stripe-webhook] payment_intent.succeeded with no metadata.order_id', paymentIntent.id)
    return res.status(200).json({ received: true, skipped: 'no order_id in metadata' })
  }

  // Amount/currency verification — the audit's High finding: "webhook
  // success is not matched to expected payment terms". payment_attempt_id
  // is only absent for events from before this hardening shipped; anything
  // created going forward always has one (see api/create-payment-attempt.ts).
  if (paymentAttemptId) {
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('payment_attempts')
      .select('id, amount, currency, status')
      .eq('id', paymentAttemptId)
      .maybeSingle()

    if (attemptError || !attempt) {
      console.error('[stripe-webhook] payment_intent references an unknown payment_attempt_id', paymentAttemptId, attemptError)
      return res.status(200).json({ received: true, skipped: 'unknown payment_attempt_id' })
    }
    if (attempt.status !== 'pending') {
      console.warn('[stripe-webhook] payment_attempt already', attempt.status, paymentAttemptId)
      return res.status(200).json({ received: true, skipped: `payment attempt already ${attempt.status}` })
    }

    const receivedAmount = paymentIntent.amount_received / 100
    const receivedCurrency = paymentIntent.currency.toUpperCase()
    const amountMatches = Math.abs(receivedAmount - Number(attempt.amount)) < 0.01
    const currencyMatches = receivedCurrency === attempt.currency

    if (!amountMatches || !currencyMatches) {
      console.error(
        '[stripe-webhook] SECURITY: payment amount/currency did not match the expected payment attempt — not funding',
        { paymentAttemptId, orderId, expected: { amount: attempt.amount, currency: attempt.currency }, received: { amount: receivedAmount, currency: receivedCurrency } },
      )
      await supabaseAdmin.from('payment_attempts').update({ status: 'failed' }).eq('id', paymentAttemptId)
      // Acknowledged (200) on purpose — this mismatch will not resolve on
      // retry, so there is nothing to gain from Stripe re-sending it.
      return res.status(200).json({ received: true, rejected: 'amount/currency mismatch' })
    }

    await supabaseAdmin
      .from('payment_attempts')
      .update({ status: 'confirmed', provider_reference: paymentIntent.id, confirmed_at: new Date().toISOString() })
      .eq('id', paymentAttemptId)
  } else {
    console.warn('[stripe-webhook] payment_intent has no payment_attempt_id — funding without amount verification', paymentIntent.id)
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ escrow_status: 'Escrow Funded', receipt_reference: paymentIntent.id })
    .eq('id', orderId)
    .select()

  if (error) {
    console.error('[stripe-webhook] failed to update order', orderId, error)
    return res.status(500).json({ error: 'Failed to update order' })
  }

  if (!data || data.length === 0) {
    // Row-count check — Supabase returns no error for an .update() that
    // matches zero rows, so an unmatched order_id would otherwise look like
    // a success and silently drop a real payment event.
    console.error('[stripe-webhook] payment_intent.succeeded referenced an unknown order_id', orderId)
    return res.status(404).json({ error: 'Order not found for order_id' })
  }

  return res.status(200).json({ received: true })
}
