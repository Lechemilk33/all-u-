/**
 * The path the site is served from.
 *
 * GitHub Pages serves a project site from /<repo>/, not from the root, so every
 * internal link has to carry that prefix. Keeping it in one place means the same
 * build works at a root domain, on a subpath, or anywhere else.
 *
 * Set CURBCUT_BASE at build time. Always starts and ends with "/".
 */
export const BASE = (() => {
  const raw = process.env.CURBCUT_BASE ?? '/';
  const withLead = raw.startsWith('/') ? raw : `/${raw}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
})();

/** Prefixes a site-absolute path with the base. `/wcag/` -> `/all-u-/wcag/`. */
export const href = (path) => `${BASE}${String(path).replace(/^\//, '')}`;
