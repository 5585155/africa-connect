import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

/**
 * Server-only Supabase client authenticated with the service role key, which
 * bypasses Row Level Security. A webhook has no buyer/farmer session to
 * authenticate as — the RLS policies in supabase/schema.sql only let a
 * participant read/update their own orders, so this is required to write the
 * result of a payment event at all.
 *
 * Never import this from `src/` — it must only run server-side inside
 * `api/*.ts`, and SUPABASE_SERVICE_ROLE_KEY must never be prefixed with
 * VITE_ or it would be bundled into the client app.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  if (!cachedClient) {
    cachedClient = createClient(url, serviceKey, { auth: { persistSession: false } })
  }
  return cachedClient
}
