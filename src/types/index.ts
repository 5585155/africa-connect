export type Currency = 'USD' | 'EUR' | 'KES' | 'NGN'

export type Language = 'en' | 'fr' | 'sw' | 'pcm'

export type Role = 'farmer' | 'buyer'

export const CURRENCIES: { code: Currency; label: string }[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
]

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'pcm', label: 'Pidgin' },
]

export type CropCategory =
  | 'Grains'
  | 'Cocoa & Coffee'
  | 'Fruits'
  | 'Oilseeds'
  | 'Tubers'
  | 'Nuts'
  | 'Legumes'
  | 'Fiber'

export interface CropListing {
  id: string
  cropName: string
  category: CropCategory
  originCountry: string
  availableQuantity: number
  unitPriceUSD: number
  farmerName: string
  verifiedStatus: boolean
  harvestDate: string
  image: string
  certifications: string[]
  /** Regulatory / export clearance required before this listing can ship, e.g. "Requires COCOBOD Clearing" or "Requires NCPB Export Permit". */
  complianceNote?: string
  /** True for products whose export is legally restricted to a state-approved board or licensed aggregator (e.g. Ghanaian cocoa via COCOBOD). */
  exportMonopoly?: boolean
}

export interface AuthUser {
  name: string
  email: string
  role: Role
}

export type ListingStatus = 'Available' | 'Sold Out' | 'In Transit'

export interface SellerListing extends CropListing {
  status: ListingStatus
}

export type OrderStatus = 'Inquiry Sent' | 'Escrow Funded' | 'Logistics Scheduled' | 'Delivered & Released'

export const ORDER_STAGES: OrderStatus[] = [
  'Inquiry Sent',
  'Escrow Funded',
  'Logistics Scheduled',
  'Delivered & Released',
]

export interface Order {
  id: string
  threadId: string
  listingId: string
  cropName: string
  farmerName: string
  buyerName: string
  quantity: number
  unitPriceUSD: number
  logisticsUSD: number
  escrowFeeUSD: number
  totalUSD: number
  status: OrderStatus
  createdAt: number
}
