/**
 * Emergency containment — 2026-09-03.
 *
 * Production's `orders` table lost all four write (INSERT/UPDATE) RLS
 * policies during an unrelated diagnostic session, leaving only the two
 * SELECT policies. Every write path to `orders` — new order creation,
 * escrow funding, lifecycle advancement — is now either hard-blocked by
 * RLS, or (worse) silently no-ops while the UI still reports success.
 *
 * This flag gates every one of those entry points until the *replacement*
 * write policies (see PAYMENT_SECURITY_AUDIT.md's implementation plan) are
 * deliberately designed and verified — not until the old, unrestricted
 * policies are simply re-added, which had no financial-field or
 * lifecycle restriction in the first place and is exactly what led here.
 *
 * This is a code-level containment only, and a genuinely limited one. It
 * does nothing for: a browser tab that already has an OLDER build of this
 * file loaded in memory — that tab's JavaScript never calls these guard
 * functions at all, because they didn't exist in whatever it already
 * loaded, so no client-side flag can retroactively affect it; a
 * payment-provider checkout window already open before this ships; or
 * direct access to a payment provider outside this app. Closing those
 * requires provider-side action, which is separately scoped, requires its
 * own approval, and is not part of this change.
 */
export const ORDER_WRITES_CONTAINED = true

/**
 * Shown wherever a new order-affecting action is blocked outright — Fund
 * Escrow, Request Quote, or advancing an order's lifecycle stage. Says only
 * what's actually true: the action itself is unavailable, and viewing
 * existing orders / using existing conversations still works. Does not
 * claim existing data is wholly unaffected beyond that, and does not
 * promise anyone will act on this automatically.
 */
export const BLOCKED_ACTION_NOTICE =
  'New orders, payments and order-status changes are temporarily unavailable. You can still view existing orders and use existing conversations.'

/**
 * Shown specifically when a payment-provider confirmation callback fires
 * while contained (e.g. a checkout that was already open within this same
 * page load before the entry-point guard ran). Deliberately does not claim
 * the payment failed, succeeded, or will be reconciled automatically — the
 * app genuinely cannot tell from here. Stays local to the viewer's own UI;
 * nothing is posted into the shared conversation on this path.
 */
export const LATE_CALLBACK_NOTICE =
  "We cannot confirm this payment's status here. Do not pay again. Keep your payment reference and contact support."

interface Guard {
  allowed: boolean
  message?: string
}

const ALLOWED: Guard = { allowed: true }

/**
 * Call FIRST in any handler that would open a real payment-provider
 * checkout or start the sandbox simulation timer — before any provider SDK
 * call — and stop if `allowed` is false.
 */
export function guardPaymentStart(): Guard {
  return ORDER_WRITES_CONTAINED ? { allowed: false, message: BLOCKED_ACTION_NOTICE } : ALLOWED
}

/**
 * Call FIRST in a payment-provider confirmation callback (onConfirm /
 * onSuccess). This can still be reached even when the entry point that
 * opened checkout was itself gated — e.g. a modal instance that was
 * already open within the same page load before this guard ran. It does
 * NOT protect a tab running an older build of this file; see the module
 * doc comment above. When not allowed: never call fundEscrow, never
 * report success or failure, and never post anything to the shared
 * conversation.
 */
export function guardPaymentConfirm(): Guard {
  return ORDER_WRITES_CONTAINED ? { allowed: false, message: LATE_CALLBACK_NOTICE } : ALLOWED
}

/** Call FIRST when starting a brand-new Request Quote (a new conversation + linked order). */
export function guardNewOrder(): Guard {
  return ORDER_WRITES_CONTAINED ? { allowed: false, message: BLOCKED_ACTION_NOTICE } : ALLOWED
}

/** Call FIRST when advancing an order's lifecycle stage. */
export function guardOrderAdvance(): Guard {
  return ORDER_WRITES_CONTAINED ? { allowed: false, message: BLOCKED_ACTION_NOTICE } : ALLOWED
}
