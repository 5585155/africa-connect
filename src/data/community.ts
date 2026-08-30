export interface FarmerSpotlight {
  id: string
  name: string
  country: string
  crop: string
  quote: string
  verified: boolean
  avatar: string
}

export const FARMER_SPOTLIGHTS: FarmerSpotlight[] = [
  {
    id: 'spotlight-001',
    name: 'Wanjiru Kamau',
    country: 'Kenya',
    crop: 'White Maize',
    quote:
      'Africa Connect let me sell directly to buyers in Europe for the first time — no middlemen taking half my margin.',
    verified: true,
    avatar: '🌽',
  },
  {
    id: 'spotlight-002',
    name: 'Kwame Asante',
    country: 'Ghana',
    crop: 'Cocoa Beans',
    quote:
      'The escrow system meant I got paid the moment my cocoa cleared port inspection. That certainty changed how I plan my season.',
    verified: true,
    avatar: '🍫',
  },
  {
    id: 'spotlight-003',
    name: 'Bekele Tesfaye',
    country: 'Ethiopia',
    crop: 'Arabica Coffee',
    quote:
      'Buyers can see my organic certification right on my listing. It builds trust before we even talk.',
    verified: true,
    avatar: '☕',
  },
  {
    id: 'spotlight-004',
    name: 'Fatou Ndiaye',
    country: 'Senegal',
    crop: 'Groundnuts',
    quote:
      'I coordinate export logistics for three cooperatives now, all through the same dashboard.',
    verified: true,
    avatar: '🥜',
  },
]

export interface ForumPost {
  id: string
  title: string
  excerpt: string
  author: string
  tag: string
  replies: number
}

export const FORUM_TAGS = ['Soil Health', 'Cross-Border Logistics', 'Export Standards', 'Pricing'] as const

export const FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-001',
    title: 'Cover cropping between maize seasons — worth it?',
    excerpt: 'Trying legume cover crops to rebuild nitrogen after two maize harvests. Anyone tracked yield impact?',
    author: 'Wanjiru K.',
    tag: 'Soil Health',
    replies: 14,
  },
  {
    id: 'post-002',
    title: 'Customs clearance delays at Tema port',
    excerpt: 'Cocoa shipment held for extra documentation. Sharing what worked to clear it in 48 hours.',
    author: 'Kwame A.',
    tag: 'Cross-Border Logistics',
    replies: 22,
  },
  {
    id: 'post-003',
    title: 'GlobalGAP renewal checklist for 2026',
    excerpt: 'Walking through the updated audit checklist so first-time applicants know what inspectors look for.',
    author: 'Bekele T.',
    tag: 'Export Standards',
    replies: 9,
  },
  {
    id: 'post-004',
    title: 'Trucking cooperative for landlocked exporters',
    excerpt: 'Looking for other Sahel-region farmers to split freight costs to coastal ports.',
    author: 'Ibrahim O.',
    tag: 'Cross-Border Logistics',
    replies: 17,
  },
  {
    id: 'post-005',
    title: 'How are you pricing against futures markets?',
    excerpt: 'Cocoa futures have been volatile — curious how others peg listing prices week to week.',
    author: 'Koffi Y.',
    tag: 'Pricing',
    replies: 31,
  },
  {
    id: 'post-006',
    title: 'Soil testing labs that ship results fast',
    excerpt: 'Need turnaround under two weeks ahead of planting. Recommendations from East Africa welcome.',
    author: 'Amina O.',
    tag: 'Soil Health',
    replies: 6,
  },
]
