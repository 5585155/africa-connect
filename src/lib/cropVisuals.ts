import type { CropCategory } from '../types'

/**
 * Crop-specific emoji, keyed by lowercased crop name — checked before the
 * category fallback below so common crops (which make up most listings)
 * get a recognizable icon instead of every listing on the Marketplace
 * showing the same generic seedling.
 */
const CROP_NAME_ICONS: Record<string, string> = {
  maize: '🌽',
  corn: '🌽',
  coffee: '☕',
  cocoa: '🍫',
  cassava: '🥔',
  rice: '🌾',
  avocado: '🥑',
  wheat: '🌾',
  sorghum: '🌾',
  millet: '🌾',
  banana: '🍌',
  plantain: '🍌',
  mango: '🥭',
  pineapple: '🍍',
  cashew: '🌰',
  groundnut: '🥜',
  peanut: '🥜',
  'cotton': '🧵',
  tea: '🍵',
  sesame: '🫘',
  beans: '🫘',
  yam: '🍠',
  'sweet potato': '🍠',
  pepper: '🌶️',
  chili: '🌶️',
  chilli: '🌶️',
  ginger: '🫚',
}

const CATEGORY_ICONS: Record<CropCategory, string> = {
  Grains: '🌾',
  'Cocoa & Coffee': '☕',
  Fruits: '🍉',
  Oilseeds: '🥜',
  Tubers: '🍠',
  Nuts: '🌰',
  Legumes: '🫘',
  Fiber: '🧵',
}

/**
 * Best-effort icon for a listing that has no farmer-uploaded photo (data:
 * URL) — matches by crop name first, falling back to the crop's category,
 * so the Marketplace grid doesn't render every unphotographed listing with
 * the same generic seedling regardless of what it actually is.
 */
export function cropFallbackIcon(cropName: string, category: CropCategory): string {
  const normalized = cropName.trim().toLowerCase()
  for (const [name, icon] of Object.entries(CROP_NAME_ICONS)) {
    if (normalized.includes(name)) return icon
  }
  return CATEGORY_ICONS[category] ?? '🌱'
}

/**
 * True for a listing `image` value that's an actual renderable image source
 * — a farmer-uploaded photo (data: URL), a browser object URL, or a seeded
 * remote photo (http(s):) — as opposed to a placeholder emoji string. Only
 * matching `data:` here (the original check) silently dropped every seeded
 * https:// crop photo back to the emoji fallback, since a bare emoji string
 * also fails `startsWith('data:')` but so does a real https:// URL.
 *
 * data: URLs are deliberately restricted to ordinary raster formats
 * (png/jpeg/gif/webp/avif) rather than accepting any `data:image/...` blob —
 * `handleImageChange`'s `reader.readAsDataURL(file)` only ever produces
 * these, and excluding `data:image/svg+xml` here avoids rendering
 * user-suppliable inline SVG markup as an <img> src.
 */
export function isImageSource(image: string): boolean {
  return /^(https?:\/\/|blob:|data:image\/(png|jpe?g|gif|webp|avif);)/i.test(image.trim())
}
