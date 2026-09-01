/**
 * Deployment configuration.
 *
 * PROXY_URL is the only value that has to change to run your own copy: point it
 * at the Worker in packages/worker (`npx wrangler deploy` prints the URL).
 * Everything else in Curbcut is static and runs in the visitor's browser.
 */

const fromMeta = (name: string): string | undefined =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || undefined;

/**
 * Where the fetch proxy lives. The default is same-origin — Vercel serves it
 * from /api/fetch — so a stock deployment needs no CORS and no second service.
 * Override it with <meta name="curbcut:proxy"> to point at a Cloudflare Worker
 * or any other host running packages/worker.
 */
export const PROXY_URL: string = fromMeta('curbcut:proxy') ?? '/api/fetch';

export const SITE_NAME = 'Curbcut';
export const SITE_TAGLINE = 'See your site the way a plaintiff’s lawyer does.';

/**
 * The path the site is served from. Written into the page at build time so the
 * client builds the same links the generator did — "/wcag/…" at a root domain,
 * "/all-u-/wcag/…" on a project page.
 */
export const BASE: string = (() => {
  const raw = fromMeta('curbcut:base') ?? '/';
  const lead = raw.startsWith('/') ? raw : `/${raw}`;
  return lead.endsWith('/') ? lead : `${lead}/`;
})();

/** Prefixes a site-absolute path with the base. */
export const siteHref = (path: string): string => `${BASE}${path.replace(/^\//, '')}`;
