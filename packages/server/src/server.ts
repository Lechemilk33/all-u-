import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { Poller, type Store } from '@flip/ingest';
import {
  acceptSuggestion, buildSnapshot, clearStagedOrder, outcomesView, parseClientState,
  positionsView, readSuggestions, recordOffers, snapshotTsv, stageOrder, stagedOrder,
  writeClientState, type Snapshot,
} from './api.js';

export interface ServerOptions {
  readonly port: number;
  readonly webRoot: string;
  readonly store: Store;
  readonly poller: Poller | null;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

export function startServer(opts: ServerOptions): ReturnType<typeof createServer> {
  // Cached only long enough to keep a burst of UI polls from re-running the
  // pipeline; short enough that the freshness numbers on screen stay true.
  let cache: { at: number; key: string; snapshot: Snapshot } | null = null;

  const snapshotFor = (url: URL): Snapshot => {
    const opt = {
      minVolume24h: numParam(url, 'minVol'),
      captureRate: numParam(url, 'capture'),
      maxStalenessSeconds: numParam(url, 'maxAge'),
      topN: numParam(url, 'top'),
      useCash: url.searchParams.get('useCash') === '1',
      membership: membershipParam(url),
    };
    const key = JSON.stringify(opt);
    const now = Math.floor(Date.now() / 1000);
    if (cache !== null && cache.key === key && now - cache.at < 5) return cache.snapshot;
    const snapshot = buildSnapshot(opts.store, stripUndefined(opt), now);
    cache = { at: now, key, snapshot };
    return snapshot;
  };

  const server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      send(res, 500, { error: String(err) });
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (path === '/api/candidates') return send(res, 200, snapshotFor(url));

    if (path === '/api/tsv') {
      res.writeHead(200, { 'content-type': 'text/tab-separated-values; charset=utf-8' });
      res.end(snapshotTsv(snapshotFor(url)));
      return;
    }

    if (path === '/api/health') {
      const snap = snapshotFor(url);
      return send(res, 200, { feed: snap.feed, funnel: snap.funnel, client: snap.client });
    }

    if (path === '/api/suggestions' && req.method === 'GET') {
      return send(res, 200, { suggestions: readSuggestions(opts.store, 100) });
    }

    if (path === '/api/suggestions' && req.method === 'POST') {
      const body = await readJson(req);
      if (body === null) return send(res, 400, { error: 'invalid JSON body' });
      const offered = snapshotFor(url).candidates;
      const result = acceptSuggestion(opts.store, body as Record<string, unknown>, offered, Math.floor(Date.now() / 1000));
      // A rejected suggestion returns 422 with every reason, rather than being
      // silently discarded. If the model invented something, you see exactly what.
      return result.ok ? send(res, 201, { id: result.id }) : send(res, 422, { errors: result.errors });
    }

    if (path === '/api/client-state' && req.method === 'POST') {
      const body = await readJson(req);
      if (body === null) return send(res, 400, { error: 'invalid JSON body' });
      const parsed = parseClientState(body, Math.floor(Date.now() / 1000));
      if ('error' in parsed) return send(res, 400, parsed);
      writeClientState(opts.store, parsed);
      const at = Math.floor(Date.now() / 1000);
      const newOffers = recordOffers(opts.store, parsed.geOffers, at);
      // Cash sizing feeds the pipeline, so a fresh report must not be served
      // behind a stale snapshot.
      cache = null;
      // The staged order rides back on the report the plugin already makes, so
      // prefill needs no second round trip.
      return send(res, 200, {
        ok: true, cashStack: parsed.cashStack, offerEvents: newOffers,
        staged: stagedOrder(opts.store, at),
      });
    }

    if (path === '/api/stage' && req.method === 'POST') {
      const body = await readJson(req);
      if (body === null) return send(res, 400, { error: 'invalid JSON body' });
      const result = stageOrder(opts.store, body, Math.floor(Date.now() / 1000));
      return result.ok ? send(res, 201, result.staged) : send(res, 422, { errors: result.errors });
    }

    if (path === '/api/staged' && req.method === 'GET') {
      return send(res, 200, { staged: stagedOrder(opts.store, Math.floor(Date.now() / 1000)) });
    }

    if (path === '/api/staged' && req.method === 'DELETE') {
      clearStagedOrder(opts.store);
      return send(res, 200, { ok: true });
    }

    if (path === '/api/positions' && req.method === 'GET') {
      return send(res, 200, positionsView(opts.store, Math.floor(Date.now() / 1000)));
    }

    if (path === '/api/outcomes' && req.method === 'GET') {
      const window = numParam(url, 'window') ?? 4 * 3600; // nofallback-ok: scoring window default
      return send(res, 200, outcomesView(opts.store, Math.floor(Date.now() / 1000), window));
    }

    if (path === '/api/item' && req.method === 'GET') {
      const id = Number(url.searchParams.get('id'));
      if (!Number.isInteger(id)) return send(res, 400, { error: 'id must be an integer' });
      return send(res, 200, itemDetail(opts.store, id));
    }

    if (path === '/api/poll' && req.method === 'POST') {
      if (opts.poller === null) return send(res, 503, { error: 'this server was started without a poller' });
      await opts.poller.pollLatest();
      cache = null;
      return send(res, 200, { ok: true });
    }

    return serveStatic(res, opts.webRoot, path);
  }

  server.listen(opts.port, '127.0.0.1');
  return server;
}

function itemDetail(store: Store, id: number): unknown {
  const item = store.db.prepare('SELECT * FROM items WHERE id = ?').get(id) ?? null;
  const ticks = store.db.prepare(
    'SELECT side, price, source_at AS sourceAt FROM price_ticks WHERE item_id = ? ORDER BY source_at DESC LIMIT 300',
  ).all(id);
  const spreads = store.db.prepare(
    'SELECT bucket_at AS bucketAt, spread, origin FROM spread_history WHERE item_id = ? ORDER BY bucket_at DESC LIMIT 200',
  ).all(id);
  const volume = store.db.prepare('SELECT volume_24h AS volume24h, fetched_at AS fetchedAt FROM volumes WHERE item_id = ?').get(id) ?? null;
  return { item, ticks, spreads, volume };
}

async function serveStatic(res: ServerResponse, root: string, path: string): Promise<void> {
  const rel = path === '/' ? '/index.html' : path;
  // Contain every request inside the web root; a traversal attempt resolves
  // outside it and is refused rather than normalised into something servable.
  const full = resolve(join(root, normalize(rel)));
  if (!full.startsWith(resolve(root))) { send(res, 403, { error: 'forbidden' }); return; }
  try {
    const buf = await readFile(full);
    res.writeHead(200, {
      'content-type': MIME[extname(full)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(buf);
  } catch {
    send(res, 404, { error: `not found: ${path}` });
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 1_000_000) return null;
    chunks.push(c as Buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

function membershipParam(url: URL): 'any' | 'f2p' | 'members' | 'auto' | undefined {
  const raw = url.searchParams.get('members');
  if (raw === null) return undefined;
  // An unrecognised value is dropped rather than coerced, so a typo shows the
  // full market instead of silently filtering it.
  return raw === 'f2p' || raw === 'members' || raw === 'any' || raw === 'auto' ? raw : undefined;
}

function numParam(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
