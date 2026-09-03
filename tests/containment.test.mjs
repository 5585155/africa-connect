import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const containment = await loadModule('../src/lib/containment.ts')
const { ORDER_WRITES_CONTAINED, BLOCKED_ACTION_NOTICE, LATE_CALLBACK_NOTICE, guardPaymentStart, guardPaymentConfirm, guardNewOrder, guardOrderAdvance } =
  containment

test('containment is active', () => {
  assert.equal(ORDER_WRITES_CONTAINED, true)
})

test('the blocked-action notice does not claim success, promise automatic reconciliation, or overstate what is unaffected', () => {
  const lower = BLOCKED_ACTION_NOTICE.toLowerCase()
  for (const forbidden of ['held in escrow', 'funded', 'success', 'confirmed', 'complete', 'we will', 'our team will', 'unaffected']) {
    assert.ok(!lower.includes(forbidden), `blocked-action notice should not contain "${forbidden}": ${BLOCKED_ACTION_NOTICE}`)
  }
  assert.ok(lower.includes('temporarily unavailable'))
  assert.ok(lower.includes('view existing orders'))
})

test('the late-callback notice tells the reader not to pay again and does not claim success, failure, or automatic reconciliation', () => {
  const lower = LATE_CALLBACK_NOTICE.toLowerCase()
  for (const forbidden of ['held in escrow', 'funded', 'success', 'failed', 'we will', 'our team will', 'unaffected']) {
    assert.ok(!lower.includes(forbidden), `late-callback notice should not contain "${forbidden}": ${LATE_CALLBACK_NOTICE}`)
  }
  assert.ok(lower.includes('do not pay again'))
  assert.ok(lower.includes('cannot confirm'))
})

// These are the actual functions EscrowPaymentModal.tsx, Messages.tsx,
// ProductDetailModal.tsx, and FarmerDashboard.tsx import and call — not a
// re-implementation of their logic.
for (const [name, guard, expectedMessage] of [
  ['guardPaymentStart', guardPaymentStart, BLOCKED_ACTION_NOTICE],
  ['guardNewOrder', guardNewOrder, BLOCKED_ACTION_NOTICE],
  ['guardOrderAdvance', guardOrderAdvance, BLOCKED_ACTION_NOTICE],
]) {
  test(`${name}() blocks with the blocked-action notice while contained`, () => {
    const result = guard()
    assert.equal(result.allowed, false)
    assert.equal(result.message, expectedMessage)
  })
}

test('guardPaymentConfirm() blocks with the distinct late-callback notice, not the blocked-action notice', () => {
  const result = guardPaymentConfirm()
  assert.equal(result.allowed, false)
  assert.equal(result.message, LATE_CALLBACK_NOTICE)
  assert.notEqual(result.message, BLOCKED_ACTION_NOTICE)
})
