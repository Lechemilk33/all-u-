import raw from './products.json'

export type Product = {
  id: number
  handle: string
  title: string
  vendor: string
  category: string
  price: number
  compareAt: number | null
  available: boolean
  images: string[]
  image: string
  blurb: string
  tags: string[]
  url: string
  variantCount: number
}

export const products = raw as Product[]

export const categories = [
  'Obstacles',
  'Completes',
  'Decks',
  'Trucks',
  'Wheels',
  'Grip Tape',
  'Custom Builds',
  'Apparel',
] as const

export const byCategory = (c: string) => products.filter((p) => p.category === c)

/** The concrete obstacle line — the part of the range nobody can drop-ship. */
export const concreteLine = products.filter(
  (p) => p.category === 'Obstacles' && /concrete/i.test(p.title + p.blurb),
)

export const money = (n: number) =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`

/**
 * Real video from blandpro.shop's own product media, re-encoded to short muted
 * loops and vendored into /public/media so the mockup is self-contained and
 * does not hotlink his Shopify CDN from a Netlify origin.
 */
export const videos = [
  { src: '/media/v1.mp4', poster: '/media/v1.jpg' },
  { src: '/media/v2.mp4', poster: '/media/v2.jpg' },
  { src: '/media/v3.mp4', poster: '/media/v3.jpg' },
  { src: '/media/v4.mp4', poster: '/media/v4.jpg' },
]

export const shop = {
  name: 'Bland',
  parent: 'Bland Pro Shop',
  address: '2290 Nicolaus Rd, Suite 103, Lincoln, CA 95648',
  hours: 'Wed – Sun, 1 – 6pm',
  phone: '(916) 415-8736',
  email: 'info@blandpro.shop',
  retail: 'https://blandpro.shop',
}
