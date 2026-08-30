import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

interface WatchlistContextValue {
  savedIds: string[]
  isSaved: (id: string) => boolean
  toggleSaved: (id: string) => void
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null)

export function WatchlistProvider({ children }: { children: ReactNode }) {
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

export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider')
  return ctx
}
