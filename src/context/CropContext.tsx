import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CROPS } from '../data/crops'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { listingToRow, rowToListing, type CropListingRow } from '../lib/supabaseMappers'
import type { ListingStatus, SellerListing } from '../types'
import { useAuth } from './AuthContext'

const SEED_LISTINGS: SellerListing[] = CROPS.map((crop) => ({ ...crop, status: 'Available' }))

interface CropContextValue {
  listings: SellerListing[]
  loading: boolean
  addListing: (listing: SellerListing) => void
  updateListing: (id: string, patch: Partial<SellerListing>) => void
  updateStatus: (id: string, status: ListingStatus) => void
  deleteListing: (id: string) => void
}

const CropContext = createContext<CropContextValue | null>(null)

// ── Local mock storage (default — no Supabase project configured) ─────────
function LocalCropProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useLocalStorage<SellerListing[]>('ac-crop-listings', SEED_LISTINGS)

  const value = useMemo<CropContextValue>(
    () => ({
      listings,
      loading: false,
      addListing: (listing) => setListings((prev) => [listing, ...prev]),
      updateListing: (id, patch) => setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))),
      updateStatus: (id, status) => setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l))),
      deleteListing: (id) => setListings((prev) => prev.filter((l) => l.id !== id)),
    }),
    [listings, setListings],
  )

  return <CropContext.Provider value={value}>{children}</CropContext.Provider>
}

// ── Supabase-backed, with realtime sync across devices ─────────────────────
function SupabaseCropProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [listings, setListings] = useState<SellerListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase!
        .from('crop_listings')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })

      console.log('[Marketplace] Query result:', { data, error })

      if (!cancelled) {
        if (error) console.error('[CropContext] failed to load listings', error)
        setListings((data as unknown as CropListingRow[] | null)?.map(rowToListing) ?? [])
        setLoading(false)
      }
    }
    load()

    const channel = supabase!
      .channel('crop_listings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crop_listings' }, () => {
        // Re-fetch on any change so the farmer-name join stays correct — the
        // catalog is small enough that this is cheap and keeps mapping in one place.
        load()
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase!.removeChannel(channel)
    }
  }, [])

  const addListing = useCallback(
    (listing: SellerListing) => {
      if (!user?.id) return
      supabase!
        .from('crop_listings')
        .insert(listingToRow(listing, user.id))
        .then(({ error }) => error && console.error('[CropContext] addListing failed', error))
    },
    [user],
  )

  const updateListing = useCallback((id: string, patch: Partial<SellerListing>) => {
    const row: Record<string, unknown> = {}
    if (patch.cropName !== undefined) row.crop_name = patch.cropName
    if (patch.category !== undefined) row.category = patch.category
    if (patch.originCountry !== undefined) row.location = patch.originCountry
    if (patch.availableQuantity !== undefined) row.available_tons = patch.availableQuantity
    if (patch.unitPriceUSD !== undefined) row.unit_price_usd = patch.unitPriceUSD
    if (patch.certifications !== undefined) row.certifications = patch.certifications
    if (patch.image !== undefined) row.image_url = patch.image
    if (patch.harvestDate !== undefined) row.harvest_date = patch.harvestDate || null
    if (patch.status !== undefined) row.status = patch.status

    supabase!
      .from('crop_listings')
      .update(row)
      .eq('id', id)
      .then(({ error }) => error && console.error('[CropContext] updateListing failed', error))
  }, [])

  const updateStatus = useCallback((id: string, status: ListingStatus) => {
    supabase!
      .from('crop_listings')
      .update({ status })
      .eq('id', id)
      .then(({ error }) => error && console.error('[CropContext] updateStatus failed', error))
  }, [])

  const deleteListing = useCallback((id: string) => {
    supabase!
      .from('crop_listings')
      .delete()
      .eq('id', id)
      .then(({ error }) => error && console.error('[CropContext] deleteListing failed', error))
  }, [])

  const value = useMemo<CropContextValue>(
    () => ({ listings, loading, addListing, updateListing, updateStatus, deleteListing }),
    [listings, loading, addListing, updateListing, updateStatus, deleteListing],
  )

  return <CropContext.Provider value={value}>{children}</CropContext.Provider>
}

export function CropProvider({ children }: { children: ReactNode }) {
  return isSupabaseConfigured ? (
    <SupabaseCropProvider>{children}</SupabaseCropProvider>
  ) : (
    <LocalCropProvider>{children}</LocalCropProvider>
  )
}

export function useCrops() {
  const ctx = useContext(CropContext)
  if (!ctx) throw new Error('useCrops must be used within CropProvider')
  return ctx
}
