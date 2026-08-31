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
    reference?: string
    amount?: number
    currency?: string
    customer?: { email?: string }
    metadata?: { user_id?: string } | null
  }
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

  if (!reference || typeof data?.amount !== 'number' || !email) {
    console.warn('[paystack-webhook] charge.success with missing reference/amount/email', reference)
    return res.status(200).json({ received: true, skipped: 'missing reference, amount, or email' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.error('[paystack-webhook] Supabase admin client not configured (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return res.status(500).json({ error: 'Database is not configured on this deployment' })
  }

  // Paystack may resend the same event — upsert on the unique `reference` so
  // a retry updates the existing row instead of failing on a duplicate key.
  const { error } = await supabaseAdmin
    .from('transactions')
    .upsert(
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

  if (error) {
    console.error('[paystack-webhook] failed to write transaction', reference, error)
    return res.status(500).json({ error: 'Failed to record transaction' })
  }

  return res.status(200).json({ received: true })
}
