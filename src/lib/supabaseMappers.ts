import type { CropCategory, ListingStatus, Order, OrderStatus, SellerListing } from '../types'

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
    status: row.status as ListingStatus,
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
    createdAt: new Date(row.created_at).getTime(),
  }
}
