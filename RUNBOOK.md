# Runbook

Everything needed to put Curbcut live, and an honest account of how it could
make money. Read the last section first if you only read one.

---

## 1. Get it live (about 30 minutes, $0)

### The Worker

```bash
cd packages/worker
npx wrangler login          # opens a browser, free account, no card
npx wrangler deploy
```

Wrangler prints a URL like `https://curbcut-fetch.<subdomain>.workers.dev`.
Free plan: 100,000 requests a day. Each scan is one request, so that is 100,000
scans a day before anything costs anything.

Once the site has a domain, restrict the Worker to it — otherwise anyone can
point their own tool at your quota:

```toml
# packages/worker/wrangler.toml
ALLOWED_ORIGINS = "https://curbcut.pages.dev,https://yourdomain.com"
```

then `npx wrangler deploy` again.

### The site

Push this branch, then in the Cloudflare dashboard: **Workers & Pages → Create →
Pages → Connect to Git**, pick the repo, and set:

- Build command: `npm run build`
- Output directory: `packages/web/dist`

You get `curbcut.pages.dev` free, forever, with TLS. Vercel works identically
(`vercel.json` is already here) and gives you `*.vercel.app`.

### Connect them

One line in `packages/web/index.html`:

```html
<meta name="curbcut:proxy" content="https://curbcut-fetch.YOURNAME.workers.dev">
```

Also update `ORIGIN` in `scripts/build-bookmarklet.mjs`, or set
`CURBCUT_ORIGIN` in the build environment, so the bookmarklet points at your
deployment rather than `curbcut.dev`.

Commit, push, done. Scan something and confirm the report renders.

### What is not free

**Nothing, until you want a custom domain.** `curbcut.pages.dev` costs nothing
and works permanently. A `.com` is roughly $10–15/year at cost through
Cloudflare Registrar. That is the only expense anywhere in this project, and it
is optional — get it once there is traffic worth branding, not before.

---

## 2. Verify before you promote

The legal dataset was compiled on **1 September 2026** and every entry in
`packages/core/src/regimes.ts` carries its own `verifiedOn` date. Deadlines,
penalty ceilings and enforcement practice all move.

Before sending anyone to this site, re-read the two that carry the most weight:

- The DOJ Title II rule (28 CFR Part 35, Subpart H) — the 2027-04-26 date
- The EAA national penalty figures — these vary by member state and are the
  numbers most likely to be reported loosely elsewhere

Fixing a number is a one-line edit; the dataset exists so that this is cheap.

---

## 3. Why this market, specifically

The research behind the build, with the figures that drove each decision:

- **8,667 ADA lawsuits filed in 2025**, more than 5,000 targeting websites, up
  27% year on year. E-commerce drew about 70% of them.
- **ADA Title II has a hard federal deadline.** Public entities serving 50,000+
  were required to meet WCAG 2.1 AA by 24 April 2026 — already passed. Everyone
  smaller, plus every special district government, has until **26 April 2027**.
  The United States has roughly 90,000 local government units. Most of the ones
  still in scope are small, have no accessibility staff, and have a statutory
  date with public money attached to it.
- **The EAA has been enforceable since 28 June 2025** for anyone selling to EU
  consumers, wherever they are established. National penalty ceilings run from
  about €100,000 to over €1,000,000.
- **95.9% of home pages fail**, averaging 56.1 detectable errors — and that
  number got *worse* in 2026.
- **Trust in the incumbents is damaged.** The FTC fined an overlay vendor $1M in
  2025 over compliance claims, and 22.6% of H1 2025 lawsuits hit sites that had
  already bought an overlay.

That last point is the wedge. The market is full of tools that tell buyers what
they want to hear, and buyers have now been publicly burned by exactly that.
Curbcut's differentiator is not the scanner — axe-core is free and everyone uses
it — it is **the ranking, the legal mapping, and the refusal to overstate**.

---

## 4. How it makes money

Ranked by how well each fits what is already built. None require spend.

### a. Lead generation for remediation firms — the strongest fit

A visitor who has just scanned their own checkout and seen four blocking
failures is the most qualified lead in this industry. Agencies charge
$2,500–$10,000 for a manual audit and $200–$1,000/month for monitoring, and they
buy leads.

What is already built: the report ends at the moment of maximum motivation.
What to add: a "get this fixed" step that captures an email and routes it.
Charge per qualified lead, or take a referral share. Talk to three or four
accessibility agencies before building any of it — they will tell you what a
lead is worth to them, and the answer sets the price.

### b. Sell the audit yourself

The report is the top of the work, not the whole of it. Automation reaches ~a
third of the criteria; the rest is manual, and that is what agencies charge
thousands for. If you want a services business, Curbcut is the funnel and the
first hour of every engagement is already done.

The CLI is the outbound engine:

```bash
node packages/cli/bin/curbcut.mjs --file prospects.txt --format csv --out out.csv
```

Results come back ranked worst-first. A list of municipal sites in one state,
scanned, sorted, and approached with *their own findings and their own statutory
deadline* is a materially better cold email than anything generic.

### c. Advertising on the reference pages

122 pages of genuine reference content sit in high-CPM territory — legal and
compliance keywords. AdSense is free to join. This is slow, it needs real
traffic first, and it is the least interesting of the three; it is listed
because it costs nothing to turn on later.

### d. A paid report artifact

Reports print cleanly to PDF already (`window.print()`). A more formal
deliverable — a VPAT-style Accessibility Conformance Report, generated
client-side from the same data — is a natural paid tier at $49–$199, because
procurement asks for exactly that document. **Be careful here:** an ACR is a
statement of conformance, and an automated tool cannot honestly produce one on
its own. Sell it as a *draft to be completed by a human reviewer*, and say so on
the artifact. Selling it as finished is the accessiBe mistake, and it carries the
same regulatory risk.

---

## 5. Getting the first thousand visitors

- **The reference pages are the long game.** 122 pages targeting specific,
  low-competition, high-intent queries — "WCAG 1.4.3", "ADA Title II deadline",
  "Shopify alt text accessibility". Every one links to the scanner. This takes
  months, and it compounds.
- **The deadline is the hook.** `/deadlines/` counts down to 26 April 2027 and
  recalculates on load. That page is what you send to a public entity.
- **Post where practitioners already argue about this.** r/accessibility,
  Hacker News, the a11y Slack communities, LinkedIn accessibility groups. Lead
  with the honest framing — *"a scanner that tells you what it could not test"* —
  because that community is deeply hostile to overclaiming and will respond to
  someone who does not.
- **The dogfood result is a credential.** Curbcut passes its own scan with zero
  Level AA violations across all 11 page types, in CI. Very few tools in this
  space can say that. Say it.
- **Show Curbcut's ranking against a plain error count** on a well-known site.
  The difference between "312 errors" and "these four are what a complaint would
  reproduce" is the entire pitch, and it demonstrates in one screenshot.

---

## 6. The honest assessment

I was asked to build something that would make money. Here is the straight
version.

**What is real:** the market is large, growing, legally compelled rather than
discretionary, and has a dated deadline inside the next eight months. The
product is genuinely differentiated — the exposure model and the legal mapping
do not exist in any free tool I found. It runs at zero marginal cost, which
means it cannot fail by burning money. The code is tested, it audits itself in
CI, and it is honest in a market where honesty is currently scarce and
conspicuous.

**What is not:** software does not make anyone rich on its own, and this will not
either without distribution. The scanning engine underneath is axe-core, which
is free and which competitors also use — the defensibility is in the ranking, the
legal data, and the content, all of which are copyable by anyone willing to do
the same work. SEO on 122 pages takes months and may never rank. The most
plausible near-term revenue is services and referrals, which is work, not
passive income.

**What I would do first:** deploy it, then email ten accessibility agencies and
ask what a qualified inbound lead is worth to them. That single answer decides
whether this is a lead-gen business, a services business, or a portfolio piece.
It costs an afternoon and it is worth more than another month of building.
