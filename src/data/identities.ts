export type HeroKind = 'index' | 'gallery' | 'inverse' | 'bleed' | 'grid'

export type Identity = {
  id: string
  name: string
  pitch: string
  thesis: string
  risk: string
  hero: HeroKind
  swatch: string[]
  copy: {
    /** Factual only — shipping, hours, address. Never a slogan. */
    announcement: string
    /** A short factual line under the wordmark, or empty for none. */
    note: string
    concrete: string
    catalog: string
    builds: string
  }
}

/**
 * All five are monochrome, because Bland is monochrome: black apparel, white
 * wordmark, white line-art faces. The only colour in the brand comes from the
 * deck graphics themselves — pink stain, the Beermare collage, Pink
 * Interference — so the site's job is to stay out of their way.
 *
 * These directions therefore differ by structure, density and scale rather
 * than by palette or voice. There are no headlines to argue about.
 */
export const identities: Identity[] = [
  {
    id: 'index',
    name: 'Index',
    pitch: 'A parts index. Everything visible at once, nothing announced.',
    thesis:
      'Closest to how the range is actually shopped — people arrive knowing they want a 34mm deck or white tape, and every extra hero image is one more thing between them and it. Densest direction, and the cheapest to keep tidy as the catalogue grows.',
    risk: 'Gives a first-time visitor nothing to feel. Works for the person who already knows the brand, less so for the one discovering it.',
    hero: 'index',
    swatch: ['#FFFFFF', '#FAFAFA', '#111111', '#E2E2E2'],
    copy: {
      announcement: 'Lincoln, California — Wed to Sun, 1–6pm',
      note: '',
      concrete: 'Concrete',
      catalog: 'All products',
      builds: 'Builds',
    },
  },
  {
    id: 'gallery',
    name: 'Gallery',
    pitch: 'Few things, large, on white. Captions kept to a whisper.',
    thesis:
      'The deck graphics are the only colour the brand has, and this is the direction that gives them the most room to be the colour. Scales down well: a range of forty looks deliberate rather than thin.',
    risk: 'Slow to shop. Needs consistent photography, and the apparel shots currently come from a print-on-demand mockup that will look obviously borrowed at this size.',
    hero: 'gallery',
    swatch: ['#FFFFFF', '#000000', '#8A8A8A', '#F2F2F2'],
    copy: {
      announcement: 'Free shipping over $75',
      note: '',
      concrete: 'Concrete',
      catalog: 'Products',
      builds: 'Builds',
    },
  },
  {
    id: 'inverse',
    name: 'Inverse',
    pitch: 'The hoodie, as a website. White on black, nothing else.',
    thesis:
      'This is literally what the brand already looks like on a garment — black ground, white wordmark, white line faces. The least invention of the five, and the graphics genuinely pop harder on black than they do on white.',
    risk: 'Every product shot currently sits on a white background, so the grid reads as bright squares punched out of black until the photography is redone.',
    hero: 'inverse',
    swatch: ['#000000', '#0C0C0C', '#FFFFFF', '#7A7A7A'],
    copy: {
      announcement: 'Lincoln, California',
      note: '',
      concrete: 'Concrete',
      catalog: 'All products',
      builds: 'Builds',
    },
  },
  {
    id: 'bleed',
    name: 'Bleed',
    pitch: 'Footage first, edge to edge. The wordmark and almost nothing else.',
    thesis:
      'His own clips are already black and white and already good. This direction spends the whole homepage on them and defers every word until the visitor has scrolled — the most brand-forward option without adding a single line of copy.',
    risk: 'Depends entirely on having a supply of footage. Four clips carries a homepage; it does not carry a season.',
    hero: 'bleed',
    swatch: ['#000000', '#FFFFFF', '#1A1A1A', '#9C9C9C'],
    copy: {
      announcement: '',
      note: '',
      concrete: 'Concrete',
      catalog: 'Products',
      builds: 'Builds',
    },
  },
  {
    id: 'grid',
    name: 'Grid',
    pitch: 'Visible structure. Hairlines, hard alignment, everything in a cell.',
    thesis:
      'The catalogue spans $7.95 tape and $450 builds, and a ruled grid is the one layout where that range reads as a considered system rather than a jumble. Also the most durable — structure survives new categories without redesign.',
    risk: 'Cold and a little architectural. The rules do a lot of the talking, which is the opposite of letting the products talk.',
    hero: 'grid',
    swatch: ['#FFFFFF', '#111111', '#D8D8D8', '#F6F6F6'],
    copy: {
      announcement: '2290 Nicolaus Rd, Lincoln CA',
      note: '',
      concrete: 'Concrete',
      catalog: 'Index',
      builds: 'Builds',
    },
  },
]

export const defaultIdentity = identities[0].id
