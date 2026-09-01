# Curbcut

**See your site the way a plaintiff's lawyer does.**

An accessibility scanner that ranks what it finds by *legal exposure* rather
than by error count, maps every finding to the regime that actually applies to
you, and states plainly what it could not test.

It runs entirely in the browser. There is no account, no queue, no database, and
no per-scan cost to anyone.

---

## Why this exists

Every accessibility scanner returns an error count. An error count is not a risk
measure. Ten missing labels in a checkout form and ten low-contrast captions in a
footer produce the same number and completely different outcomes.

Curbcut weights each finding by four things:

| Factor | Range | What it captures |
| --- | --- | --- |
| Litigation salience | 0–5 | How often the criterion is actually named in complaints |
| Blocking severity | 1–3 | Whether the failure stops a user finishing a task |
| Page region | 0.6–2.0 | Checkout 2.0, sign-in 1.8, form 1.5, nav 1.3, main 1.0, footer 0.6 |
| Volume | 1 + ln(n) | Many failures, with diminishing returns |

The weighted total passes through a saturating curve into a 0–100 **Exposure
Index**, calibrated so a page carrying the median WebAIM Million failure profile
lands in the mid-50s. There is a test that pins that calibration.

Reported separately and never conflated with it: a straight **conformance
verdict**, which is a yes/no WCAG test.

## What it will not do

No automated tool can establish that a site is accessible. Automation reaches
roughly a third of the WCAG success criteria — it can tell that an image has alt
text, not whether the alt text is right.

Curbcut states which checks did not run, in the same type size as the score, on
every report. This is not modesty. In 2025 the FTC fined an overlay vendor $1M
over claims that its automated product delivered compliance, and 22.6% of web
accessibility lawsuits in H1 2025 targeted sites that already had an overlay
installed. A scan that flatters you is worth less than nothing, because it is
the input to a decision to stop working.

---

## Repository layout

```
packages/
  core/       The engine. WCAG data, legal regimes, the exposure model,
              remediation recipes, report assembly. No DOM, no network.
  scan/       Runs axe-core against a document. Browser and Node (jsdom).
  web/        The site: landing page, scanner, report renderer, and the
              122 generated reference pages.
  worker/     Cloudflare Worker that fetches a page so the browser can scan it.
  cli/        Bulk scanning and file output.
scripts/      Content generation, bookmarklet build, post-build tidy.
test/         Engine tests, a browser end-to-end run, and the dogfood audit.
```

### How the browser scan works

A browser cannot read another origin's HTML, so a small Worker fetches it. After
that, everything is local:

1. **Every script is stripped** from the fetched HTML with `DOMParser` — the
   scanned page's own JavaScript never executes.
2. It is written into a **same-origin sandboxed frame** with a `<base>` tag, so
   its real stylesheets load and the browser lays it out.
3. **axe-core is injected into that frame** and run there.

Step 3 is not incidental. axe validates its context against its own realm's
`Document` and rejects one handed across from the parent; and colour contrast can
only be computed where layout actually happened. Contrast is the failure on 83.9%
of home pages, so a scanner that cannot see it is reporting a clean page that is
not clean.

That gives three render modes, and the mode travels with every result:

| Mode | How | Level AA criteria testable |
| --- | --- | --- |
| `static-html` | Served markup, not laid out (CLI) | 18 of 55 |
| `rendered-dom` | Served markup with real styles, scripts stripped (web) | 23 of 55 |
| `live-dom` | The fully scripted page (bookmarklet) | 23 of 55 |

---

## Running it

```bash
npm install
npm run build          # engine, content, bookmarklet, site
npm test               # engine unit tests
npm run dev            # local dev server
```

Browser checks (need Chromium):

```bash
node test/e2e.mjs      # full scan against a planted-failure fixture
node test/dogfood.mjs  # audits our own pages with our own engine
```

### CLI

```bash
node packages/cli/bin/curbcut.mjs example.com
node packages/cli/bin/curbcut.mjs --file urls.txt --format csv --out exposure.csv
node packages/cli/bin/curbcut.mjs city.gov --jurisdiction US-PUBLIC --format markdown
```

Formats: `text`, `json`, `csv`, `markdown`. Bulk results are ranked by Exposure
Index, so a scanned list sorts itself worst-first.

---

## Deploying

Two pieces, both on free tiers. See `RUNBOOK.md` for the full walkthrough.

**1. The Worker** (the only server-side component):

```bash
cd packages/worker
npx wrangler deploy
```

Cloudflare Workers' free plan allows 100,000 requests a day and needs no card.
The Worker holds no secrets and stores nothing. Set `ALLOWED_ORIGINS` in
`wrangler.toml` to your own domain before going live so nobody else uses your
quota.

**2. The site** — any static host. Cloudflare Pages or Vercel:

- Build command: `npm run build`
- Output directory: `packages/web/dist`

Then point the site at your Worker by editing one line in
`packages/web/index.html`:

```html
<meta name="curbcut:proxy" content="https://YOUR-WORKER.workers.dev">
```

---

## Data and sources

Every legal statement carries a citation and a `verifiedOn` date in
`packages/core/src/regimes.ts`. Population benchmarks come from the WebAIM
Million, February 2026. Market rates in reports are published ranges, presented
as such, and never as a prediction about any particular site.

**Re-verify the legal data before relying on it.** Deadlines and penalties change,
and the dataset carries the date it was last checked precisely so that staleness
is visible rather than hidden.

## Licensing

Testing is powered by [axe-core](https://github.com/dequelabs/axe-core) by Deque
Systems, licensed MPL-2.0. It is used unmodified as a dependency.

## Not legal advice

Curbcut reports what an automated engine can detect and how those failures map to
published law. It is not legal advice, it is not a compliance certificate, and
whether any regime applies to a particular organisation is a question for a
lawyer who knows the facts.
