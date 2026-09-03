import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'
import { makeReactMocks, findAll, collectText } from './dom-lite.mjs'

const containment = await loadModule('../src/lib/containment.ts')

async function render() {
  const { react, jsxRuntime } = makeReactMocks()
  const calls = { startThread: [], createOrder: [], navigate: [] }
  const listing = {
    id: 'listing-1',
    cropName: 'Maize',
    category: 'Grains',
    originCountry: 'Kenya',
    availableQuantity: 50,
    unitPriceUSD: 280,
    farmerName: 'Test Farmer',
    farmerId: 'farmer-1',
    verifiedStatus: false,
    harvestDate: '',
    image: '🌱',
    certifications: [],
    status: 'Available',
  }
  const module = await loadModule('../src/components/ProductDetailModal.tsx', {
    react,
    'react/jsx-runtime': jsxRuntime,
    'react-router-dom': { useNavigate: () => (...args) => calls.navigate.push(args) },
    '../context/AuthContext': {
      useAuth: () => ({ user: { id: 'buyer-1', name: 'Buyer', email: 'b@x.com', role: 'buyer' } }),
    },
    '../context/CurrencyContext': { useCurrency: () => ({ currency: 'USD', convert: (amount) => amount }) },
    '../context/MessagingContext': {
      useMessaging: () => ({
        startThread: async (params) => {
          calls.startThread.push(params)
          return 'thread-1'
        },
      }),
    },
    '../context/OrdersContext': {
      useOrders: () => ({
        createOrder: async (params) => {
          calls.createOrder.push(params)
          return 'order-1'
        },
      }),
    },
    '../lib/containment': containment,
    '../lib/cropVisuals': { cropFallbackIcon: () => '🌱', isImageSource: () => false },
    '../lib/currency': { CONVERTER_CURRENCIES: [{ code: 'USD', label: 'USD' }], formatMoney: () => '$0' },
    '../lib/dates': { formatHarvestDate: () => 'Not specified' },
    '../lib/supabase': { isSupabaseConfigured: true },
    './ChartFallback': { default: () => null },
    './TradeJourneySteps': { default: () => null },
  })

  const tree = module.default({ listing, onClose: () => {} })
  // The primary CTA — the only other onClick-bearing button in this
  // component is the aria-label="Close" icon button, excluded here.
  const button = findAll(tree, (n) => n.type === 'button' && typeof n.props?.onClick === 'function' && n.props['aria-label'] !== 'Close')[0]
  return { tree, button, calls }
}

test('Request Quote is disabled and shows the containment notice while contained', async () => {
  const { tree, button } = await render()
  assert.equal(button.props.disabled, true)
  assert.ok(collectText(button).includes('Temporarily Unavailable'))
  assert.ok(collectText(tree).includes(containment.BLOCKED_ACTION_NOTICE))
})

test('clicking Request Quote while contained returns before startThread, message creation, or order creation', async () => {
  const { button, calls } = await render()
  await button.props.onClick()
  assert.equal(calls.startThread.length, 0, 'startThread must not be called')
  assert.equal(calls.createOrder.length, 0, 'createOrder must not be called')
  // No conversation was started, so nothing has been created for the
  // orphan-prevention guard to have to clean up.
})
