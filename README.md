# Bland — Identity Directions

Five directions for a standalone **Bland** storefront, separate from the Bland
Pro Shop retail site, each rendered against the real Bland catalogue.

A design review tool, not a store. No cart, no checkout, no accounts, no
database. Every product links out to the live page on blandpro.shop.

## The constraint

Bland is monochrome. The apparel is black with a white wordmark and white line
faces; the grip tape is black with a white face; the deck bottoms are a scrawled
face and nothing else. The only colour the brand owns is *inside the deck
graphics* — the pink stain, the Beermare collage, Pink Interference.

So none of these directions introduce a brand colour, and none of them carry a
headline. Bland's own product doesn't explain itself and neither should the
site. Section titles are nouns; the only prose anywhere is an address and a set
of opening hours.

That leaves structure to do the work. The five differ by density, scale,
ground and whether the grid is ruled — not by palette or voice.

| | Direction | What it is |
| --- | --- | --- |
| 1 | **Index** | A parts index. No hero, ruled cells, tiny type, everything on screen at once. |
| 2 | **Gallery** | Few things, large, on white. Captions kept to a whisper. |
| 3 | **Inverse** | The hoodie as a website. White on black, the two-face mark large. |
| 4 | **Bleed** | Footage edge to edge. The wordmark and one line of fact. |
| 5 | **Grid** | Visible structure — hairlines, hard alignment, everything in a cell. |

Each carries a thesis and an honest note on what it costs. Open **Notes** in the
switcher.

## Switching

Click a name in the bar at the bottom, use `←`/`→`, or press `1`–`5`.

Every direction renders the same components and the same products. Hero
composition differs because composition is part of a direction; everything
below the hero is the same markup, re-tokenised.

## Marks

`src/components/BlandMark.tsx` holds three, taken from what is actually printed
on his product: the single round face from the grip tape and deck bottoms, the
two-face "Dissociate" lockup from the tee and hoodie, and BLAND set wide and
bold as it appears across the chest. All are single-colour and inherit
`currentColor`, because the brand is black on white or white on black and never
anything else.

## Stack

- **Vite 8** + **React 19** + **TypeScript**
- **Tailwind v4** (`@tailwindcss/vite`)
- **shadcn/ui** (base-ui) — `src/components/ui/`
- No database. Product data is a static JSON snapshot.

A direction is one block of CSS custom properties under
`html[data-identity="…"]` in `src/identity/identities.css` plus one entry in
`src/data/identities.ts`. Adding a sixth needs no component changes.

Note the `html` qualifier on those selectors: `[data-identity]` and `:root` have
equal specificity and both match `<html>`, and shadcn's `:root` block is emitted
after our import, so an unqualified selector loses every shared token.

## Data

`src/data/products.json` — 64 real Bland-vendor products from blandpro.shop's
public JSON: titles, prices, compare-at prices, stock status, image URLs.
Images are served from Shopify's CDN.

`public/media/` — four clips from his own product media, re-encoded to short
muted loops (2.6 MB total) and vendored so the build is self-contained rather
than hotlinking his CDN from another origin. They were already black and white.

Refresh the catalogue against `https://blandpro.shop/products.json?limit=250&page=N`.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

## Deploying

Vercel, configured in `vercel.json`. Static bundle, no environment variables.

```bash
npx vercel deploy --prod
```

Needs `VERCEL_TOKEN` in the environment, or `npx vercel login` on a
machine with a browser. `npx vercel deploy --temporary` needs neither.

## What this is not

No cart, checkout, search, accounts, inventory or Storefront API wiring. That is
logistics, and logistics are a later conversation. This answers one question:
which of these should Bland look like?
