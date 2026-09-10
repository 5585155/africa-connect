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

## Addendum — 2026-09-10: implementation sequence items 1-5 built

Items 1-5 of the "Implementation sequence requiring a separate hardening
pass" above have been implemented in code. This is not the same claim as
"verified against a real payment provider and a real Postgres instance" —
see the honest gaps at the end of this addendum before treating any of this
as cleared for production traffic.

**Item 1 (read live policies, establish payment authority) — schema.sql.**
Two new tables: `payment_attempts` (the server-computed amount/currency a
checkout is expected to charge, created by `api/create-payment-attempt.ts`
before any provider checkout opens — never trusts a client-submitted
amount) and `processed_webhook_events` (provider + event id, unique —
the replay guard every webhook now checks first). A new trigger,
`guard_order_financial_writes`, blocks any `authenticated`-role update to
`orders.escrow_status` (into `'Escrow Funded'` specifically), `unit_price_usd`,
`logistics_usd`, `escrow_fee_usd`, `total_amount`, or `receipt_reference` —
only the `service_role` webhook path may change them. RLS alone can't express
"compare against the OLD row," which is why this is a trigger, not a policy;
it runs independently of whatever the `orders` UPDATE policy's `USING`
clause allows, on purpose. The `orders` INSERT policy now also requires
`escrow_status = 'Inquiry Sent'` and `receipt_reference is null`, closing the
"insert an already-funded order" hole item 1's Critical finding described.

**Item 2 (authenticated payment attempts) — `api/create-payment-attempt.ts`.**
Verifies the caller's Supabase session server-side (`api/_lib/verifyAuth.ts`),
confirms the order belongs to that buyer and is still `'Inquiry Sent'`, then
computes the expected charge itself from the order's own stored
quantity/unit price (via the same `computeEscrowBreakdown` the client uses)
converted to the requested settlement currency — the client's role is only to
pick a provider and currency, never to state an amount.

**Item 3 (verify against expectations, handle retries) — all three webhooks.**
Each of `api/stripe-webhook.ts`, `api/flutterwave-webhook.ts`,
`api/paystack-webhook.ts` now: claims the event in `processed_webhook_events`
before doing anything else (a redelivery is a 200 no-op); looks up the
payment attempt named in the event's metadata and rejects — marking the
attempt `'failed'`, leaving the order untouched — if the received
amount/currency doesn't match it; only then updates `orders`. Paystack's
handler previously stopped at writing `transactions` and never funded the
order it belonged to (item 4's own finding) — it now does, the same way the
other two do.

**Item 4 (remove client authority) — the trigger above, plus
`src/pages/Messages.tsx`.** A real (non-sandbox) provider callback firing
client-side no longer calls `fundEscrow` itself when a Supabase project is
configured — that was the exact "callbacks and simulations use the same
funded path" Critical finding. The client now only posts an informational
"submitted, awaiting confirmation" message; the order's own realtime
subscription reflects the webhook's write once it lands. The local-mock
(no Supabase project) sandbox path is unchanged — there is no webhook to wait
for there, so it remains the only way escrow gets "funded" in that mode,
exactly as before.

**Item 5 (Stripe's missing charge path) — `api/create-stripe-intent.ts`.**
Creates a real `PaymentIntent` from the payment attempt's own
server-computed amount/currency (never the client's). `EscrowPaymentModal.tsx`
mounts a real Stripe Card Element and confirms with `stripe.confirmCardPayment`
once a Supabase project and a Stripe key are both configured; without either,
it still falls back to the same clearly-labeled simulation as before.

**Adversarial coverage.** The three `AUDIT GAP` reproductions in
`tests/webhooks.test.mjs` have been replaced with rejection assertions, per
this doc's own instruction: underpayment against a seeded payment attempt no
longer funds the order (Stripe and Flutterwave), and a replayed Stripe event
no longer updates the order a second time. A new test confirms Paystack now
funds the linked order. 53 tests pass.

**What this addendum does NOT establish — read before relying on any of it.**
- The offline test harness mocks the Supabase client entirely; it cannot
  execute real Postgres RLS policies or the new trigger. `guard_order_financial_writes`
  and the tightened INSERT policy have not been run against a live Postgres
  instance. Verify them there — e.g. attempt a participant-role update of
  `escrow_status` to `'Escrow Funded'` directly and confirm it raises.
- No real Stripe, Flutterwave, or Paystack sandbox account has exercised
  `create-payment-attempt` → checkout → webhook end to end. The currency-
  conversion math, minor-unit rounding, and each provider's actual webhook
  payload shape should be confirmed against their real test modes.
- The `listing-photos` storage bucket and its policies (see the storage
  addition to schema.sql) have not been exercised against a live bucket either.
- `ORDER_WRITES_CONTAINED` in `src/lib/containment.ts` has deliberately been
  left `true`. Flipping it is a separate, explicit decision — gated on
  applying the updated `schema.sql` to the actual production project and
  confirming the above against it, not on this addendum alone.

## Official guidance consulted

- [Paystack: Accept payments](https://paystack.com/docs/payments/accept-payments/)
  requires checking the amount before delivering value.
- [Flutterwave v3: Webhooks](https://developer.flutterwave.com/v3.0/docs/webhooks)
  and [transaction verification](https://developer.flutterwave.com/v3.0/docs/transaction-verification)
  describe verifying status, amount, currency and reference before confirming orders.
- [Stripe: Webhooks](https://docs.stripe.com/webhooks?lang=node)
  documents duplicate events and lack of event ordering guarantees.
