/**
 * Deployment configuration.
 *
 * PROXY_URL is the only value that has to change to run your own copy: point it
 * at the Worker in packages/worker (`npx wrangler deploy` prints the URL).
 * Everything else in Curbcut is static and runs in the visitor's browser.
 */

const fromMeta = (name: string): string | undefined =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || undefined;

export const PROXY_URL: string =
  fromMeta('curbcut:proxy') ?? 'https://curbcut-fetch.workers.dev';

export const SITE_NAME = 'Curbcut';
export const SITE_TAGLINE = 'See your site the way a plaintiff’s lawyer does.';
