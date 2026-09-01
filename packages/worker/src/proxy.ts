/**
 * Curbcut fetch proxy.
 *
 * The scanner runs entirely in the visitor's browser. The one thing a browser
 * cannot do is read another origin's HTML, so this Worker does that single job:
 * fetch a public page and hand back its markup with CORS headers.
 *
 * It stores nothing, holds no credentials, and logs no URLs. It runs on the
 * Cloudflare Workers free plan — 100,000 requests a day, no card — which is the
 * entire running cost of the product.
 *
 * Because it fetches arbitrary user-supplied URLs, it is a server-side request
 * forgery surface, and most of this file is the guard rail for that.
 */

export interface Env {
  ALLOWED_ORIGINS?: string;
}

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; CurbcutBot/0.1; +https://curbcut.dev/bot) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

/** Hostnames that must never be fetched, whatever the caller asks for. */
const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]',
  'metadata.google.internal', 'metadata.goog',
]);

const PRIVATE_V4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/** Rejects private, loopback, link-local and non-public destinations. */
function validateTarget(raw: string): { url: URL } | { error: string; status: number } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: 'That does not look like a URL. Include the scheme, for example https://example.com', status: 400 };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { error: 'Only http and https URLs can be scanned.', status: 400 };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { error: 'That host cannot be scanned.', status: 403 };
  }
  if (PRIVATE_V4.test(host)) {
    return { error: 'Private and loopback addresses cannot be scanned.', status: 403 };
  }
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^(f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i.test(host)) {
    return { error: 'Private and loopback addresses cannot be scanned.', status: 403 };
  }
  // A bare hostname with no dot is either an intranet name or a typo.
  if (!host.includes('.') && !host.includes(':')) {
    return { error: 'Enter a full public domain, for example https://example.com', status: 400 };
  }

  return { url };
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') ?? '';
  const allow =
    allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0] ?? 'null';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

/** Reads at most `MAX_BYTES` so one enormous page cannot exhaust the worker. */
async function readCapped(response: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: '', truncated: false };

  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > MAX_BYTES) {
      chunks.push(value.subarray(0, MAX_BYTES - total));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }

  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }

  const charset = /charset=["']?([\w-]+)/i.exec(response.headers.get('content-type') ?? '')?.[1];
  let text: string;
  try {
    text = new TextDecoder(charset ?? 'utf-8', { fatal: false, ignoreBOM: false }).decode(buf);
  } catch {
    text = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(buf);
  }
  return { text, truncated };
}

/**
 * The whole proxy, as a plain Request -> Response function.
 *
 * Kept runtime-agnostic on purpose: it runs unchanged on Cloudflare Workers and
 * on a Vercel Edge Function, and there is exactly one copy of the SSRF guarding
 * to keep correct.
 */
export async function handleProxyRequest(request: Request, env: Env = {}): Promise<Response> {
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405, cors);

  const requestUrl = new URL(request.url);

  if (requestUrl.pathname.endsWith('/health')) {
    return json({ ok: true, service: 'curbcut-fetch' }, 200, cors);
  }

  const target = requestUrl.searchParams.get('url');
  if (!target) return json({ error: 'Pass ?url=' }, 400, cors);

  const checked = validateTarget(target);
  if ('error' in checked) return json({ error: checked.error }, checked.status, cors);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(checked.url.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    // A redirect can land somewhere the original URL was not.
    const finalCheck = validateTarget(upstream.url || checked.url.toString());
    if ('error' in finalCheck) {
      return json({ error: 'This URL redirects somewhere that cannot be scanned.' }, 403, cors);
    }

    const contentType = upstream.headers.get('content-type') ?? '';

    if (!upstream.ok) {
      return json(
        {
          error: `The site returned HTTP ${upstream.status}.`,
          status: upstream.status,
          hint:
            upstream.status === 403 || upstream.status === 401
              ? 'The site is blocking automated requests. Use the bookmarklet, which scans the page you are already looking at.'
              : undefined,
        },
        502,
        cors,
      );
    }

    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return json({ error: `That URL is not an HTML page (${contentType || 'unknown type'}).` }, 415, cors);
    }

    const { text, truncated } = await readCapped(upstream);

    return json(
      {
        html: text,
        finalUrl: upstream.url || checked.url.toString(),
        status: upstream.status,
        contentType,
        truncated,
        fetchedAt: new Date().toISOString(),
      },
      200,
      cors,
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return json(
      {
        error: aborted
          ? 'The site took too long to respond.'
          : 'Could not reach that site. Check the URL, or use the bookmarklet if the site blocks automated requests.',
      },
      aborted ? 504 : 502,
      cors,
    );
  } finally {
    clearTimeout(timer);
  }
}
