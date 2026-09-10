import { createHmac, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabaseAdmin'

// Paystack's signature is an HMAC over the exact request bytes they sent —
// Vercel's default JSON body parsing would re-serialize the body and could
// produce a byte-for-byte different string (key order, whitespace, number
// formatting), breaking the signature. Disabled here and read manually below,
// same pattern as api/stripe-webhook.ts.
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

interface PaystackChargeSuccessPayload {
  event?: string
  data?: {
    id?: number
    reference?: string
    amount?: number
    currency?: string
    customer?: { email?: string }
    metadata?: { user_id?: string; order_id?: string; payment_attempt_id?: string } | null
  }
}

/** True the first time this exact transaction has been seen — false (already processed) on a replay. */
async function claimEvent(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, eventId: string): Promise<boolean> {
  const { error } = await supabaseAdmin!.from('processed_webhook_events').insert({ provider: 'paystack', event_id: eventId })
  if (!error) return true
  if (error.code === '23505') return false
  console.error('[paystack-webhook] failed to record processed event, continuing anyway', eventId, error)
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    console.error('[paystack-webhook] PAYSTACK_SECRET_KEY not configured on this deployment')
    return res.status(500).json({ error: 'Paystack is not configured on this deployment' })
  }

  const signature = req.headers['x-paystack-signature']
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: 'Missing x-paystack-signature header' })
  }

  const rawBody = await readRawBody(req)
  const expectedHash = createHmac('sha512', secretKey).update(rawBody).digest('hex')

  // Constant-time comparison — a plain `!==` would leak timing information an
  // attacker could use to guess the signature byte by byte.
  const signatureBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expectedHash, 'utf8')
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer)

  if (!signatureValid) {
    console.error('[paystack-webhook] signature verification failed')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload: PaystackChargeSuccessPayload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch (error) {
    console.error('[paystack-webhook] failed to parse request body', error)
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  if (payload.event !== 'charge.success') {
    // Acknowledge every other event type so Paystack doesn't retry it forever.
    return res.status(200).json({ received: true, ignored: payload.event })
  }

  const data = payload.data
  const reference = data?.reference
  const email = data?.customer?.email
  const userId = data?.metadata?.user_id
  const orderId = data?.metadata?.order_id
  const paymentAttemptId = data?.metadata?.payment_attempt_id

  if (!reference || typeof data?.amount !== 'number' || !email) {
    console.warn('[paystack-webhook] charge.success with missing reference/amount/email', reference)
    return res.status(200).json({ received: true, skipped: 'missing reference, amount, or email' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('[paystack-webhook] Supabase admin client not configured (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
  }

  const eventId = data.id != null ? String(data.id) : reference
  const isNewEvent = await claimEvent(supabaseAdmin, eventId)
  if (!isNewEvent) {
    return res.status(200).json({ received: true, ignored: 'already processed' })
  }

  // Paystack may resend the same event — upsert on the unique `reference` so
  // a retry updates the existing row instead of failing on a duplicate key.
  // This is receipt bookkeeping, not the payment-authority check below.
  const { error: txError } = await supabaseAdmin.from('transactions').upsert(
    {
      reference,
      provider: 'paystack',
      user_id: userId ?? null,
      email,
      amount: data.amount / 100,
      currency: data.currency ?? 'NGN',
      status: 'success',
      raw_event: payload,
    },
    { onConflict: 'reference' },
  )

  if (txError) {
    console.error('[paystack-webhook] failed to write transaction', reference, txError)
    return res.status(500).json({ error: 'Failed to record transaction' })
  }

  // Previously this webhook stopped here — it recorded the receipt but never
  // funded the order it belonged to (PAYMENT_SECURITY_AUDIT.md's "Paystack
  // receipt recording is disconnected from orders" finding). It now finishes
  // the same way the other two providers do, once there's an order_id to act on.
  if (!orderId) {
    console.warn('[paystack-webhook] charge.success with no order_id in metadata — receipt recorded, no order to fund', reference)
    return res.status(200).json({ received: true, skipped: 'no order_id in metadata' })
  }

  if (paymentAttemptId) {
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('payment_attempts')
      .select('id, amount, currency, status')
      .eq('id', paymentAttemptId)
      .maybeSingle()

    if (attemptError || !attempt) {
      console.error('[paystack-webhook] charge references an unknown payment_attempt_id', paymentAttemptId, attemptError)
      return res.status(200).json({ received: true, skipped: 'unknown payment_attempt_id' })
    }
    if (attempt.status !== 'pending') {
      console.warn('[paystack-webhook] payment_attempt already', attempt.status, paymentAttemptId)
      return res.status(200).json({ received: true, skipped: `payment attempt already ${attempt.status}` })
    }

    const receivedAmount = data.amount / 100
    const receivedCurrency = (data.currency ?? '').toUpperCase()
    const amountMatches = Math.abs(receivedAmount - Number(attempt.amount)) < 0.01
    const currencyMatches = receivedCurrency === attempt.currency

    if (!amountMatches || !currencyMatches) {
      console.error(
        '[paystack-webhook] SECURITY: payment amount/currency did not match the expected payment attempt — not funding',
        { paymentAttemptId, orderId, expected: { amount: attempt.amount, currency: attempt.currency }, received: { amount: receivedAmount, currency: receivedCurrency } },
      )
      await supabaseAdmin.from('payment_attempts').update({ status: 'failed' }).eq('id', paymentAttemptId)
      return res.status(200).json({ received: true, rejected: 'amount/currency mismatch' })
    }

    await supabaseAdmin
      .from('payment_attempts')
      .update({ status: 'confirmed', provider_reference: reference, confirmed_at: new Date().toISOString() })
      .eq('id', paymentAttemptId)
  } else {
    console.warn('[paystack-webhook] charge has no payment_attempt_id — funding without amount verification', reference)
  }

  const { data: updated, error: orderError } = await supabaseAdmin
    .from('orders')
    .update({ escrow_status: 'Escrow Funded', receipt_reference: reference })
    .eq('id', orderId)
    .select()

  if (orderError) {
    console.error('[paystack-webhook] failed to update order', orderId, orderError)
    return res.status(500).json({ error: 'Failed to update order' })
  }
  if (!updated || updated.length === 0) {
    console.error('[paystack-webhook] charge.success referenced an unknown order_id', orderId)
    return res.status(404).json({ error: 'Order not found for order_id' })
  }

  return res.status(200).json({ received: true })
}
