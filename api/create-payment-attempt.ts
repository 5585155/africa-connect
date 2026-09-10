import type { VercelRequest, VercelResponse } from '@vercel/node'
import { computeEscrowBreakdown } from '../src/lib/escrow'
import { getSupabaseAdmin } from './_lib/supabaseAdmin'
import { verifyBearerToken } from './_lib/verifyAuth'
import { convertWithRates, getServerFxRates, isSupportedCurrency } from './_lib/fx'

interface OrderRow {
  id: string
  buyer_id: string
  quantity_tons: number
  unit_price_usd: number
  escrow_status: string
}

/**
 * Creates the server-authoritative "expected charge" record a webhook
 * verifies against before ever marking an order funded — see
 * PAYMENT_SECURITY_AUDIT.md items 1-3. The amount is always recomputed here
 * from the order's own stored quantity/unit price, never taken from the
 * client — a tampered or stale client-side total can't produce a payment
 * attempt for less than the order actually costs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await verifyBearerToken(req)
  if (!auth) {
    return res.status(401).json({ error: 'Sign in again before starting a payment.' })
  }

  const { orderId, provider, currency } = (req.body ?? {}) as {
    orderId?: string
    provider?: string
    currency?: string
  }

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'orderId is required' })
  }
  if (provider !== 'stripe' && provider !== 'flutterwave' && provider !== 'paystack') {
    return res.status(400).json({ error: 'provider must be stripe, flutterwave, or paystack' })
  }
  const requestedCurrency = (currency || 'USD').toUpperCase()
  if (!isSupportedCurrency(requestedCurrency)) {
    return res.status(400).json({ error: `Unsupported currency: ${requestedCurrency}` })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('[create-payment-attempt] Supabase admin client not configured')
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, buyer_id, quantity_tons, unit_price_usd, escrow_status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    console.error('[create-payment-attempt] failed to load order', orderId, orderError)
    return res.status(500).json({ error: 'Could not load this order' })
  }
  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }

  const row = order as OrderRow
  if (row.buyer_id !== auth.userId) {
    // Deliberately vague — same response as "not found" so this endpoint
    // doesn't confirm/deny which order ids exist to a caller who isn't the buyer.
    return res.status(404).json({ error: 'Order not found' })
  }
  if (row.escrow_status !== 'Inquiry Sent') {
    return res.status(409).json({ error: `This order is already ${row.escrow_status} — it can't be paid again.` })
  }

  const { totalUSD } = computeEscrowBreakdown(Number(row.quantity_tons), Number(row.unit_price_usd))

  let amount = totalUSD
  if (requestedCurrency !== 'USD') {
    const rates = await getServerFxRates()
    amount = convertWithRates(totalUSD, 'USD', requestedCurrency, rates)
  }
  // Match the two-decimal rounding every payment provider actually charges in.
  amount = Math.round(amount * 100) / 100

  const { data: attempt, error: insertError } = await supabaseAdmin
    .from('payment_attempts')
    .insert({
      order_id: row.id,
      buyer_id: auth.userId,
      provider,
      amount,
      currency: requestedCurrency,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !attempt) {
    console.error('[create-payment-attempt] failed to record payment attempt', orderId, insertError)
    return res.status(500).json({ error: 'Could not start a payment for this order' })
  }

  return res.status(200).json({ paymentAttemptId: attempt.id as string, amount, currency: requestedCurrency })
}
