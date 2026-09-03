# Payment security audit — 2026-09-03

## Decision

Keep real-money payments disabled until the server-side payment authority and
database permissions are hardened. The current flow demonstrates trade states;
it does not establish that money is securely held or released in escrow.

Scope: local source inspection and offline automated tests only. No production
database, credentials, provider settings, deployment or existing orders changed.
The live database may differ from `supabase/schema.sql`; its grants, policies and
triggers must be inspected before preparing a migration. This is not a full
penetration test or an audit of provider account configuration.

## Findings

### Critical — participants can author payment state

`src/context/OrdersContext.tsx` sends a direct `orders.update` from `fundEscrow`,
including status, unit price, fees, total and receipt. In `supabase/schema.sql`,
the participant UPDATE policy checks ownership, not which fields or transitions
can be changed. The INSERT policy checks only `buyer_id`; it does not require
the initial unfunded status or enforce server-derived terms.

With these repository policies deployed and normal table write grants, a
participant need not complete payment to write a funded state. Disabling a UI
button alone would not address this. Verify actual live policies and grants;
do not infer them from the repository.

### Critical — callbacks and simulations use the same funded path

`Messages.tsx:handleConfirmEscrow` calls `fundEscrow` for every result, including
`sandbox: true`. `EscrowPaymentModal.tsx` simulates Flutterwave when no key is
configured and simulates Stripe even when its SDK loads. Paystack and Flutterwave
client callbacks can also trigger the same database update without waiting for a
server-verified payment. Sandbox receipts are labels, not an authorization boundary.

### High — webhook success is not matched to expected payment terms

Stripe verifies signatures, but `api/stripe-webhook.ts` uses `metadata.order_id`
to mark an order funded without comparing amount received, currency, payment
attempt/reference or mode against authoritative stored terms.

Flutterwave checks a shared header secret, but does not call transaction
verification or compare amount, currency and transaction reference against
stored expectations before updating an order. Its event-type check is also
absent: the handler accepts any body with `data.status === 'successful'`.

Offline reproductions confirm that a correctly authenticated event with the
wrong currency and a tiny amount still issues a funded update in both handlers.
This does not demonstrate signature forgery or a production exploit.

### High — repeated notifications can regress order state

Stripe and Flutterwave updates filter only by order ID. A delayed or repeated
successful-payment event can overwrite a later lifecycle state with
`Escrow Funded`. Neither handler records unique processed event IDs or atomically
checks the current state. An offline Stripe replay reproduces a second
unconditional update. Matching zero rows is handled, but replay safety is not.

### High — Paystack receipt recording is disconnected from orders

`PaystackButton.tsx` sends `user_id` metadata, not a server-created order/payment
attempt binding. `api/paystack-webhook.ts` records `transactions` with a
reference-conflict upsert, but does not verify expected order terms or fund the
associated order. The browser callback remains the order-funding authority.
The upsert is receipt deduplication, not complete payment fulfillment idempotency.

### Medium — failures can look like success

`fundEscrow` and `advanceOrder` return void and log asynchronous write errors.
The messaging UI can continue before the database acknowledges the update.
Offer acceptance is inferred from message order rather than an immutable
accepted-offer/payment-attempt record. Local mock order creation also assigns
its return ID inside a React state updater; scheduling behavior needs a separate
React integration test. The tests here do not certify that local-mode path.

### Follow-up — input validation and rounding

The existing formula rounds the fee to whole dollars. This audit preserves it:
1 tonne at $250 gives $250 + $18 + $6 = $274. Do not silently change previously
funded amounts. Before real charging, define currency/minor-unit rounding and
validate finite positive quantities/prices, safe totals, and server-locked FX.
The extracted calculator is not a validation or payment-verification boundary.

## Automated coverage

Run `npm test` (tested with Node 25.9.0). Uses Node's test runner, experimental VM
modules, and the existing TypeScript dependency. The experimental VM warning is
expected. No new dependencies or environment-file loading are required.

30 tests: 27 regression/protection checks and 3 explicitly named `AUDIT GAP`
reproductions. All currently pass; **that is not a payment-security pass**.
Replace the three reproductions with rejection/no-op assertions when fixed.

- Existing $250/$274 calculation, original $280 pricing, fractional quantity,
  whole-dollar fee rounding and persisted negotiated price.
- Actual Supabase provider callbacks: existing-order reuse, conflict winner
  resolution, initial pricing, insert failure and missing-user/farmer guards.
- Actual webhook handlers: method/configuration/authentication rejection,
  real Stripe SDK signature checking, Paystack raw-body HMAC checking,
  malformed JSON, ignored events, failed writes and unknown orders.
- Audit reproductions: Stripe and Flutterwave unmatched payment amounts/currencies;
  Stripe replay without a status guard.

The test harness supplies fake database clients and minimal React hooks. It
does not execute real RLS, browser rendering, realtime behavior, React scheduling,
provider API calls, payouts or end-to-end money movement. No network or real
database dependency is supplied to the tested modules.

## Implementation sequence requiring a separate hardening pass

1. Read live policies, grants and triggers. Establish separate test/live payment
   modes and decide which provider to implement first.
2. Store accepted terms and create authenticated server-side payment attempts
   with immutable order, buyer, amount, currency, mode and provider reference.
3. Verify provider events against those attempts; handle retries transactionally
   with unique event/payment references and allowed state transitions.
4. Remove client authority over payment fields, including INSERT shortcuts.
   Restrict logistics/delivery actions by actor and current state. Deploy these
   database and API changes together with UI changes to avoid breaking checkout.
5. Have the UI wait for persisted server-confirmed status and display failures.
   Keep simulated trades clearly separate from real-money trades.
6. Run adversarial database/integration tests for forged client updates,
   underpayment, wrong currency/order/mode, duplicate events and late events.
   A payment receipt alone is not an escrow custody/release implementation.

## Addendum — 2026-09-03: production policy incident and client-side containment

Subsequent to this audit, the four `orders` write policies referenced above
(the participant INSERT and UPDATE policies this audit's Critical finding
describes) were **removed from the production database** during an unrelated
diagnostic session — an accident, not a deliberate hardening step. Only the
two `orders` SELECT policies remain live. This incidentally blocks the exact
client-write path this audit flagged as unsafe, but it is not the fix this
audit calls for: no server-side payment authority, accepted-terms record, or
webhook verification-against-expectations from the sequence below was
implemented. The database was left in this state deliberately, pending the
real fix, rather than restoring the original unrestricted policies.

A client-side containment patch (`src/lib/containment.ts` and its call sites
in `EscrowPaymentModal.tsx`, `Messages.tsx`, `ProductDetailModal.tsx`,
`FarmerDashboard.tsx`, tested in `tests/containment.test.mjs` and the other
`tests/*.test.mjs` files added alongside it) now additionally hard-disables
Request Quote, both Fund Escrow entry points, and lifecycle advancement in
the UI itself, and stops a late payment-provider callback from reporting
success. **This is containment, not remediation**: it does not implement any
item in the "Implementation sequence requiring a separate hardening pass"
below, does not restore or replace the removed write policies, does not
protect a browser tab that already has an older build loaded, and does not
close an already-open checkout window or direct provider access. The
Critical/High findings above remain fully open until that sequence is
actually carried out.

## Official guidance consulted

- [Paystack: Accept payments](https://paystack.com/docs/payments/accept-payments/)
  requires checking the amount before delivering value.
- [Flutterwave v3: Webhooks](https://developer.flutterwave.com/v3.0/docs/webhooks)
  and [transaction verification](https://developer.flutterwave.com/v3.0/docs/transaction-verification)
  describe verifying status, amount, currency and reference before confirming orders.
- [Stripe: Webhooks](https://docs.stripe.com/webhooks?lang=node)
  documents duplicate events and lack of event ordering guarantees.
