import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'
import { makeReactMocks, findAll, collectText } from './dom-lite.mjs'

const containment = await loadModule('../src/lib/containment.ts')

async function render() {
  const { react, jsxRuntime } = makeReactMocks()
  const calls = { openFlutterwaveCheckout: [], getStripe: [], onConfirm: [], onClose: [] }

  function PaystackButtonMock() {
    return null
  }

  const module = await loadModule('../src/components/EscrowPaymentModal.tsx', {
    react,
    'react/jsx-runtime': jsxRuntime,
    '../context/AuthContext': { useAuth: () => ({ user: { id: 'buyer-1', name: 'Buyer', email: 'b@x.com', role: 'buyer' } }) },
    '../context/CurrencyContext': { useCurrency: () => ({ currency: 'USD', convert: (amount) => amount }) },
    '../lib/currency': { formatMoney: () => '$0' },
    '../lib/flutterwave': {
      isFlutterwaveConfigured: true,
      openFlutterwaveCheckout: async (...args) => {
        calls.openFlutterwaveCheckout.push(args)
        return { status: 'successful', tx_ref: 'FLW-TEST' }
      },
    },
    '../lib/stripe': {
      isStripeConfigured: true,
      getStripe: async (...args) => {
        calls.getStripe.push(args)
        return {}
      },
    },
    './PaystackButton': { default: PaystackButtonMock, isPaystackConfigured: true },
    '../lib/escrow': { computeEscrowBreakdown: () => ({ cropCostUSD: 250, logisticsUSD: 18, escrowFeeUSD: 6, totalUSD: 274 }) },
    '../lib/containment': containment,
  })

  const tree = module.default({
    orderId: 'order-1',
    cropName: 'Maize',
    quantity: 1,
    unitPriceUSD: 250,
    onConfirm: (...args) => calls.onConfirm.push(args),
    onClose: (...args) => calls.onClose.push(args),
  })
  return { tree, calls, PaystackButtonMock }
}

// The three tests below are rendering / control-availability checks: they
// inspect the JSX tree a single render pass produces and, where noted,
// invoke a control's real onClick handler. `useEffect` is mocked as a
// no-op in this harness (see dom-lite.mjs) and never actually runs, so
// none of this proves there is no unsafe *effect* that could reach a
// provider SDK or timer independently of the render/click paths checked
// here — only that the render output itself and the controls it exposes
// behave as asserted.

test('rendering: no payment method list, Pay button, or PaystackButton is present while contained', async () => {
  const { tree, PaystackButtonMock } = await render()
  assert.equal(findAll(tree, (n) => n.type === PaystackButtonMock).length, 0)
  assert.equal(findAll(tree, (n) => collectText(n).includes('Pay with')).length, 0)
  assert.equal(findAll(tree, (n) => collectText(n).includes('Simulate')).length, 0)
  assert.ok(collectText(tree).includes(containment.BLOCKED_ACTION_NOTICE))
})

test('rendering: the render pass itself calls neither the Flutterwave checkout, the Stripe SDK, nor the sandbox simulation', async () => {
  const { calls } = await render()
  // Confirms the mocked functions are not called merely by constructing
  // this component's JSX tree. Does NOT confirm they can never be called —
  // that depends on there being no click path or effect that reaches them,
  // which this test cannot see (see the file-level note above).
  assert.equal(calls.openFlutterwaveCheckout.length, 0)
  assert.equal(calls.getStripe.length, 0)
})

test('control availability: exactly one interactive control remains (Close), and clicking it closes without confirming a payment', async () => {
  const { tree, calls } = await render()
  const buttons = findAll(tree, (n) => n.type === 'button' && typeof n.props?.onClick === 'function')
  assert.equal(buttons.length, 1, 'exactly one interactive control should remain — Close')
  assert.equal(collectText(buttons[0]).trim(), 'Close')

  buttons[0].props.onClick()

  assert.equal(calls.onClose.length, 1, 'Close should actually call onClose')
  assert.equal(calls.onConfirm.length, 0, 'Close must never call onConfirm')
})
