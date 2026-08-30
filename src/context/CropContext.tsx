import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { CROPS } from '../data/crops'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { ListingStatus, SellerListing } from '../types'

const SEED_LISTINGS: SellerListing[] = CROPS.map((crop) => ({ ...crop, status: 'Available' }))

interface CropContextValue {
  listings: SellerListing[]
  addListing: (listing: SellerListing) => void
  updateListing: (id: string, patch: Partial<SellerListing>) => void
  updateStatus: (id: string, status: ListingStatus) => void
  deleteListing: (id: string) => void
}

const CropContext = createContext<CropContextValue | null>(null)

export function CropProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useLocalStorage<SellerListing[]>('ac-crop-listings', SEED_LISTINGS)

  const value = useMemo<CropContextValue>(
    () => ({
      listings,
      addListing: (listing) => setListings((prev) => [listing, ...prev]),
      updateListing: (id, patch) => setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))),
      updateStatus: (id, status) => setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l))),
      deleteListing: (id) => setListings((prev) => prev.filter((l) => l.id !== id)),
    }),
    [listings, setListings],
  )

  return <CropContext.Provider value={value}>{children}</CropContext.Provider>
}

export function useCrops() {
  const ctx = useContext(CropContext)
  if (!ctx) throw new Error('useCrops must be used within CropProvider')
  return ctx
}
