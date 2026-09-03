import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'
import { makeReactMocks, findAll, collectText } from './dom-lite.mjs'

const containment = await loadModule('../src/lib/containment.ts')

async function render() {
  const { react, jsxRuntime } = makeReactMocks()
  const calls = { advanceOrder: [] }
  const order = {
    id: 'order-1', threadId: 'thread-1', listingId: 'listing-1', cropName: 'Maize',
    farmerName: 'Test Farmer', buyerName: 'Test Buyer', farmerId: 'farmer-1', buyerId: 'buyer-1',
    quantity: 1, unitPriceUSD: 250, logisticsUSD: 18, escrowFeeUSD: 6, totalUSD: 274,
    status: 'Escrow Funded', createdAt: Date.now(),
  }

  const module = await loadModule('../src/pages/FarmerDashboard.tsx', {
    react,
    'react/jsx-runtime': jsxRuntime,
    '../components/ChartFallback': { default: () => null },
    '../components/OrderStatusTracker': { default: () => null },
    '../components/AIPricingRadar': { default: () => null },
    '../context/AuthContext': {
      useAuth: () => ({ user: { id: 'farmer-1', name: 'Test Farmer', email: 'f@x.com', role: 'farmer' } }),
    },
    '../context/CropContext': {
      useCrops: () => ({ listings: [], addListing: () => {}, updateListing: () => {}, updateStatus: () => {}, deleteListing: () => {} }),
    },
    '../context/OrdersContext': {
      useOrders: () => ({
        orders: [order],
        advanceOrder: (...args) => calls.advanceOrder.push(args),
      }),
    },
    '../data/sellerListings': { CERTIFICATION_OPTIONS: [] },
    '../types': { ORDER_STAGES: ['Inquiry Sent', 'Escrow Funded', 'Logistics Scheduled', 'Delivered & Released'] },
    '../lib/containment': containment,
    '../lib/cropVisuals': { cropFallbackIcon: () => '🌱', isImageSource: () => false },
  })

  const tree = module.default({})
  return { tree, calls }
}

test('lifecycle advancement has no clickable control while contained', async () => {
  const { tree } = await render()
  const advanceButtons = findAll(tree, (n) => n.type === 'button' && typeof n.props?.onClick === 'function' && collectText(n).includes('Advance to'))
  assert.equal(advanceButtons.length, 0, 'no Advance button should be renderable while contained')

  const notice = findAll(tree, (n) => collectText(n).trim() === 'Temporarily unavailable')
  assert.ok(notice.length >= 1, 'expected the temporarily-unavailable label in its place')
})

test('the order and its current status remain visible for reading', async () => {
  const { tree } = await render()
  assert.ok(collectText(tree).includes('Maize'))
  assert.ok(collectText(tree).includes('Test Buyer'))
})
