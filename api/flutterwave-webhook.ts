import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabaseAdmin'

interface FlutterwaveWebhookPayload {
  event?: string
  data?: {
    id?: number
    tx_ref?: string
    flw_ref?: string
    status?: string
    amount?: number
    currency?: string
    // Modern Flutterwave inline checkout (v3.js) echoes back whatever `meta`
    // object was passed at charge time as a plain object...
    meta?: Record<string, unknown>
    // ...but some older/alternate Flutterwave APIs send it as a name/value
    // array instead — checked as a fallback below.
    meta_data?: Array<{ metaname: string; metavalue: string }>
  }
}

/** True the first time this exact transaction has been seen — false (already processed) on a replay. */
async function claimEvent(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, eventId: string): Promise<boolean> {
  const { error } = await supabaseAdmin!
    .from('processed_webhook_events')
    .insert({ provider: 'flutterwave', event_id: eventId })
  if (!error) return true
  if (error.code === '23505') return false
  console.error('[flutterwave-webhook] failed to record processed event, continuing anyway', eventId, error)
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const expectedHash = process.env.FLUTTERWAVE_SECRET_HASH
  if (!expectedHash) {
    console.error('[flutterwave-webhook] FLUTTERWAVE_SECRET_HASH not configured on this deployment')
    return res.status(500).json({ error: 'Flutterwave webhook is not configured on this deployment' })
  }

  // Flutterwave doesn't sign the payload — it just echoes back the secret
  // hash you set under Settings → Webhooks, so this is a direct comparison,
  // not an HMAC check like Stripe's.
  const signature = req.headers['verif-hash']
  if (!signature || signature !== expectedHash) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const body = req.body as FlutterwaveWebhookPayload
  const data = body?.data

  if (!data || data.status !== 'successful') {
    return res.status(200).json({ received: true, skipped: 'not a successful charge' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error(
      '[flutterwave-webhook] Supabase admin client not configured (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)',
    )
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
  }

  const eventId = data.id != null ? String(data.id) : data.tx_ref || data.flw_ref
  if (!eventId) {
    console.warn('[flutterwave-webhook] successful charge with no id/tx_ref/flw_ref to dedupe on')
  } else {
    const isNewEvent = await claimEvent(supabaseAdmin, eventId)
    if (!isNewEvent) {
      return res.status(200).json({ received: true, ignored: 'already processed' })
    }
  }

  const orderId =
    (data.meta?.order_id as string | undefined) ?? data.meta_data?.find((m) => m.metaname === 'order_id')?.metavalue
  const paymentAttemptId =
    (data.meta?.payment_attempt_id as string | undefined) ??
    data.meta_data?.find((m) => m.metaname === 'payment_attempt_id')?.metavalue

  if (!orderId) {
    console.warn('[flutterwave-webhook] successful charge with no order_id in meta', data.tx_ref)
    return res.status(200).json({ received: true, skipped: 'no order_id in meta' })
  }

  const receiptReference = data.tx_ref ?? data.flw_ref ?? String(data.id)

  // Amount/currency verification — see api/stripe-webhook.ts for the same
  // pattern. payment_attempt_id is only absent for checkouts started before
  // this hardening shipped.
  if (paymentAttemptId) {
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('payment_attempts')
      .select('id, amount, currency, status')
      .eq('id', paymentAttemptId)
      .maybeSingle()

    if (attemptError || !attempt) {
      console.error('[flutterwave-webhook] charge references an unknown payment_attempt_id', paymentAttemptId, attemptError)
      return res.status(200).json({ received: true, skipped: 'unknown payment_attempt_id' })
    }
    if (attempt.status !== 'pending') {
      console.warn('[flutterwave-webhook] payment_attempt already', attempt.status, paymentAttemptId)
      return res.status(200).json({ received: true, skipped: `payment attempt already ${attempt.status}` })
    }

    const receivedAmount = Number(data.amount)
    const receivedCurrency = (data.currency ?? '').toUpperCase()
    const amountMatches = Number.isFinite(receivedAmount) && Math.abs(receivedAmount - Number(attempt.amount)) < 0.01
    const currencyMatches = receivedCurrency === attempt.currency

    if (!amountMatches || !currencyMatches) {
      console.error(
        '[flutterwave-webhook] SECURITY: payment amount/currency did not match the expected payment attempt — not funding',
        { paymentAttemptId, orderId, expected: { amount: attempt.amount, currency: attempt.currency }, received: { amount: receivedAmount, currency: receivedCurrency } },
      )
      await supabaseAdmin.from('payment_attempts').update({ status: 'failed' }).eq('id', paymentAttemptId)
      return res.status(200).json({ received: true, rejected: 'amount/currency mismatch' })
    }

    await supabaseAdmin
      .from('payment_attempts')
      .update({ status: 'confirmed', provider_reference: receiptReference, confirmed_at: new Date().toISOString() })
      .eq('id', paymentAttemptId)
  } else {
    console.warn('[flutterwave-webhook] charge has no payment_attempt_id — funding without amount verification', data.tx_ref)
  }

  const { data: updated, error } = await supabaseAdmin
    .from('orders')
    .update({ escrow_status: 'Escrow Funded', receipt_reference: receiptReference })
    .eq('id', orderId)
    .select()

  if (error) {
    console.error('[flutterwave-webhook] failed to update order', orderId, error)
    return res.status(500).json({ error: 'Failed to update order' })
  }

  if (!updated || updated.length === 0) {
    // Row-count check — Supabase returns no error for an .update() that
    // matches zero rows, so an unmatched order_id would otherwise look like
    // a success and silently drop a real payment event.
    console.error('[flutterwave-webhook] successful charge referenced an unknown order_id', orderId)
    return res.status(404).json({ error: 'Order not found for order_id' })
  }

  return res.status(200).json({ received: true })
}
