# Bland — Identity Directions

Five brand identity directions for a **standalone Bland storefront**, separate
from the Bland Pro Shop retail site, each rendered against the **real Bland
product catalogue**.

This is a design review tool, not a store. There is no cart, no checkout, no
accounts and no database — every product tile links out to the live product page
on blandpro.shop.

## The question this is answering

Bland Pro Shop resells 113 vendors across 1,476 products. 64 of those products
are Bland's own — the fingerboards, the grip tape, the custom builds and, most
importantly, the hand-cast concrete obstacle line, which is the one part of the
range nobody can drop-ship.

Today that house brand is invisible on its own store: it is absent from the
Brands page, its collections carry no meta description, and its vendor field is
split across three spellings. This prototype asks what it would look like if it
had its own front door.

## The five directions

| | Direction | The bet |
| --- | --- | --- |
| 1 | **Concrete** | An industrial materials company that happens to make fingerboard obstacles. |
| 2 | **Deadpan** | The name is the joke; the execution refuses to be in on it. |
| 3 | **Xerox** | A shop that sponsors riders, photocopied onto a flyer. |
| 4 | **Nocturne** | Precision hardware — dark room, one light, product-led. |
| 5 | **Arcade** | The nineties shop counter, in colour. |

Each carries a written thesis and an honest note on what it costs you — open
**Notes** in the switcher.

## Switching

- Click a name in the bar at the bottom
- `←` / `→` to step through
- `1`–`5` to jump straight to one

Every direction renders the *same* components and the *same* products. Only the
identity changes, so what you are comparing is the identity and not a different
page. Hero composition varies per direction because composition is part of an
identity; everything below the hero is byte-for-byte the same markup.

## Stack

- **Vite 8** + **React 19** + **TypeScript**
- **Tailwind v4** (`@tailwindcss/vite`)
- **shadcn/ui** (base-ui) — `src/components/ui/`
- No database. Product data is a static JSON snapshot.

Identity is a set of CSS custom properties per `html[data-identity="…"]` in
`src/identity/identities.css`. Adding a sixth direction means adding one block
there plus one entry in `src/data/identities.ts` — no component changes.

## Data

`src/data/products.json` — 64 real Bland-vendor products scraped from
blandpro.shop's public JSON endpoints: titles, prices, compare-at prices, stock
status and image URLs. Images are served from Shopify's CDN.

`public/media/` — four real clips from his own product media, re-encoded to
short muted loops (3.5 MB total) so the prototype is self-contained rather than
hotlinking his CDN from another origin.

To refresh the catalogue, re-run the extraction against
`https://blandpro.shop/products.json?limit=250&page=N`.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

## Deploying

Netlify, configured in `netlify.toml`. Connect the repo and it builds with no
environment variables — it is a fully static bundle.

## What this is not

No cart, checkout, search, accounts, inventory or Storefront API wiring. Those
are logistics, and logistics are a later conversation. This exists to answer one
question: which of these should Bland look like?
