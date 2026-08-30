import type { CropListing } from '../types'

export interface CropFilters {
  crop: string
  location: string
  category: string
  minPrice: number
  maxPrice: number
  minQuantity: number
  verifiedOnly: boolean
}

export const DEFAULT_FILTERS: CropFilters = {
  crop: '',
  location: '',
  category: 'All',
  minPrice: 0,
  maxPrice: 12000,
  minQuantity: 0,
  verifiedOnly: false,
}

export function filterCrops<T extends CropListing>(crops: T[], filters: Partial<CropFilters>): T[] {
  const f = { ...DEFAULT_FILTERS, ...filters }
  const crop = f.crop.trim().toLowerCase()
  const location = f.location.trim().toLowerCase()

  return crops.filter((listing) => {
    if (crop && !listing.cropName.toLowerCase().includes(crop) && !listing.category.toLowerCase().includes(crop)) {
      return false
    }
    if (location && !listing.originCountry.toLowerCase().includes(location)) {
      return false
    }
    if (f.category !== 'All' && listing.category !== f.category) {
      return false
    }
    if (listing.unitPriceUSD < f.minPrice || listing.unitPriceUSD > f.maxPrice) {
      return false
    }
    if (listing.availableQuantity < f.minQuantity) {
      return false
    }
    if (f.verifiedOnly && !listing.verifiedStatus) {
      return false
    }
    return true
  })
}
