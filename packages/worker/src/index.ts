/**
 * Cloudflare Workers adapter.
 *
 * The proxy itself lives in proxy.ts and is runtime-agnostic. This file exists
 * only so it can be deployed with `wrangler deploy`; the same function is
 * served from /api/fetch on Vercel, which is the default deployment.
 */

import { handleProxyRequest, type Env } from './proxy.js';

export type { Env };

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleProxyRequest(request, env),
} satisfies ExportedHandler<Env>;
