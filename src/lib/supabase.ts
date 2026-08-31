import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Two common copy-paste mistakes from the Supabase dashboard both cause the
// same "Invalid path specified in request URL" error from Supabase's
// gateway, because supabase-js appends its own "/auth/v1/..." path onto
// whatever we hand it here:
//   1. A trailing slash/whitespace (e.g. "https://xyz.supabase.co/" or a
//      stray newline from pasting into an env var UI) → double slash.
//   2. Pasting a URL that already has a path (e.g. the REST endpoint
//      "https://xyz.supabase.co/rest/v1" instead of the bare project URL).
// (1) is fixed by sanitizing below; (2) can't be fixed programmatically —
// it's the wrong value — but is validated and logged clearly further down.
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
export const supabaseUrl = rawSupabaseUrl.trim().replace(/\/+$/, '')
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/**
 * True when both Supabase env vars are present. The app is designed to run
 * fully on local mock storage (see src/hooks/useLocalStorage.ts) when this is
 * false — every context checks this flag and falls back cleanly, so the app
 * works out of the box with zero configuration.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (isSupabaseConfigured) {
  try {
    const parsed = new URL(supabaseUrl)
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      console.error(
        `[Africa Connect] VITE_SUPABASE_URL looks malformed: "${supabaseUrl}" has a path ("${parsed.pathname}") ` +
          'in it. It should be just the project URL with nothing after the host, e.g. ' +
          '"https://your-project-ref.supabase.co" — not the REST/auth endpoint. Using a URL with a path here is ' +
          'what produces "Invalid path specified in request URL" errors on every auth/database call.',
      )
    }
  } catch {
    console.error(
      `[Africa Connect] VITE_SUPABASE_URL is not a valid absolute URL: "${supabaseUrl}". ` +
        'It must start with https:// and contain only the project host, e.g. "https://your-project-ref.supabase.co".',
    )
  }
} else {
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

export const supabase: SupabaseClient | null =
  isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null
