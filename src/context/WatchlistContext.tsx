import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface WatchlistContextValue {
  savedIds: string[]
  isSaved: (id: string) => boolean
  toggleSaved: (id: string) => void
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null)

// ── Local mock storage ─────────────────────────────────────────────────────
function LocalWatchlistProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useLocalStorage<string[]>('ac-watchlist', [])

  const value = useMemo<WatchlistContextValue>(
    () => ({
      savedIds,
      isSaved: (id) => savedIds.includes(id),
      toggleSaved: (id) =>
        setSavedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id])),
    }),
    [savedIds, setSavedIds],
  )

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
}

// ── Supabase-backed, scoped to the signed-in buyer ─────────────────────────
function SupabaseWatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [savedIds, setSavedIds] = useState<string[]>([])

  useEffect(() => {
    if (!user?.id) {
      setSavedIds([])
      return
    }

    let cancelled = false

    async function load() {
      const { data, error } = await supabase!.from('watchlist').select('crop_id').eq('user_id', user!.id)
      if (!cancelled) {
        if (error) console.error('[WatchlistContext] failed to load watchlist', error)
        setSavedIds(data?.map((row) => row.crop_id) ?? [])
      }
    }
    load()

    const channel = supabase!
      .channel(`watchlist-changes-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watchlist', filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase!.removeChannel(channel)
    }
  }, [user?.id])

  const value = useMemo<WatchlistContextValue>(
    () => ({
      savedIds,
      isSaved: (id) => savedIds.includes(id),
      toggleSaved: (id) => {
        if (!user?.id) return
        if (savedIds.includes(id)) {
          supabase!
            .from('watchlist')
            .delete()
            .eq('user_id', user.id)
            .eq('crop_id', id)
            .then(({ error }) => error && console.error('[WatchlistContext] remove failed', error))
        } else {
          supabase!
            .from('watchlist')
            .insert({ user_id: user.id, crop_id: id })
            .then(({ error }) => error && console.error('[WatchlistContext] add failed', error))
        }
      },
    }),
    [savedIds, user],
  )

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  return isSupabaseConfigured ? (
    <SupabaseWatchlistProvider>{children}</SupabaseWatchlistProvider>
  ) : (
    <LocalWatchlistProvider>{children}</LocalWatchlistProvider>
  )
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider')
  return ctx
}
