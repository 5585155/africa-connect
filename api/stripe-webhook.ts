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

  const paymentIntent = event.data.object as Stripe.PaymentIntent
  // Set this when creating the PaymentIntent: stripe.paymentIntents.create({ metadata: { order_id } }).
  const orderId = paymentIntent.metadata?.order_id

  if (!orderId) {
    console.warn('[stripe-webhook] payment_intent.succeeded with no metadata.order_id', paymentIntent.id)
    return res.status(200).json({ received: true, skipped: 'no order_id in metadata' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('[stripe-webhook] Supabase admin client not configured (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
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
