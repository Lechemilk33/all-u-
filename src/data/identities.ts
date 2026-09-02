export type HeroKind = 'split' | 'editorial' | 'collage' | 'cinematic' | 'stacked'

export type Identity = {
  id: string
  name: string
  /** One line the brother can judge in three seconds. */
  pitch: string
  /** Why this direction is strategically defensible for Bland specifically. */
  thesis: string
  risk: string
  hero: HeroKind
  swatch: string[]
  copy: {
    announcement: string
    kicker: string
    headline: string
    sub: string
    cta: string
    ctaAlt: string
    statementTitle: string
    statementBody: string
    concreteTitle: string
    concreteSub: string
    gridTitle: string
    buildsTitle: string
    buildsSub: string
  }
}

export const identities: Identity[] = [
  {
    id: 'concrete',
    name: 'Concrete',
    pitch: 'An industrial materials company that happens to make fingerboard obstacles.',
    thesis:
      'The concrete line is the only thing in the catalog nobody can drop-ship. This direction makes the hardest-to-copy product the whole brand, and prices it like equipment instead of like a toy.',
    risk: 'Reads cold. Leans away from the kid market and toward the collector who already knows why concrete matters.',
    hero: 'split',
    swatch: ['#0F0F0E', '#8A8681', '#D6D2CB', '#FF5C1A'],
    copy: {
      announcement: 'Cast, cured and shipped from Lincoln, California',
      kicker: 'Est. Lincoln, CA',
      headline: 'Real materials.\nSmall scale.',
      sub: 'Hand-cast concrete obstacles, machined trucks and pressed decks. Made in the same building we sell them out of.',
      cta: 'Shop the concrete line',
      ctaAlt: 'Spec sheet',
      statementTitle: 'We make the hard stuff',
      statementBody:
        'Anyone can print a graphic on a deck. Concrete has to be mixed, poured, cured and shipped without cracking — which is why almost nobody bothers. We bother. Every obstacle is cast by hand in small batches, and every one comes out slightly different.',
      concreteTitle: 'The Concrete Line',
      concreteSub: 'Cast by hand. Sold until the batch runs out.',
      gridTitle: 'Full Catalog',
      buildsTitle: 'Custom Builds',
      buildsSub: 'Assembled in-shop, one at a time, from parts we actually stock.',
    },
  },
  {
    id: 'deadpan',
    name: 'Deadpan',
    pitch: 'The name is the joke. The execution refuses to be in on it.',
    thesis:
      'Bland is a gift of a name and the store currently does nothing with it. Play it absolutely straight — Swiss grid, enormous white space, no exclamation marks — and the restraint does the work. Cheapest direction to hold consistently as the range grows.',
    risk: 'Needs disciplined photography. Falls apart the moment a busy graphic or a sale badge gets bolted on.',
    hero: 'editorial',
    swatch: ['#FAFAF8', '#111111', '#6B6B6B', '#E4002B'],
    copy: {
      announcement: 'Free shipping over $75 · Ships from Lincoln, CA',
      kicker: 'Bland',
      headline: 'Nothing\nremarkable.',
      sub: 'Fingerboards, obstacles and parts, made properly and described accurately. That is the entire proposition.',
      cta: 'Shop everything',
      ctaAlt: 'About the shop',
      statementTitle: 'A note on the name',
      statementBody:
        'We chose it because the alternative was another skull, another flame, another word in a serrated font. The products are not bland. The marketing is. We think that trade is the right way round, and we intend to keep making it.',
      concreteTitle: 'Concrete',
      concreteSub: 'Eight shapes. Cast by hand. That is the range.',
      gridTitle: 'Everything we make',
      buildsTitle: 'Builds',
      buildsSub: 'Put together in the shop. Priced below the sum of the parts.',
    },
  },
  {
    id: 'xerox',
    name: 'Xerox',
    pitch: 'A shop that sponsors riders, photocopied onto a flyer and stapled to a pole.',
    thesis:
      'This is the direction with the shortest line to the existing audience — it looks like the culture the store already lives in, and it is the only one where user photos, team clips and event flyers slot in without fighting the design.',
    risk: 'Ages fastest, and the loudest direction is the hardest to walk back if the range moves upmarket.',
    hero: 'collage',
    swatch: ['#111111', '#F2F0EB', '#FFE500', '#FF3B00'],
    copy: {
      announcement: 'TEAM RIDERS WANTED — SEND CLIPS — INFO@BLANDPRO.SHOP',
      kicker: 'Lincoln CA // Since day one',
      headline: 'BLAND\nDOES IT',
      sub: 'Decks, concrete, trucks, tape. Made by people who actually ride the stuff and sell it out of a real shop.',
      cta: 'SHOP NOW',
      ctaAlt: 'The team',
      statementTitle: 'NOT A DROPSHIPPER',
      statementBody:
        'There is a physical shop. It has a door, an address and hours. You can come in, mess with the boards, ask a stupid question and leave with something. Everything on this site is in that building right now.',
      concreteTitle: 'CONCRETE OBSTACLES',
      concreteSub: 'HAND CAST // SMALL BATCH // SELLS OUT',
      gridTitle: 'ALL PRODUCT',
      buildsTitle: 'CUSTOM BUILDS',
      buildsSub: 'ONE OFF. BUILT IN SHOP. WHEN IT IS GONE IT IS GONE.',
    },
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    pitch: 'Precision hardware. Dark room, one light, the product doing all the talking.',
    thesis:
      'The custom builds run to $450 and currently sit in the same grid as a $2.95 pin. This direction gives the expensive end somewhere to live, and is the only one of the five that could carry a genuine premium tier later.',
    risk: 'Demands better product photography than the store has today. Dark backgrounds are unforgiving of phone shots.',
    hero: 'cinematic',
    swatch: ['#08090B', '#15171C', '#9AA4B2', '#5BE1C8'],
    copy: {
      announcement: 'New: 34mm pressed decks — limited first run',
      kicker: 'Bland — Precision Goods',
      headline: 'Built to a\ntolerance.',
      sub: 'Machined trucks, pressed decks, cast concrete. Components designed to be measured, not just looked at.',
      cta: 'Explore the range',
      ctaAlt: 'Specifications',
      statementTitle: 'Tolerance is the product',
      statementBody:
        'A fingerboard is a bearing surface, a pivot and a deflection curve. Get any of the three wrong and no graphic saves it. We build to numbers first and decorate second — which is why our blanks sell as well as our prints.',
      concreteTitle: 'Cast Concrete Series',
      concreteSub: 'Hand-poured. Dimensionally checked. Numbered by batch.',
      gridTitle: 'Components',
      buildsTitle: 'Signature Builds',
      buildsSub: 'Specified, assembled and tuned in-house.',
    },
  },
  {
    id: 'arcade',
    name: 'Arcade',
    pitch: 'The nineties shop counter — stickers, primary colours, a bowl of loose parts.',
    thesis:
      'Fingerboards are bought by kids and by adults buying their own childhood back. This is the only direction that talks to both at once, and it makes the $8 tape and the $80 obstacle feel like they belong in the same shop.',
    risk: 'Nostalgia is a crowded lane. Without real shop photography it can tip into generic retro-by-numbers.',
    hero: 'stacked',
    swatch: ['#FFF6E5', '#1B1A17', '#E63329', '#1B62D6'],
    copy: {
      announcement: '⚡ In-store: Wed–Sun 1–6pm · 2290 Nicolaus Rd, Lincoln CA',
      kicker: 'Bland Pro Shop · Lincoln, California',
      headline: 'Good stuff,\nfairly priced.',
      sub: 'Boards, concrete, trucks and tape from a real counter with a real bowl of loose parts on it.',
      cta: 'Shop the shop',
      ctaAlt: 'Visit us',
      statementTitle: 'Come in and mess with it',
      statementBody:
        'The best part of a shop is picking things up. We kept the counter, the bowl of spare trucks and the guy who will tell you honestly that the cheaper one is fine. The website is just the part of the shop that stays open at night.',
      concreteTitle: 'Concrete Obstacles',
      concreteSub: 'Poured by hand out back. Heavier than you expect.',
      gridTitle: 'On the shelves',
      buildsTitle: 'Custom Builds',
      buildsSub: 'We build them at the counter. Every one is different.',
    },
  },
]

export const defaultIdentity = identities[0].id
