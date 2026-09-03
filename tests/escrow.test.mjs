import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule, plain } from './load-module.mjs'

const { computeEscrowBreakdown, toFundingUpdate } = await loadModule('../src/lib/escrow.ts')

test('accepted $250 offer produces the established $274 total', () => {
  assert.deepEqual(plain(computeEscrowBreakdown(1, 250)), {
    cropCostUSD: 250, logisticsUSD: 18, escrowFeeUSD: 6, totalUSD: 274,
  })
})

test('funding payload persists accepted price, not original $280 listing price', () => {
  const estimate = computeEscrowBreakdown(1, 250)
  assert.deepEqual(plain(toFundingUpdate({
    ...estimate, unitPriceUSD: 250, receiptReference: 'TEST-ONLY',
  })), {
    escrow_status: 'Escrow Funded', unit_price_usd: 250, logistics_usd: 18,
    escrow_fee_usd: 6, total_amount: 274, receipt_reference: 'TEST-ONLY',
  })
})

test('unnegotiated price uses its own breakdown', () => {
  assert.deepEqual(plain(computeEscrowBreakdown(1, 280)), {
    cropCostUSD: 280, logisticsUSD: 18, escrowFeeUSD: 7, totalUSD: 305,
  })
})

test('quantity scales crop and logistics costs; fee keeps whole-dollar rounding', () => {
  assert.deepEqual(plain(computeEscrowBreakdown(0.5, 250)), {
    cropCostUSD: 125, logisticsUSD: 9, escrowFeeUSD: 3, totalUSD: 137,
  })
  assert.equal(computeEscrowBreakdown(2, 250).escrowFeeUSD, 13)
  assert.equal(computeEscrowBreakdown(2, 250).totalUSD, 549)
})
