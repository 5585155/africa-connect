import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'
import { makeReactMocks, findAll, collectText } from './dom-lite.mjs'

const containment = await loadModule('../src/lib/containment.ts')

function fixtures() {
  const messages = [
    { id: 'm1', sender: 'them', kind: 'text', text: 'Hi, interested in your Maize', timestamp: 1 },
    { id: 'm2', sender: 'them', kind: 'offer', text: 'Counter-offer: $250 / ton', timestamp: 2, priceOffer: 250 },
    { id: 'm3', sender: 'me', kind: 'offer_accepted', text: 'Accepted offer of $250/ton', timestamp: 3, priceOffer: 250 },
  ]
  const thread = { id: 'thread-1', listingId: 'listing-1', cropName: 'Maize', counterpartName: 'Test Farmer', messages }
  const order = {
    id: 'order-1', threadId: 'thread-1', listingId: 'listing-1', cropName: 'Maize',
    farmerName: 'Test Farmer', buyerName: 'Buyer', farmerId: 'farmer-1', buyerId: 'buyer-1',
    quantity: 1, unitPriceUSD: 280, logisticsUSD: 0, escrowFeeUSD: 0, totalUSD: 280,
    status: 'Inquiry Sent', createdAt: Date.now(),
  }
  return { thread, order }
}

async function render({ stateOverrides = [], containmentOverride, fundEscrowResult = true } = {}) {
  const { thread, order } = fixtures()
  const { react, jsxRuntime } = makeReactMocks({ stateOverrides })
  const calls = { sendMessage: [], fundEscrow: [], setSearchParams: [] }

  function EscrowPaymentModalMock() {
    return null
  }

  const module = await loadModule('../src/pages/Messages.tsx', {
    react,
    'react/jsx-runtime': jsxRuntime,
    'react-router-dom': {
      useSearchParams: () => [
        { get: (key) => (key === 'thread' ? thread.id : null) },
        (...args) => calls.setSearchParams.push(args),
      ],
    },
    '../components/EscrowPaymentModal': { default: EscrowPaymentModalMock },
    '../lib/escrow': {
      computeEscrowBreakdown: () => ({ logisticsUSD: 18, escrowFeeUSD: 6, totalUSD: 274 }),
    },
    '../lib/containment': containmentOverride ?? containment,
    '../components/OrderStatusTracker': { default: () => null },
    '../context/AuthContext': {
      useAuth: () => ({ user: { id: 'buyer-1', name: 'Buyer', email: 'b@x.com', role: 'buyer' } }),
    },
    '../context/MessagingContext': {
      useMessaging: () => ({
        threads: [thread],
        loading: false,
        sendMessage: (...args) => calls.sendMessage.push(args),
      }),
    },
    '../context/OrdersContext': {
      useOrders: () => ({
        getOrderByThread: (id) => (id === thread.id ? order : undefined),
        fundEscrow: async (...args) => {
          calls.fundEscrow.push(args)
          return fundEscrowResult
        },
      }),
    },
  })

  const tree = module.default({})
  return { tree, calls, EscrowPaymentModalMock }
}

test('both Fund Escrow entry points render as inert text, not buttons, while contained', async () => {
  const { tree } = await render()
  const fundEscrowButtons = findAll(
    tree,
    (n) => n.type === 'button' && typeof n.props?.onClick === 'function' && collectText(n).includes('Fund Escrow'),
  )
  assert.equal(fundEscrowButtons.length, 0, 'no clickable Fund Escrow control should exist while contained')

  // Matched by element type + its own exact wording, not just "contains the
  // text somewhere in its subtree" — a predicate like that would also match
  // every ancestor of a matching node (their collectText includes the same
  // substring by concatenation), which could pass even with only one real
  // notice on the page. Scoping by type isolates each leaf notice: only one
  // <p> in the whole tree carries the per-offer wording, and only one
  // <span> carries the standalone wording — asserted as exactly 1 each, not
  // ">= 2" combined, so a regression collapsing them to one location or
  // duplicating one of them would be caught.
  const perOfferNotice = findAll(tree, (n) => n.type === 'p' && collectText(n).includes('Fund Escrow temporarily unavailable'))
  assert.equal(perOfferNotice.length, 1, 'expected exactly one per-offer Fund Escrow notice')

  const standaloneNotice = findAll(tree, (n) => n.type === 'span' && collectText(n).includes('Fund Escrow — temporarily unavailable'))
  assert.equal(standaloneNotice.length, 1, 'expected exactly one standalone Fund Escrow notice')
})

test('existing conversation reading remains available', async () => {
  const { tree } = await render()
  // The thread list, the order status header, and the message history are
  // all present — reading is untouched by containment.
  assert.ok(collectText(tree).includes('Test Farmer'))
  assert.ok(collectText(tree).includes('Counter-offer: $250 / ton'))

  const counterOfferButton = findAll(tree, (n) => n.type === 'button' && collectText(n).includes('Counter-offer'))[0]
  assert.ok(counterOfferButton && typeof counterOfferButton.props.onClick === 'function')
})

test('ordinary text messaging actually sends: submitting the form with non-empty draft calls sendMessage with that text', async () => {
  // `draft` is useState call #2 (index 1) — seeded non-empty here since the
  // mocked setState from typing into the input is a no-op; this is what
  // lets handleSend's `!draft.trim()` guard pass so the real call can be
  // observed, rather than just checking the form/button exist.
  const { tree, calls } = await render({ stateOverrides: [undefined, 'Still interested, can you confirm shipping date?'] })

  // showOfferInput starts false, so its form isn't in the tree at all —
  // the plain-text send form is the only <form> present.
  const sendForm = findAll(tree, (n) => n.type === 'form')[0]
  assert.ok(sendForm, 'the plain-text send form should be present')
  assert.equal(typeof sendForm.props.onSubmit, 'function')

  sendForm.props.onSubmit({ preventDefault: () => {} })

  assert.equal(calls.sendMessage.length, 1)
  assert.deepEqual(calls.sendMessage[0], ['thread-1', 'Still interested, can you confirm shipping date?', 'text'])
})

test('a late payment-provider callback while contained never calls fundEscrow or sends any message to the counterparty', async () => {
  // showEscrowModal is useState call #5 (index 4) — force it true so the
  // guarded EscrowPaymentModal + its onConfirm prop actually appear in the
  // tree, simulating a checkout that was already open before containment
  // shipped (a stale tab would have showEscrowModal genuinely true).
  const { tree, calls } = await render({ stateOverrides: [undefined, undefined, undefined, undefined, true] })
  const modalNode = findAll(tree, (n) => typeof n.props?.onConfirm === 'function')[0]
  assert.ok(modalNode, 'expected the EscrowPaymentModal element with its onConfirm callback to be present')

  await modalNode.props.onConfirm({ method: 'flutterwave', reference: 'FLW-LATE-CALLBACK', sandbox: false })

  assert.equal(calls.fundEscrow.length, 0, 'fundEscrow must never be called for a late callback while contained')
  assert.equal(calls.sendMessage.length, 0, 'no message — funded, escrow, or otherwise — may be sent to the counterparty')
})

test('handleConfirmEscrow awaits fundEscrow\'s boolean and does not claim success when it resolves false', async () => {
  // Independent of whether containment is currently on: this is the only
  // caller of fundEscrow in the app (verified by grep), so this is the one
  // place that must correctly react to a false result — a write that
  // returned no error but changed no row — rather than assuming success
  // from having been called at all. Overrides the containment import for
  // just this render so the (currently unreachable while contained) real
  // funding branch executes and can be observed directly.
  const notContained = {
    ...containment,
    guardPaymentConfirm: () => ({ allowed: true }),
  }
  const { tree, calls } = await render({
    stateOverrides: [undefined, undefined, undefined, undefined, true],
    containmentOverride: notContained,
    fundEscrowResult: false,
  })
  const modalNode = findAll(tree, (n) => typeof n.props?.onConfirm === 'function')[0]
  assert.ok(modalNode)

  await modalNode.props.onConfirm({ method: 'flutterwave', reference: 'FLW-REF', sandbox: false })

  assert.equal(calls.fundEscrow.length, 1, 'fundEscrow should have been called and awaited')
  assert.equal(calls.sendMessage.length, 0, 'no "Funded escrow" success message may be posted when fundEscrow resolves false')
})
