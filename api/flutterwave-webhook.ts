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

  const orderId =
    (data.meta?.order_id as string | undefined) ?? data.meta_data?.find((m) => m.metaname === 'order_id')?.metavalue

  if (!orderId) {
    console.warn('[flutterwave-webhook] successful charge with no order_id in meta', data.tx_ref)
    return res.status(200).json({ received: true, skipped: 'no order_id in meta' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error(
      '[flutterwave-webhook] Supabase admin client not configured (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)',
    )
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ escrow_status: 'Escrow Funded', receipt_reference: data.tx_ref ?? data.flw_ref ?? String(data.id) })
    .eq('id', orderId)

  if (error) {
    console.error('[flutterwave-webhook] failed to update order', orderId, error)
    return res.status(500).json({ error: 'Failed to update order' })
  }

  return res.status(200).json({ received: true })
}
