import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
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

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.info(
    '[Africa Connect] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — running on local mock storage. ' +
      'See .env.example to connect a real Supabase project.',
  )
}
