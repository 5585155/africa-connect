import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'
import Stripe from 'stripe'
import { loadModule, plain } from './load-module.mjs'

const secret = 'offline-test-secret-only'
const stripe = new Stripe('sk_test_offline_only')

async function setup(provider, result = { data: [{ id: 'test-order' }], error: null }, configured = true) {
  const writes = []
  const db = {
    from(table) {
      const query = {
        update(row) { writes.push({ table, row: plain(row), filters: [] }); return query },
        eq(...args) { writes.at(-1).filters.push(args); return query },
        select: async () => result,
        upsert: async (row, options) => { writes.push({ table, row: plain(row), options: plain(options) }); return result },
      }
      return query
    },
  }
  const env = configured ? {
    STRIPE_SECRET_KEY: 'sk_test_offline_only', STRIPE_WEBHOOK_SECRET: secret,
    PAYSTACK_SECRET_KEY: secret, FLUTTERWAVE_SECRET_HASH: secret,
  } : {}
  const module = await loadModule(`../api/${provider}-webhook.ts`, {
    stripe: { default: Stripe },
    'node:crypto': { createHmac, timingSafeEqual },
    './_lib/supabaseAdmin': { getSupabaseAdmin: () => db },
  }, env)
  return {
    writes,
    async send(payload, { method = 'POST', valid = true, raw } = {}) {
      const text = raw ?? JSON.stringify(payload)
      const headers = provider === 'stripe'
        ? { 'stripe-signature': valid ? stripe.webhooks.generateTestHeaderString({ payload: text, secret }) : 'invalid' }
        : provider === 'paystack'
          ? { 'x-paystack-signature': valid ? createHmac('sha512', secret).update(text).digest('hex') : 'invalid' }
          : { 'verif-hash': valid ? secret : 'invalid' }
      const req = Object.assign(Readable.from([Buffer.from(text)]), { method, headers, body: payload })
      const res = {
        code: 0, body: null, headers: {},
        setHeader(name, value) { this.headers[name] = value },
        status(code) { this.code = code; return this },
        json(body) { this.body = plain(body); return this },
      }
      await module.default(req, res)
      return res
    },
  }
}

const stripeEvent = {
  id: 'evt_offline', type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_offline', amount_received: 27400, currency: 'usd', metadata: { order_id: 'test-order' } } },
}
const flwEvent = {
  event: 'charge.completed',
  data: { id: 1, status: 'successful', amount: 274, currency: 'USD', tx_ref: 'offline', meta: { order_id: 'test-order' } },
}
const paystackEvent = {
  event: 'charge.success',
  data: { reference: 'offline', amount: 27400, currency: 'USD', customer: { email: 'test@example.com' }, metadata: { user_id: 'test-buyer' } },
}

for (const [provider, event] of [['stripe', stripeEvent], ['flutterwave', flwEvent], ['paystack', paystackEvent]]) {
  test(`${provider}: rejects non-POST without writing`, async () => {
    const app = await setup(provider)
    const res = await app.send(event, { method: 'GET' })
    assert.equal(res.code, 405)
    assert.equal(res.headers.Allow, 'POST')
    assert.equal(app.writes.length, 0)
  })
  test(`${provider}: rejects missing configuration without writing`, async () => {
    const app = await setup(provider, undefined, false)
    assert.equal((await app.send(event)).code, 500)
    assert.equal(app.writes.length, 0)
  })
  test(`${provider}: rejects invalid authentication without writing`, async () => {
    const app = await setup(provider)
    const res = await app.send(event, { valid: false })
    assert.ok([400, 401].includes(res.code))
    assert.equal(app.writes.length, 0)
  })
  test(`${provider}: propagates database failure for retry`, async () => {
    const app = await setup(provider, { data: null, error: { message: 'offline failure' } })
    assert.equal((await app.send(event)).code, 500)
  })
}

test('Stripe verifies exact raw bytes with its real SDK', async () => {
  const app = await setup('stripe')
  assert.equal((await app.send(stripeEvent, { raw: JSON.stringify(stripeEvent, null, 2) })).code, 200)
  assert.equal(app.writes[0].row.receipt_reference, 'pi_offline')
})

test('Paystack verifies exact raw bytes and records amount/currency/reference', async () => {
  const app = await setup('paystack')
  assert.equal((await app.send(paystackEvent, { raw: JSON.stringify(paystackEvent, null, 2) })).code, 200)
  assert.equal(app.writes[0].row.amount, 274)
  assert.equal(app.writes[0].row.currency, 'USD')
  assert.equal(app.writes[0].options.onConflict, 'reference')
  assert.equal(app.writes[0].table, 'transactions')
})

test('Paystack rejects signed malformed JSON without writing', async () => {
  const app = await setup('paystack')
  assert.equal((await app.send({}, { raw: '{broken' })).code, 400)
  assert.equal(app.writes.length, 0)
})

test('irrelevant events are acknowledged without writing', async () => {
  for (const provider of ['stripe', 'paystack', 'flutterwave']) {
    const app = await setup(provider)
    assert.equal((await app.send({ type: 'other', event: 'other' })).code, 200)
    assert.equal(app.writes.length, 0)
  }
})

test('Stripe and Flutterwave report unknown order rather than silent success', async () => {
  for (const [provider, event] of [['stripe', stripeEvent], ['flutterwave', flwEvent]]) {
    const app = await setup(provider, { data: [], error: null })
    assert.equal((await app.send(event)).code, 404)
  }
})

// Audit reproductions: passing means the vulnerability was reproduced, NOT
// that payments are secure. Replace these with rejection tests when hardened.
test('AUDIT GAP: Stripe underpayment still issues a funded update', async () => {
  const app = await setup('stripe')
  const event = structuredClone(stripeEvent)
  event.data.object.amount_received = 1
  event.data.object.currency = 'eur'
  await app.send(event)
  assert.equal(app.writes[0].row.escrow_status, 'Escrow Funded')
})

test('AUDIT GAP: Flutterwave underpayment still issues a funded update', async () => {
  const app = await setup('flutterwave')
  await app.send({ ...flwEvent, data: { ...flwEvent.data, amount: 0.01, currency: 'NGN' } })
  assert.equal(app.writes[0].row.escrow_status, 'Escrow Funded')
})

test('AUDIT GAP: replay updates Stripe order again with no current-status guard', async () => {
  const app = await setup('stripe')
  await app.send(stripeEvent)
  await app.send(stripeEvent)
  assert.equal(app.writes.length, 2)
  assert.deepEqual(app.writes[1].filters, [['id', 'test-order']])
})
