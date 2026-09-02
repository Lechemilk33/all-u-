import raw from './products.json'

export type Product = {
  id: number
  handle: string
  title: string
  /** Title with the category prefix removed, for use inside a category column. */
  short: string
  vendor: string
  family: Family
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

export type Family = 'Fingerboards' | 'Ramps' | 'Apparel'

export const products = raw as Product[]

/**
 * Bland makes three things: fingerboards, the ramps you ride them on, and
 * apparel. The scooter builds and scooter parts on blandpro.shop are the
 * retail shop's business, not this brand's, so they are not in this data set.
 */
export const families: { name: Family; subs: string[] }[] = [
  { name: 'Fingerboards', subs: ['Completes', 'Decks', 'Trucks', 'Wheels', 'Grip Tape'] },
  { name: 'Ramps', subs: ['Concrete', '3D Printed', 'Marble'] },
  { name: 'Apparel', subs: ['Tees', 'Hoodies', 'Headwear'] },
]

export const byFamily = (f: Family) => products.filter((p) => p.family === f)
export const byCategory = (c: string) => products.filter((p) => p.category === c)

/** Completes and decks — the centre of the range and the top of every page. */
export const flagship = [...byCategory('Completes'), ...byCategory('Decks')]

export const money = (n: number) =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`

/**
 * Exactly one clip on blandpro.shop is fingerboard footage — the one on the
 * Fingerboards collection page. The others are scooter, skateboard and kendama,
 * so rather than pad with those, this is four scenes cut out of that one clip.
 */
export const videos = [
  { src: '/media/fb1.mp4', poster: '/media/fb1.jpg' },
  { src: '/media/fb2.mp4', poster: '/media/fb2.jpg' },
  { src: '/media/fb3.mp4', poster: '/media/fb3.jpg' },
  { src: '/media/fb4.mp4', poster: '/media/fb4.jpg' },
]

export const shop = {
  name: 'Bland',
  address: '2290 Nicolaus Rd, Suite 103, Lincoln, CA 95648',
  hours: 'Wed – Sun, 1 – 6pm',
  phone: '(916) 415-8736',
  email: 'info@blandpro.shop',
  retail: 'https://blandpro.shop',
}
