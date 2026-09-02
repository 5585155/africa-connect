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
/**
 * Fetches crop_listings and merges in each farmer's public identity as two
 * separate queries, for both anonymous and authenticated callers alike —
 * used to rely on an embedded `.select('*, profiles(full_name)')` join for
 * authenticated requests, on the theory that `profiles`' `to authenticated`
 * RLS policy would let it resolve cleanly there. In production that embed
 * came back empty for at least one real farmer session despite `profiles`
 * being fully readable to them, which is exactly the kind of PostgREST
 * embedding fragility `profiles_public` was already introduced to route
 * around for anonymous requests — so it's now the only path, for everyone.
 * `profiles_public` (id, full_name, avatar_url only — no role/email/phone)
 * is readable by both `anon` and `authenticated`, so this needs no branch.
 */
async function loadListingsWithPublicProfiles(): Promise<{ data: CropListingRow[] | null; error: unknown }> {
  const { data: rows, error } = await supabase!
    .from('crop_listings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !rows) {
    console.error('[CropContext] failed to load crop_listings', error)
    return { data: null, error }
  }

  const farmerIds = [...new Set(rows.map((r) => r.farmer_id).filter((id): id is string => Boolean(id)))]

  // A farmer-profile lookup failure must never take the listing feed down
  // with it — every row survives regardless, just with its farmer identity
  // (and rowToListing's "Unknown Farmer" fallback) left unresolved.
  let farmerById = new Map<string, { full_name: string; avatar_url: string | null }>()
  if (farmerIds.length > 0) {
    const { data: farmers, error: farmersError } = await supabase!
      .from('profiles_public')
      .select('id, full_name, avatar_url')
      .in('id', farmerIds)

    if (farmersError) {
      console.error('[CropContext] failed to load public farmer profiles', farmersError)
    } else {
      farmerById = new Map((farmers ?? []).map((f) => [f.id as string, f]))
    }
  }

  // `...row` preserves farmer_id (and every other raw column) untouched —
  // only `profiles` is added/overwritten with the resolved-or-null identity.
  const merged: CropListingRow[] = rows.map((row) => {
    const farmer = row.farmer_id ? farmerById.get(row.farmer_id) : undefined
    return { ...row, profiles: farmer ? { full_name: farmer.full_name, avatar_url: farmer.avatar_url } : null }
  })

  return { data: merged, error: null }
}

function SupabaseCropProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [listings, setListings] = useState<SellerListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await loadListingsWithPublicProfiles()

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
  }, [user])

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
