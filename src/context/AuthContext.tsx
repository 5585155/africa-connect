import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { AuthUser, Role } from '../types'

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
      logout: () => setUser(null),
    }),
    [user, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Supabase Auth — real sign-up/sign-in backed by auth.users + profiles ───
async function fetchProfile(userId: string, email: string): Promise<AuthUser> {
  const { data, error } = await supabase!.from('profiles').select('full_name, role').eq('id', userId).single()
  if (error || !data) {
    console.error('[AuthContext] failed to load profile', error)
    return { id: userId, name: email.split('@')[0] ?? 'there', email, role: 'buyer' }
  }
  return { id: userId, name: data.full_name, email, role: data.role as Role }
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
          options: { data: { full_name: name, role } },
        })
        if (error) return { error: error.message }
        if (data.session && data.user) {
          const profile = await fetchProfile(data.user.id, email)
          setUser(profile)
          return { role: profile.role }
        }
        return { needsEmailConfirmation: true }
      },
      signIn: async ({ email, password }) => {
        const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) return { error: error.message }
        if (!data.user) return {}
        const profile = await fetchProfile(data.user.id, email)
        setUser(profile)
        return { role: profile.role }
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
