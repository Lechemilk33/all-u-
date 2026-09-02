export type HeroKind = 'gallery' | 'inverse' | 'bleed' | 'grid'

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
    fingerboards: string
    ramps: string
    apparel: string
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
    id: 'gallery',
    name: 'Gallery',
    pitch: 'Few things, large, on white. Captions kept to a whisper.',
    thesis:
      'The deck graphics are the only colour the brand has, and this gives them the most room to be it. A range of thirty-six reads as deliberate rather than thin, which matters when the whole line is four decks and three completes.',
    risk: 'Slow to shop. The apparel shots are print-on-demand mockups and will look obviously borrowed at this size.',
    hero: 'gallery',
    swatch: ['#FFFFFF', '#000000', '#8A8A8A', '#F2F2F2'],
    copy: {
      announcement: 'Free shipping over $75',
      note: '',
      fingerboards: 'Fingerboards',
      ramps: 'Ramps',
      apparel: 'Apparel',
    },
  },
  {
    id: 'inverse',
    name: 'Inverse',
    pitch: 'The hoodie, as a website. White on black, nothing else.',
    thesis:
      'Literally what the brand already looks like on a garment — black ground, white mark, white type. The least invention of the four, and the deck graphics genuinely pop harder on black than on white.',
    risk: 'Every product shot currently sits on a white background, so the grid reads as bright squares punched out of black until the photography is redone.',
    hero: 'inverse',
    swatch: ['#000000', '#0C0C0C', '#FFFFFF', '#7A7A7A'],
    copy: {
      announcement: 'Lincoln, California',
      note: '',
      fingerboards: 'Fingerboards',
      ramps: 'Ramps',
      apparel: 'Apparel',
    },
  },
  {
    id: 'bleed',
    name: 'Bleed',
    pitch: 'Footage first, edge to edge. The wordmark and almost nothing else.',
    thesis:
      'The fingerboard footage is already black and white and already good. This spends the whole homepage on it and defers every word until the visitor scrolls — the most brand-forward option without writing a line of copy.',
    risk: 'Depends entirely on a supply of fingerboard footage, and right now the site has exactly one clip. Four scenes cut from it carries a homepage; it does not carry a season.',
    hero: 'bleed',
    swatch: ['#000000', '#FFFFFF', '#1A1A1A', '#9C9C9C'],
    copy: {
      announcement: '',
      note: '',
      fingerboards: 'Fingerboards',
      ramps: 'Ramps',
      apparel: 'Apparel',
    },
  },
  {
    id: 'grid',
    name: 'Grid',
    pitch: 'Visible structure. Hairlines, hard alignment, everything in a cell.',
    thesis:
      'The line spans $4.95 locknuts and $79.95 concrete, and a ruled grid is the one layout where that reads as a considered system rather than a jumble. The most durable too: structure survives new categories without redesign.',
    risk: 'Cold and a little architectural. The rules do a lot of the talking, which is the opposite of letting the products talk.',
    hero: 'grid',
    swatch: ['#FFFFFF', '#111111', '#D8D8D8', '#F6F6F6'],
    copy: {
      announcement: '2290 Nicolaus Rd, Lincoln CA',
      note: '',
      fingerboards: 'Fingerboards',
      ramps: 'Ramps',
      apparel: 'Apparel',
    },
  },
]

export const defaultIdentity = identities[0].id
