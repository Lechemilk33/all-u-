/**
 * Vercel Edge Function: the fetch proxy.
 *
 * The scanner runs entirely in the visitor's browser. The one thing a browser
 * cannot do is read another origin's HTML, so this does that single job.
 *
 * Serving it from the same origin as the site means there is no CORS to
 * configure and no separate service to deploy or keep in sync. The
 * implementation is shared with the Cloudflare Worker in packages/worker.
 */

import { handleProxyRequest } from '../packages/worker/src/proxy.js';

export const config = { runtime: 'edge' };

export default function handler(request: Request): Promise<Response> {
  // Same-origin by default, so the allow-list is not what protects this — the
  // SSRF guarding in proxy.ts is. '*' keeps the bookmarklet and other origins
  // working without a second deployment.
  return handleProxyRequest(request, { ALLOWED_ORIGINS: '*' });
}
