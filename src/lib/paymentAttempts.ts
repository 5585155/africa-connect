import { supabase } from './supabase'
import type { PaymentMethod } from '../components/EscrowPaymentModal'

export interface PaymentAttempt {
  paymentAttemptId: string
  amount: number
  currency: string
}

/**
 * Asks api/create-payment-attempt.ts for the server-authoritative amount to
 * charge for this order, in this currency, via this provider. Only callable
 * against a real Supabase project — there is no server to call in local mock
 * mode, so EscrowPaymentModal skips this entirely there and keeps the
 * existing client-only simulation.
 */
export async function createPaymentAttempt(
  orderId: string,
  provider: PaymentMethod,
  currency: string,
): Promise<PaymentAttempt> {
  const { data: session } = await supabase!.auth.getSession()
  const token = session?.session?.access_token
  if (!token) throw new Error('You need to be signed in to start a payment.')

  const response = await fetch('/api/create-payment-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId, provider, currency }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.error || 'Could not start this payment. Please try again.')
  }
  return body as PaymentAttempt
}
