import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, plain } from './load-module.mjs'

const escrow = await loadModule('../src/lib/escrow.ts')
const params = {
  threadId: 'thread-test', listingId: 'crop-test', farmerId: 'farmer-test',
  farmerName: 'Test Farmer', buyerName: 'Test Buyer', cropName: 'Maize',
  quantity: 1, unitPriceUSD: 280,
}

async function provider(results, user = { id: 'buyer-test' }) {
  const calls = []
  const db = {
    from(table) {
      calls.push(['from', table])
      const query = {}
      for (const method of ['select', 'eq', 'or', 'order', 'upsert', 'update']) {
        query[method] = (...args) => { calls.push([method, ...plain(args)]); return query }
      }
      const finish = () => {
        assert.ok(results.length, 'unexpected database request')
        return Promise.resolve(results.shift())
      }
      query.maybeSingle = finish
      query.single = finish
      query.then = (resolve, reject) => finish().then(resolve, reject)
      return query
    },
  }
  let value
  // Minimal hook adapter exercises real provider callbacks, not React rendering,
  // effects, scheduling, realtime subscriptions or Supabase/RLS integration.
  const react = {
    createContext: () => ({ Provider: ({ value: next }) => { value = next } }),
    useCallback: (fn) => fn, useContext: () => null, useEffect: () => {},
    useMemo: (fn) => fn(), useRef: (current) => ({ current }),
    useState: (initial) => [initial, () => {}],
  }
  const module = await loadModule('../src/context/OrdersContext.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, props) => typeof type === 'function' ? type(props) : null },
    '../hooks/useLocalStorage': { useLocalStorage: () => { throw new Error('Unexpected local mode') } },
    '../lib/supabase': { isSupabaseConfigured: true, supabase: db },
    '../lib/supabaseMappers': { isSchemaMismatchError: () => false, rowToOrder: (row) => row },
    '../types': { ORDER_STAGES: ['Inquiry Sent', 'Escrow Funded', 'Logistics Scheduled', 'Delivered & Released'] },
    './AuthContext': { useAuth: () => ({ user }) },
    '../lib/escrow': { toFundingUpdate: escrow.toFundingUpdate },
  })
  module.OrdersProvider({ children: null })
  return { value, calls }
}

test('existing conversation order is reused without overwriting funded terms', async () => {
  const { value, calls } = await provider([{ data: { id: 'funded-existing' }, error: null }])
  assert.equal(await value.createOrder(params), 'funded-existing')
  assert.equal(calls.some(([method]) => method === 'upsert' || method === 'update'), false)
})

test('new order writes quantity and listing price and awaits reload', async () => {
  const { value, calls } = await provider([
    { data: null, error: null }, { data: { id: 'new-order' }, error: null },
    { data: [], error: null },
  ])
  assert.equal(await value.createOrder(params), 'new-order')
  const [, row, options] = calls.find(([method]) => method === 'upsert')
  assert.equal(row.quantity_tons, 1)
  assert.equal(row.unit_price_usd, 280)
  assert.equal(row.total_amount, 280)
  assert.equal(row.escrow_status, 'Inquiry Sent')
  assert.deepEqual(options, { onConflict: 'conversation_id', ignoreDuplicates: true })
  assert.ok(calls.some(([method]) => method === 'order'), 'reload was awaited')
})

test('concurrent insert conflict resolves winner without updating it', async () => {
  const { value, calls } = await provider([
    { data: null, error: null }, { data: null, error: null },
    { data: { id: 'race-winner' }, error: null }, { data: [], error: null },
  ])
  assert.equal(await value.createOrder(params), 'race-winner')
  assert.equal(calls.some(([method]) => method === 'update'), false)
})

test('database insert failure rejects instead of reporting a new order', async () => {
  const { value } = await provider([
    { data: null, error: null }, { data: null, error: { message: 'denied' } },
  ])
  await assert.rejects(value.createOrder(params), /denied/)
})

test('sign-in and farmer ownership guards stop requests', async () => {
  const signedOut = await provider([], null)
  await assert.rejects(signedOut.value.createOrder(params), /signed in/)
  const missingFarmer = await provider([])
  await assert.rejects(missingFarmer.value.createOrder({ ...params, farmerId: undefined }), /farmer account/)
  assert.equal(signedOut.calls.length + missingFarmer.calls.length, 0)
})

test('funding callback sends accepted $250 price alongside $274 total, and resolves true only once the row confirms it', async () => {
  const { value, calls } = await provider([{ data: { escrow_status: 'Escrow Funded' }, error: null }])
  const funded = await value.fundEscrow('test-order', {
    unitPriceUSD: 250, ...escrow.computeEscrowBreakdown(1, 250), receiptReference: 'TEST-ONLY',
  })
  assert.equal(funded, true)
  const [, update] = calls.find(([method]) => method === 'update')
  assert.equal(update.unit_price_usd, 250)
  assert.equal(update.total_amount, 274)
  assert.deepEqual(calls.find(([method]) => method === 'eq'), ['eq', 'id', 'test-order'])
})

test('funding callback resolves false, not true, when the update matches zero rows and reports no error', async () => {
  // The exact shape an RLS-blocked write returns: no `error`, but no row
  // either — checking only `error === null` would misreport this as funded.
  const { value } = await provider([{ data: null, error: null }])
  const funded = await value.fundEscrow('test-order', {
    unitPriceUSD: 250, ...escrow.computeEscrowBreakdown(1, 250), receiptReference: 'TEST-ONLY',
  })
  assert.equal(funded, false)
})

test('funding callback resolves false on a database error', async () => {
  const { value } = await provider([{ data: null, error: { message: 'denied' } }])
  const funded = await value.fundEscrow('test-order', {
    unitPriceUSD: 250, ...escrow.computeEscrowBreakdown(1, 250), receiptReference: 'TEST-ONLY',
  })
  assert.equal(funded, false)
})
