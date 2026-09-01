import type { CropCategory, ListingStatus, Order, OrderStatus, SellerListing } from '../types'

/**
 * True for PostgREST errors caused by a query referencing a column or
 * embedded relationship that doesn't exist on the live database — e.g. an
 * `.order('created_at', ...)` against a table whose live schema has drifted
 * from `supabase/schema.sql` and never got that column, or a `!fk_name`
 * embed alias that doesn't match the live foreign key's actual name.
 * Callers use this to retry with a plain, unordered `select('*')` instead of
 * leaving a whole context permanently empty over one missing column.
 */
export function isSchemaMismatchError(error: { code?: string } | null | undefined): boolean {
  if (!error?.code) return false
  // 42703 = Postgres "undefined_column"; PGRST200/201/204 = PostgREST couldn't
  // resolve an embedded relationship or requested column.
  return ['42703', 'PGRST200', 'PGRST201', 'PGRST204'].includes(error.code)
}

/**
 * Normalizes a live `crop_listings.status` value into the app's canonical
 * `ListingStatus`. Seeded/imported rows aren't guaranteed to use the app's
 * exact casing/wording (e.g. `'active'` instead of `'Available'`) — match
 * common variants case-insensitively, and default anything unrecognized (or
 * missing) to `'Available'` rather than let an unknown string leak into the
 * UI and silently disable actions that check `status === 'Sold Out'`.
 */
function normalizeListingStatus(raw: string | null | undefined): ListingStatus {
  const value = (raw ?? '').trim().toLowerCase()
  if (['sold out', 'sold_out', 'soldout', 'sold-out', 'unavailable'].includes(value)) return 'Sold Out'
  if (['in transit', 'in_transit', 'intransit', 'in-transit', 'shipping', 'pending'].includes(value)) {
    return 'In Transit'
  }
  return 'Available'
}

/** Shape of a `crop_listings` row, optionally joined with the owning farmer's profile. */
export interface CropListingRow {
  id: string
  crop_name: string
  category: string
  location: string
  available_tons: number
  unit_price_usd: number
  farmer_id: string | null
  certifications: string[] | null
  compliance_note: string | null
  export_monopoly: boolean
  status: string
  verified: boolean
  image_url: string | null
  harvest_date: string | null
  profiles?: { full_name: string } | null
}

export function rowToListing(row: CropListingRow): SellerListing {
  return {
    id: row.id,
    cropName: row.crop_name,
    category: row.category as CropCategory,
    originCountry: row.location,
    availableQuantity: Number(row.available_tons),
    unitPriceUSD: Number(row.unit_price_usd),
    farmerName: row.profiles?.full_name ?? 'Unknown Farmer',
    farmerId: row.farmer_id ?? undefined,
    verifiedStatus: row.verified,
    harvestDate: row.harvest_date ?? '',
    image: row.image_url ?? '🌱',
    certifications: row.certifications ?? [],
    complianceNote: row.compliance_note ?? undefined,
    exportMonopoly: row.export_monopoly,
    status: normalizeListingStatus(row.status),
  }
}

export function listingToRow(listing: SellerListing, farmerId: string) {
  return {
    title: listing.cropName,
    crop_name: listing.cropName,
    category: listing.category,
    location: listing.originCountry,
    available_tons: listing.availableQuantity,
    unit_price_usd: listing.unitPriceUSD,
    farmer_id: farmerId,
    certifications: listing.certifications,
    compliance_note: listing.complianceNote ?? null,
    export_monopoly: listing.exportMonopoly ?? false,
    status: listing.status,
    verified: listing.verifiedStatus,
    image_url: listing.image,
    harvest_date: listing.harvestDate || null,
  }
}

/** Shape of an `orders` row, optionally joined with crop name and both parties' profiles. */
export interface OrderRow {
  id: string
  conversation_id: string | null
  buyer_id: string
  farmer_id: string
  crop_id: string | null
  quantity_tons: number
  unit_price_usd: number
  logistics_usd: number
  escrow_fee_usd: number
  total_amount: number
  escrow_status: string
  receipt_reference: string | null
  created_at: string
  crop_listings?: { crop_name: string } | null
  buyer?: { full_name: string } | null
  farmer?: { full_name: string } | null
}

export function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    threadId: row.conversation_id ?? '',
    listingId: row.crop_id ?? '',
    cropName: row.crop_listings?.crop_name ?? 'Listing',
    farmerName: row.farmer?.full_name ?? 'Farmer',
    buyerName: row.buyer?.full_name ?? 'Buyer',
    farmerId: row.farmer_id,
    buyerId: row.buyer_id,
    quantity: Number(row.quantity_tons),
    unitPriceUSD: Number(row.unit_price_usd),
    logisticsUSD: Number(row.logistics_usd),
    escrowFeeUSD: Number(row.escrow_fee_usd),
    totalUSD: Number(row.total_amount),
    status: row.escrow_status as OrderStatus,
    receiptReference: row.receipt_reference ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  }
}
