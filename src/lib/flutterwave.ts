export const flutterwavePublicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY
export const isFlutterwaveConfigured = Boolean(flutterwavePublicKey)

interface FlutterwaveCustomer {
  email: string
  name: string
  phone_number?: string
}

interface FlutterwaveCustomizations {
  title?: string
  description?: string
}

interface FlutterwaveConfig {
  public_key: string
  tx_ref: string
  amount: number
  currency: string
  payment_options?: string
  customer: FlutterwaveCustomer
  customizations?: FlutterwaveCustomizations
  /** Echoed back verbatim in the webhook payload — used to carry our own order id through. */
  meta?: Record<string, unknown>
  callback: (response: FlutterwaveResponse) => void
  onclose: () => void
}

export interface FlutterwaveResponse {
  status: string
  transaction_id?: number
  tx_ref?: string
  flw_ref?: string
  amount?: number
  currency?: string
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: FlutterwaveConfig) => void
  }
}

const SCRIPT_SRC = 'https://checkout.flutterwave.com/v3.js'
let scriptPromise: Promise<void> | null = null

function loadFlutterwaveScript(): Promise<void> {
  if (window.FlutterwaveCheckout) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load the Flutterwave checkout script'))
    document.body.appendChild(script)
  })
  return scriptPromise
}

export interface OpenFlutterwaveParams {
  amount: number
  currency: string
  email: string
  name: string
  title: string
  description: string
  /** Our order id — sent as `meta.order_id` so api/flutterwave-webhook.ts can match the charge back to it. */
  orderId: string
}

/** Opens Flutterwave's real inline checkout modal. Resolves with the response on success, or null if the buyer closed it without paying. */
export async function openFlutterwaveCheckout(params: OpenFlutterwaveParams): Promise<FlutterwaveResponse | null> {
  if (!flutterwavePublicKey) throw new Error('Flutterwave is not configured')

  await loadFlutterwaveScript()
  if (!window.FlutterwaveCheckout) throw new Error('Flutterwave checkout script failed to initialize')

  return new Promise((resolve) => {
    let settled = false
    window.FlutterwaveCheckout!({
      public_key: flutterwavePublicKey,
      tx_ref: `ac-${Date.now()}`,
      amount: params.amount,
      currency: params.currency,
      payment_options: 'card,mobilemoney,ussd,banktransfer',
      customer: { email: params.email, name: params.name },
      customizations: { title: params.title, description: params.description },
      meta: { order_id: params.orderId },
      callback: (response) => {
        settled = true
        resolve(response)
      },
      onclose: () => {
        if (!settled) resolve(null)
      },
    })
  })
}
