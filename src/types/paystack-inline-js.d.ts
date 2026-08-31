// @paystack/inline-js ships no TypeScript types (no `types`/`typings` field,
// no .d.ts in its package). This declares only the surface PaystackButton.tsx
// actually uses — see node_modules/@paystack/inline-js/README.md for the
// full API if more of it is needed later.
declare module '@paystack/inline-js' {
  export interface PaystackTransaction {
    id: string
    reference: string
    message: string
  }

  export interface PaystackError {
    message: string
  }

  export interface PaystackMetadata {
    [key: string]: unknown
    custom_fields?: Array<{ display_name: string; variable_name: string; value: string }>
  }

  export interface PaystackNewTransactionOptions {
    key: string
    email: string
    /** Amount in the currency's smallest unit (kobo/cents), not main units. */
    amount: number
    currency?: string
    reference?: string
    metadata?: PaystackMetadata
    onSuccess?: (transaction: PaystackTransaction) => void
    onCancel?: () => void
    onError?: (error: PaystackError) => void
    onLoad?: (transaction: PaystackTransaction) => void
  }

  export default class PaystackPop {
    constructor()
    newTransaction(options: PaystackNewTransactionOptions): unknown
  }
}
