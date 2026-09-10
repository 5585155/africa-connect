import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, plain } from './load-module.mjs'

// Fixed so assertions can hard-code expected numbers: quantity 1 t * $250/t
// crop cost + $18 logistics + $6 fee (2.5%, whole-dollar rounded) = $274.
const escrowMock = {
  computeEscrowBreakdown: () => ({ cropCostUSD: 250, logisticsUSD: 18, escrowFeeUSD: 6, totalUSD: 274 }),
}

function fakeReq({ method = 'POST', authorization, body } = {}) {
  return { method, headers: authorization ? { authorization } : {}, body }
}

function fakeRes() {
  return {
    code: 0, body: null,
    setHeader() {},
    status(code) { this.code = code; return this },
    json(body) { this.body = plain(body); return this },
  }
}

function fakeOrdersDb({ order = null, insertResult = { id: 'attempt-1' }, insertError = null } = {}) {
  return {
    from(table) {
      if (table === 'orders') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => (order ? { data: order, error: null } : { data: null, error: null }) }) }),
        }
      }
      if (table === 'payment_attempts') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => (insertError ? { data: null, error: insertError } : { data: insertResult, error: null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }
}

async function loadCreatePaymentAttempt({ userId = 'buyer-1', db } = {}) {
  return loadModule('../api/create-payment-attempt.ts', {
    '../src/lib/escrow': escrowMock,
    './_lib/supabaseAdmin': { getSupabaseAdmin: () => db },
    './_lib/verifyAuth': { verifyBearerToken: async () => (userId ? { userId, email: 'buyer@example.com' } : null) },
    './_lib/fx': {
      getServerFxRates: async () => ({ USD: 1, EUR: 0.92, KES: 129.5, NGN: 1610, GHS: 14.8, ETB: 123.5 }),
      convertWithRates: (amount, from, to, rates) => (from === to ? amount : (amount / rates[from]) * rates[to]),
      isSupportedCurrency: (v) => ['USD', 'EUR', 'KES', 'NGN', 'GHS', 'ETB'].includes(v),
    },
  })
}

test('create-payment-attempt: rejects non-POST', async () => {
  const module = await loadCreatePaymentAttempt({ db: fakeOrdersDb() })
  const res = fakeRes()
  await module.default(fakeReq({ method: 'GET' }), res)
  assert.equal(res.code, 405)
})

test('create-payment-attempt: rejects a missing/invalid bearer token', async () => {
  const module = await loadCreatePaymentAttempt({ userId: null, db: fakeOrdersDb() })
  const res = fakeRes()
  await module.default(fakeReq({ body: { orderId: 'order-1', provider: 'stripe', currency: 'USD' } }), res)
  assert.equal(res.code, 401)
})

test('create-payment-attempt: rejects an order that does not belong to the caller (as not-found, not a permission error)', async () => {
  const order = { id: 'order-1', buyer_id: 'someone-else', quantity_tons: 1, unit_price_usd: 250, escrow_status: 'Inquiry Sent' }
  const module = await loadCreatePaymentAttempt({ userId: 'buyer-1', db: fakeOrdersDb({ order }) })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { orderId: 'order-1', provider: 'stripe', currency: 'USD' } }), res)
  assert.equal(res.code, 404)
})

test('create-payment-attempt: rejects an order that is already past Inquiry Sent', async () => {
  const order = { id: 'order-1', buyer_id: 'buyer-1', quantity_tons: 1, unit_price_usd: 250, escrow_status: 'Escrow Funded' }
  const module = await loadCreatePaymentAttempt({ db: fakeOrdersDb({ order }) })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { orderId: 'order-1', provider: 'stripe', currency: 'USD' } }), res)
  assert.equal(res.code, 409)
})

test('create-payment-attempt: computes the amount itself from the order, ignoring any amount the client sends', async () => {
  const order = { id: 'order-1', buyer_id: 'buyer-1', quantity_tons: 1, unit_price_usd: 250, escrow_status: 'Inquiry Sent' }
  const module = await loadCreatePaymentAttempt({ db: fakeOrdersDb({ order }) })
  const res = fakeRes()
  // A tampered client sends amount: 1 — the endpoint's request body has no
  // `amount` field at all, so there is nothing for it to read even if it tried.
  await module.default(
    fakeReq({ authorization: 'Bearer tok', body: { orderId: 'order-1', provider: 'stripe', currency: 'USD', amount: 1 } }),
    res,
  )
  assert.equal(res.code, 200)
  assert.equal(res.body.amount, 274, 'must be the server-computed total, not the client-sent amount')
  assert.equal(res.body.currency, 'USD')
  assert.equal(res.body.paymentAttemptId, 'attempt-1')
})

test('create-payment-attempt: converts to the requested settlement currency', async () => {
  const order = { id: 'order-1', buyer_id: 'buyer-1', quantity_tons: 1, unit_price_usd: 250, escrow_status: 'Inquiry Sent' }
  const module = await loadCreatePaymentAttempt({ db: fakeOrdersDb({ order }) })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { orderId: 'order-1', provider: 'flutterwave', currency: 'NGN' } }), res)
  assert.equal(res.code, 200)
  assert.equal(res.body.currency, 'NGN')
  assert.equal(res.body.amount, Math.round(274 * 1610 * 100) / 100)
})

test('create-payment-attempt: rejects an unsupported currency', async () => {
  const order = { id: 'order-1', buyer_id: 'buyer-1', quantity_tons: 1, unit_price_usd: 250, escrow_status: 'Inquiry Sent' }
  const module = await loadCreatePaymentAttempt({ db: fakeOrdersDb({ order }) })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { orderId: 'order-1', provider: 'stripe', currency: 'JPY' } }), res)
  assert.equal(res.code, 400)
})

// ── create-stripe-intent.ts ──────────────────────────────────────────────

function fakeAttemptsDb({ attempt = null }) {
  return {
    from(table) {
      if (table !== 'payment_attempts') throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => (attempt ? { data: attempt, error: null } : { data: null, error: null }) }) }),
      }
    },
  }
}

class FakeStripe {
  constructor() {
    this.paymentIntents = {
      create: async (params) => ({ id: 'pi_fake_offline', client_secret: 'pi_fake_offline_secret_test', ...params }),
    }
  }
}

async function loadCreateStripeIntent({ userId = 'buyer-1', db, StripeClass = FakeStripe, env = {} } = {}) {
  return loadModule(
    '../api/create-stripe-intent.ts',
    {
      stripe: { default: StripeClass },
      './_lib/supabaseAdmin': { getSupabaseAdmin: () => db },
      './_lib/verifyAuth': { verifyBearerToken: async () => (userId ? { userId, email: 'buyer@example.com' } : null) },
    },
    { STRIPE_SECRET_KEY: 'sk_test_offline_only', ...env },
  )
}

test('create-stripe-intent: rejects when Stripe is not configured', async () => {
  const module = await loadCreateStripeIntent({ db: fakeAttemptsDb({}), env: { STRIPE_SECRET_KEY: '' } })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { paymentAttemptId: 'attempt-1' } }), res)
  assert.equal(res.code, 500)
})

test('create-stripe-intent: rejects a payment attempt belonging to a different buyer, without leaking that it exists', async () => {
  const attempt = { id: 'attempt-1', order_id: 'order-1', buyer_id: 'someone-else', amount: 274, currency: 'USD', status: 'pending' }
  const module = await loadCreateStripeIntent({ userId: 'buyer-1', db: fakeAttemptsDb({ attempt }) })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { paymentAttemptId: 'attempt-1' } }), res)
  assert.equal(res.code, 404)
})

test('create-stripe-intent: rejects a payment attempt that is no longer pending', async () => {
  const attempt = { id: 'attempt-1', order_id: 'order-1', buyer_id: 'buyer-1', amount: 274, currency: 'USD', status: 'confirmed' }
  const module = await loadCreateStripeIntent({ db: fakeAttemptsDb({ attempt }) })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { paymentAttemptId: 'attempt-1' } }), res)
  assert.equal(res.code, 409)
})

test('create-stripe-intent: creates a PaymentIntent for the attempt\'s own amount/currency and metadata', async () => {
  const attempt = { id: 'attempt-1', order_id: 'order-1', buyer_id: 'buyer-1', amount: 274, currency: 'USD', status: 'pending' }
  let createdWith = null
  class RecordingStripe extends FakeStripe {
    constructor() {
      super()
      const create = this.paymentIntents.create
      this.paymentIntents.create = async (params) => {
        createdWith = params
        return create(params)
      }
    }
  }
  const module = await loadCreateStripeIntent({ db: fakeAttemptsDb({ attempt }), StripeClass: RecordingStripe })
  const res = fakeRes()
  await module.default(fakeReq({ authorization: 'Bearer tok', body: { paymentAttemptId: 'attempt-1' } }), res)

  assert.equal(res.code, 200)
  assert.equal(res.body.clientSecret, 'pi_fake_offline_secret_test')
  assert.equal(createdWith.amount, 27400, 'dollars must be converted to integer cents')
  assert.equal(createdWith.currency, 'usd')
  assert.equal(createdWith.metadata.order_id, 'order-1')
  assert.equal(createdWith.metadata.payment_attempt_id, 'attempt-1')
})
