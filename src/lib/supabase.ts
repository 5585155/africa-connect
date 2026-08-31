import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// A trailing slash (e.g. pasted straight from the Supabase dashboard as
// "https://xyz.supabase.co/") makes supabase-js build request URLs with a
// double slash before the API path — some proxies/CDNs reject that with
// "Invalid path specified in request URL". Trim it before it ever reaches createClient.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when both Supabase env vars are present. The app is designed to run
 * fully on local mock storage (see src/hooks/useLocalStorage.ts) when this is
 * false — every context checks this flag and falls back cleanly, so the app
 * works out of the box with zero configuration.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

if (!isSupabaseConfigured) {
  // Local mock storage is the expected, zero-config path in development. In a
  // production build this almost certainly means the deploy is missing its
  // Supabase env vars (see .env.production), so it's worth a louder warning —
  // the app still works, but every "user" on that deployment gets their own
  // isolated browser storage instead of a shared database.
  const log = import.meta.env.PROD ? console.warn : console.info
  log(
    '[Africa Connect] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — running on local mock storage. ' +
      'See .env.production to connect a real Supabase project.',
  )
}
