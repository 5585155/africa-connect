import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isSupabaseConfigured, supabase, supabaseUrl } from '../lib/supabase'
import { normalizeRole } from '../lib/supabaseMappers'
import type { AuthUser, Role } from '../types'

/**
 * Logs enough context to diagnose a failed Supabase Auth call without ever
 * logging the anon key or password. `supabaseUrl` is safe to log — it's a
 * public project URL, not a secret — and is the first thing to check: this
 * exact error shows up whenever it has a trailing slash or an extra path
 * segment on it (see src/lib/supabase.ts for the sanitization/validation).
 */
function logAuthError(action: 'signUp' | 'signIn', error: { message: string; status?: number }) {
  console.error(`[AuthContext] ${action} failed`, {
    message: error.message,
    status: error.status,
    supabaseUrl,
  })
  if (/invalid path/i.test(error.message)) {
    console.error(
      '[AuthContext] This specific error means the request URL sent to Supabase was malformed — ' +
        `check VITE_SUPABASE_URL in your deployment's environment variables. Current sanitized value: "${supabaseUrl}". ` +
        'It must be exactly the project URL (e.g. "https://your-project-ref.supabase.co") with no trailing slash and no path.',
    )
  }
  if (/database error saving new user/i.test(error.message)) {
    console.error(
      '[AuthContext] This means the on_auth_user_created trigger (handle_new_user() in supabase/schema.sql) ' +
        'raised an exception while inserting into profiles, which rolled back the whole signup — Supabase Auth ' +
        "never exposes the underlying Postgres error to the client, so check your project's Supabase Dashboard → " +
        'Logs → Postgres Logs for the real error/code. Common causes: supabase/schema.sql (or an update to it) ' +
        'was never run against this project, or profiles.email already has a row for this address from an ' +
        'earlier failed attempt. Re-running supabase/schema.sql is safe and idempotent.',
    )
  }
}

interface SignUpParams {
  name: string
  email: string
  password: string
  role: Role
}

interface SignInParams {
  email: string
  password: string
  /** Used only in local mock mode, where there's no real per-account role to look up. */
  role?: Role
}

interface AuthResult {
  error?: string
  needsEmailConfirmation?: boolean
  /** The account's actual role, resolved after a successful sign-up/sign-in — use this for post-auth navigation. */
  role?: Role
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signUp: (params: SignUpParams) => Promise<AuthResult>
  signIn: (params: SignInParams) => Promise<AuthResult>
  /**
   * Switches the signed-in account's workspace between farmer and buyer.
   * This is a relabel, not a new account — a farmer's listings stay tied to
   * their id via `farmer_id` regardless of the account's current `role`
   * label, so nothing is lost switching back and forth (see ProtectedRoute,
   * which uses `role` purely as a navigation gate, not a data filter).
   */
  switchRole: (role: Role) => Promise<{ error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Local mock storage — no real password check, just remembers who you are ─
function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useLocalStorage<AuthUser | null>('ac-user', null)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: false,
      signUp: async ({ name, email, role }) => {
        setUser({ name: name.trim() || email.split('@')[0] || 'there', email, role })
        return { role }
      },
      signIn: async ({ email, role = 'buyer' }) => {
        setUser((prev) => ({ name: prev?.name || email.split('@')[0] || 'there', email, role }))
        return { role }
      },
      switchRole: async (role) => {
        setUser((prev) => (prev ? { ...prev, role } : prev))
        return {}
      },
      logout: () => setUser(null),
    }),
    [user, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Supabase Auth — real sign-up/sign-in backed by auth.users + profiles ───
/**
 * Read-only profile lookup used on session restore / sign-in — deliberately
 * never throws and never writes: a failed read here can't distinguish "no
 * row exists" from "a transient network/schema hiccup", so self-healing by
 * upserting (like ensureProfile does right after a fresh signUp, where we
 * actually know the intended name/role) would risk clobbering a real
 * profile with a guess. Worst case on failure: the session is still valid
 * and `user` is still set, just with a generic name/role fallback.
 */
async function fetchProfile(userId: string, email: string): Promise<AuthUser> {
  try {
    const { data, error } = await supabase!.from('profiles').select('full_name, role').eq('id', userId).single()
    if (error || !data) {
      console.error('[AuthContext] failed to load profile — falling back to a generic buyer profile', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      })
      return { id: userId, name: email.split('@')[0] ?? 'there', email, role: 'buyer' }
    }
    return { id: userId, name: data.full_name, email, role: normalizeRole(data.role) }
  } catch (error) {
    console.error('[AuthContext] profile lookup threw — falling back to a generic buyer profile', error)
    return { id: userId, name: email.split('@')[0] ?? 'there', email, role: 'buyer' }
  }
}

/** Postgres "check_violation" — the signal that a write's `role` value doesn't match this project's live constraint casing. */
const CHECK_VIOLATION = '23514'

function capitalizeRole(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * Updates `profiles.role` for the workspace switcher — tries the app's
 * canonical lowercase value first (matching supabase/schema.sql), and
 * retries capitalized on a check-constraint violation, so switching works
 * regardless of which casing this particular project's live constraint
 * actually enforces.
 */
async function updateProfileRole(userId: string, role: Role): Promise<{ error?: string }> {
  let { error } = await supabase!.from('profiles').update({ role }).eq('id', userId)

  if (error?.code === CHECK_VIOLATION) {
    ;({ error } = await supabase!.from('profiles').update({ role: capitalizeRole(role) }).eq('id', userId))
  }

  if (error) {
    console.error('[AuthContext] switchRole failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { error: error.message }
  }
  return {}
}

/**
 * Used right after signUp: reads the profile handle_new_user() should have
 * created, and — since that trigger can legitimately end up not writing a
 * row (its own exception handler in supabase/schema.sql swallows failures so
 * it never blocks account creation) — self-heals with a client-side upsert
 * if it's missing, via the "users can insert their own profile" RLS policy.
 * Logs the real Postgres error code/details/hint on failure, since this path
 * (unlike auth.signUp's own errors) gets the actual PostgREST error object.
 */
async function ensureProfile(userId: string, email: string, name: string, role: Role): Promise<AuthUser> {
  const { data: existing, error: selectError } = await supabase!
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (selectError) {
    console.error('[AuthContext] profile lookup failed after signUp', {
      code: selectError.code,
      message: selectError.message,
      details: selectError.details,
      hint: selectError.hint,
    })
  }

  if (existing) {
    return { id: userId, name: existing.full_name, email, role: normalizeRole(existing.role) }
  }

  console.warn('[AuthContext] no profile row found after signUp — the trigger may have failed; self-healing with a client-side upsert')
  const fallbackName = name.trim() || email.split('@')[0] || 'there'

  try {
    let { data: upserted, error: upsertError } = await supabase!
      .from('profiles')
      .upsert({ id: userId, email, full_name: fallbackName, role }, { onConflict: 'id' })
      .select('full_name, role')
      .single()

    if (upsertError?.code === CHECK_VIOLATION) {
      // This project's live check constraint wants the other casing (see
      // normalizeRole's doc comment) — retry once before giving up.
      ;({ data: upserted, error: upsertError } = await supabase!
        .from('profiles')
        .upsert({ id: userId, email, full_name: fallbackName, role: capitalizeRole(role) }, { onConflict: 'id' })
        .select('full_name, role')
        .single())
    }

    if (upsertError || !upserted) {
      console.error('[AuthContext] fallback profile upsert failed', {
        code: upsertError?.code,
        message: upsertError?.message,
        details: upsertError?.details,
        hint: upsertError?.hint,
      })
      return { id: userId, name: fallbackName, email, role }
    }

    return { id: userId, name: upserted.full_name, email, role: normalizeRole(upserted.role) }
  } catch (error) {
    console.error('[AuthContext] fallback profile upsert threw', error)
    return { id: userId, name: fallbackName, email, role }
  }
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase!.auth.getSession().then(async ({ data }) => {
      const session = data.session
      if (!session?.user) {
        if (!cancelled) setLoading(false)
        return
      }
      const profile = await fetchProfile(session.user.id, session.user.email ?? '')
      if (!cancelled) {
        setUser(profile)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase!.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null)
        return
      }
      const profile = await fetchProfile(session.user.id, session.user.email ?? '')
      setUser(profile)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signUp: async ({ name, email, password, role }) => {
        const { data, error } = await supabase!.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, role },
            // Explicit, guaranteed-valid absolute URL — never build this by
            // concatenating strings, and don't rely on whatever Site URL
            // happens to be configured in the Supabase dashboard.
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) {
          logAuthError('signUp', error)
          return { error: error.message }
        }
        if (data.session && data.user) {
          const profile = await ensureProfile(data.user.id, email, name, role)
          setUser(profile)
          return { role: profile.role }
        }
        return { needsEmailConfirmation: true }
      },
      signIn: async ({ email, password }) => {
        const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) {
          logAuthError('signIn', error)
          return { error: error.message }
        }
        if (!data.user) return {}
        const profile = await fetchProfile(data.user.id, email)
        setUser(profile)
        return { role: profile.role }
      },
      switchRole: async (role) => {
        if (!user?.id) return { error: 'You need to be signed in to switch workspaces.' }
        const result = await updateProfileRole(user.id, role)
        if (!result.error) setUser((prev) => (prev ? { ...prev, role } : prev))
        return result
      },
      logout: () => {
        supabase!.auth.signOut()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return isSupabaseConfigured ? (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  ) : (
    <LocalAuthProvider>{children}</LocalAuthProvider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
