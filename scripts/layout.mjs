/**
 * Shared page shell for every generated page.
 *
 * Generated pages are plain static HTML with no client JavaScript beyond the
 * theme toggle: they are reference material, they need to render instantly, and
 * they need to be readable by a crawler that runs nothing.
 */

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Makes every horizontally scrollable box keyboard reachable.
 *
 * A container that scrolls but cannot take focus hides its overflow from
 * keyboard users entirely (WCAG 2.1.1, and axe's scrollable-region-focusable).
 * Doing this as one pass over the finished HTML is deliberate: it cannot be
 * forgotten at a call site, which is exactly how our own bookmarklet page
 * shipped with the failure our dogfood run then caught.
 *
 * Each region gets a distinct name, taken from the table's caption where there
 * is one. Two landmarks sharing a role and a name are indistinguishable to
 * anyone navigating by landmark — a failure the first version of this helper
 * introduced, and which the same dogfood run then caught as well.
 */
export function makeScrollableRegionsFocusable(html) {
  let out = html.replace(/<pre(?![^>]*\btabindex=)/g, '<pre tabindex="0"');

  let n = 0;
  out = out.replace(
    /<div class="table-scroll"(?![^>]*\btabindex=)>([\s\S]*?)(?=<\/div>)/g,
    (whole, inner) => {
      n += 1;
      const caption = /<caption[^>]*>([\s\S]*?)<\/caption>/.exec(inner)?.[1];
      const name = caption
        ? caption.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/\.$/, '')
        : `Table ${n}`;
      return `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(name)}, scrollable">${inner}`;
    },
  );
  return out;
}

import { BASE, href } from './base.mjs';
export { BASE, href };

export const SITE = {
  name: 'Curbcut',
  origin: 'https://curbcut.dev',
  tagline: 'See your site the way a plaintiff’s lawyer does.',
};

/**
 * @param {object} o
 * @param {string} o.title      full <title>
 * @param {string} o.description meta description
 * @param {string} o.path       absolute path, e.g. "/wcag/1.4.3/"
 * @param {string} o.body       page HTML
 * @param {Array<{href:string,label:string}>} [o.crumbs]
 * @param {object} [o.jsonLd]
 */
export function page({ title, description, path, body, crumbs = [], jsonLd }) {
  const canonical = `${SITE.origin}${path}`;
  const crumbTrail = [{ href: '/', label: 'Curbcut' }, ...crumbs];

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbTrail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: `${SITE.origin}${c.href}`,
    })),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${href("/favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="/src/styles.css">
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>

<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${href("/")}">
      <svg class="brand-mark" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
        <path d="M2 21h22v3H2z" fill="currentColor" opacity=".38"/>
        <path d="M2 21V9h9l8 12H2z" fill="currentColor"/>
      </svg>
      Curbcut
    </a>
    <nav class="site-nav" aria-label="Main">
      <a href="${href("/extension/")}">Extension</a>
      <a href="${href("/deadlines/")}">Deadlines</a>
      <a href="${href("/law/")}">The law</a>
      <a href="${href("/fix/")}">Fix guides</a>
      <a href="${href("/wcag/")}">WCAG 2.2</a>
      <a href="${href("/method/")}">Method</a>
    </nav>
  </div>
</header>

<main id="main" tabindex="-1">
  <div class="wrap-narrow" style="padding-top:2.25rem">
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        ${crumbTrail
          .map((c, i) =>
            i === crumbTrail.length - 1
              ? `<li><span aria-current="page">${esc(c.label)}</span></li>`
              : `<li><a href="${esc(href(c.href))}">${esc(c.label)}</a></li>`,
          )
          .join('')}
      </ol>
    </nav>
    ${body}

    <aside class="cta">
      <h2>Scan a page against this</h2>
      <p>
        Curbcut checks any page against WCAG 2.2 and ranks what it finds by legal exposure
        rather than error count. Free, no account, runs in your browser.
      </p>
      <form class="scan-row" action="${href("/")}" method="get">
        <label class="visually-hidden" for="cta-url">Website address to scan</label>
        <input class="scan-input" id="cta-url" name="url" type="url" inputmode="url"
               placeholder="yourstore.com" required>
        <button class="btn" type="submit">Scan it</button>
      </form>
    </aside>
  </div>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-cols">
      <div>
        <h2>Scan</h2>
        <ul>
          <li><a href="${href("/")}">Scan a page</a></li>
          <li><a href="${href("/extension/")}">Browser extension</a></li>
          <li><a href="${href("/bookmarklet/")}">Bookmarklet</a></li>
          <li><a href="${href("/method/")}">How the score works</a></li>
        </ul>
      </div>
      <div>
        <h2>Reference</h2>
        <ul>
          <li><a href="${href("/wcag/")}">WCAG 2.2 criteria</a></li>
          <li><a href="${href("/law/")}">Legal regimes</a></li>
          <li><a href="${href("/deadlines/")}">Deadlines</a></li>
        </ul>
      </div>
      <div>
        <h2>Fix guides</h2>
        <ul>
          <li><a href="${href("/fix/shopify/")}">Shopify</a></li>
          <li><a href="${href("/fix/wordpress/")}">WordPress</a></li>
          <li><a href="${href("/fix/react/")}">React and Next.js</a></li>
          <li><a href="${href("/fix/")}">All platforms</a></li>
        </ul>
      </div>
    </div>
    <hr>
    <p>
      Curbcut reports what an automated engine can detect and how those failures map to
      published law. It is not legal advice and it is not a compliance certificate.
      Testing is powered by <a href="https://github.com/dequelabs/axe-core" rel="noopener">axe-core</a>,
      which is licensed MPL-2.0.
    </p>
  </div>
</footer>
</body>
</html>
`;
}
