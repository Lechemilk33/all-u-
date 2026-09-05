/**
 * MCP server: the whole AI layer.
 *
 * The constraint that shapes this file is that there is no API key. Everything
 * runs off a Claude subscription, which means there is no scheduled server-side
 * model call to build — a cron job cannot authenticate as you. So the
 * relationship is inverted relative to the usual design: the deterministic half
 * runs continuously and this exposes it as tools, and the model is invoked only
 * when you actually sit down to trade and open Claude Code.
 *
 * That inversion deletes an entire subsystem. There is no prompt cache, no
 * top-30 hash, no "call the model only when the set materially changed" —
 * those exist to control per-call API spend, and there is no per-call spend.
 *
 * Written directly against the JSON-RPC wire protocol so the server has no
 * dependencies at all; it is a stdio process the CLI spawns.
 */
import { createInterface } from 'node:readline';
import { Store } from '@flip/ingest';
import { buildSnapshot, acceptSuggestion, snapshotTsv, positionsView, outcomesView } from '@flip/server/api';
import { readSuggestions } from '@flip/ingest';

const PROTOCOL_VERSION = '2024-11-05';

const dbPath = process.env['FLIP_DB'] ?? 'data/flip.db';
const store = new Store(dbPath);
const now = (): number => Math.floor(Date.now() / 1000);

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => string;
}

const TOOLS: Tool[] = [
  {
    name: 'get_candidates',
    description:
      'The current flip candidates, already filtered, costed and ranked, as TSV. '
      + 'Every column is computed from stored observations of the OSRS Wiki price feed. '
      + 'Prices are the realistic fill (quoted spread undercut by one coin per leg), net is '
      + 'after the 2% GE tax with exemptions applied, and units is the smallest of the buy '
      + 'limit, what the market can absorb in 4 hours, and what the cash stack affords. '
      + 'A spread_z of "unknown" means there is not enough baseline history to compute one — '
      + 'it does not mean zero. Do not recompute any of these numbers; they are final.',
    inputSchema: {
      type: 'object',
      properties: {
        min_volume_24h: { type: 'number', description: 'Liquidity floor. Default 1000.' },
        max_age_seconds: { type: 'number', description: 'Max age of the OLDER price leg. Default 600.' },
        limit: { type: 'number', description: 'Rows to return. Default 30.' },
        use_cash_stack: {
          type: 'boolean',
          description: 'Size positions against the cash stack the game client reported. '
            + 'Has no effect if no client is connected.',
        },
        membership: {
          type: 'string',
          enum: ['auto', 'any', 'f2p', 'members'],
          description: 'Which items to consider. "auto" (the default) follows the world the '
            + 'client reported, so a free world yields only free-to-play items. With no client '
            + 'connected "auto" means unfiltered — it never assumes an account type. '
            + 'Members items cannot be bought at all on a free world.',
        },
      },
    },
    run: (a) => {
      const snap = buildSnapshot(store, {
        minVolume24h: num(a['min_volume_24h']),
        maxStalenessSeconds: num(a['max_age_seconds']),
        topN: num(a['limit']) ?? 30, // nofallback-ok: page size default
        useCash: a['use_cash_stack'] === true,
        membership: membershipArg(a['membership']),
      }, now());

      const header = [
        // nofallback-ok: funnel counter, absent only when nothing was processed
        `# ${snap.candidates.length} candidates from ${snap.funnel['input'] ?? 0} items in the feed`,
        `# cash stack: ${snap.client === null ? 'no client connected — affordability not applied' : `${snap.client.cashStack} gp`}`,
        `# feed: ${snap.feed.lastLatestOk === true ? 'healthy' : 'DEGRADED'}, last poll ${snap.feed.lastLatestPoll === null ? 'never' : `${now() - snap.feed.lastLatestPoll}s ago`}`,
        `# filters: vol>=${snap.config.minVolume24h}, older-leg age<=${snap.config.maxStalenessSeconds}s, capture=${snap.config.captureRate}, items=${snap.config.membership}`,
      ].join('\n');
      return `${header}\n${snapshotTsv(snap)}`;
    },
  },
  {
    name: 'get_item_detail',
    description:
      'Stored tick history and spread baseline for one item, for when a candidate '
      + 'needs a closer look. Returns only what is in the database; it does not fetch.',
    inputSchema: {
      type: 'object',
      properties: { item_id: { type: 'number' } },
      required: ['item_id'],
    },
    run: (a) => {
      const id = num(a['item_id']);
      if (id === undefined) return 'error: item_id is required';
      const item = store.db.prepare('SELECT * FROM items WHERE id = ?').get(id);
      if (item === undefined) return `error: no item ${id} in /mapping`;
      const ticks = store.db.prepare(
        'SELECT side, price, source_at FROM price_ticks WHERE item_id = ? ORDER BY source_at DESC LIMIT 60',
      ).all(id);
      const spreads = store.db.prepare(
        'SELECT bucket_at, spread FROM spread_history WHERE item_id = ? ORDER BY bucket_at DESC LIMIT 60',
      ).all(id);
      return JSON.stringify({ item, ticks, spreads }, null, 2);
    },
  },
  {
    name: 'get_client_state',
    description:
      'What the RuneLite plugin last reported: cash stack, inventory, and open GE offers. '
      + 'Returns "no client connected" when nothing has reported recently — in that case '
      + 'there is no cash figure to reason about and you should say so rather than assume one.',
    inputSchema: { type: 'object', properties: {} },
    run: () => {
      const snap = buildSnapshot(store, { topN: 0 }, now());
      if (snap.client === null) {
        return 'no client connected — no cash stack, inventory or offer state is available';
      }
      return JSON.stringify(snap.client, null, 2);
    },
  },
  {
    name: 'get_open_positions',
    description:
      'Your live Grand Exchange slots as the game client reported them: item, side, '
      + 'offer price, fill progress, coins actually moved, and how long each has been open. '
      + 'An offer with no fill progress for a long time has most likely been undercut. '
      + 'Also returns your measured time-to-fill history per item, which is the one signal '
      + 'the public price feed cannot provide. Returns "no client connected" when the '
      + 'RuneLite plugin is not reporting — in that case say so rather than assuming a position.',
    inputSchema: { type: 'object', properties: {} },
    run: () => {
      const v = positionsView(store, now());
      if (!v.connected && v.positions.length === 0) {
        return 'no client connected — no offer state is available';
      }
      return JSON.stringify(v, null, 2);
    },
  },
  {
    name: 'get_outcomes',
    description:
      'How past suggestions actually turned out, scored against stored price ticks over '
      + 'the window following each call, plus any real fills from your offer log. '
      + 'A hit rate of null means not enough has been scored yet — it does not mean zero.',
    inputSchema: {
      type: 'object',
      properties: { window_seconds: { type: 'number', description: 'Scoring window. Default 14400 (4h).' } },
    },
    // nofallback-ok: scoring window default, not market data
    run: (a) => JSON.stringify(outcomesView(store, now(), num(a['window_seconds']) ?? 14400), null, 2),
  },
  {
    name: 'log_suggestion',
    description:
      'Record a trade call so it can be scored against what actually happened. '
      + 'The suggestion is VALIDATED against the candidate set before it is stored: the item '
      + 'must be one that was offered, any name you give must match /mapping exactly, buy_at and '
      + 'sell_at must lie inside the observed spread, and qty must not exceed the permitted units. '
      + 'A suggestion that fails any of these is rejected with the reasons, not stored.',
    inputSchema: {
      type: 'object',
      properties: {
        item_id: { type: 'number' },
        action: { type: 'string', enum: ['buy', 'skip'] },
        buy_at: { type: 'number' },
        sell_at: { type: 'number' },
        qty: { type: 'number' },
        confidence: { type: 'number', description: '0 to 1' },
        reasoning: { type: 'string' },
      },
      required: ['item_id', 'action', 'buy_at', 'sell_at', 'qty', 'confidence', 'reasoning'],
    },
    run: (a) => {
      // Validated against a generous set so a call made against a slightly older
      // snapshot is not rejected merely for having scrolled out of the top 30.
      const offered = buildSnapshot(store, { topN: 200 }, now()).candidates;
      const res = acceptSuggestion(store, a, offered, now());
      return res.ok
        ? `logged as suggestion #${res.id}`
        : `REJECTED — not stored:\n${res.errors.map((e) => `  - ${e}`).join('\n')}`;
    },
  },
  {
    name: 'get_suggestion_log',
    description:
      'Past suggestions with their scored outcomes, for judging whether the model '
      + 'calls beat the deterministic ranking.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    run: (a) => JSON.stringify(readSuggestions(store, num(a['limit']) ?? 50) /* nofallback-ok: page size default */, null, 2),
  },
];

function membershipArg(v: unknown): 'any' | 'f2p' | 'members' | 'auto' | undefined {
  return v === 'any' || v === 'f2p' || v === 'members' || v === 'auto' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// ------------------------------------------------------------------ JSON-RPC

interface Request { jsonrpc: '2.0'; id?: number | string; method: string; params?: Record<string, unknown> }

function reply(id: number | string | undefined, result: unknown): void {
  if (id === undefined) return;
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function fail(id: number | string | undefined, code: number, message: string): void {
  if (id === undefined) return;
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (line.trim() === '') return;
  let req: Request;
  try { req = JSON.parse(line) as Request; } catch { return; }

  switch (req.method) {
    case 'initialize':
      reply(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'osrs-flip-finder', version: '0.1.0' },
      });
      return;

    case 'notifications/initialized':
      return;

    case 'tools/list':
      reply(req.id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
      return;

    case 'tools/call': {
      const name = req.params?.['name'];
      const tool = TOOLS.find((t) => t.name === name);
      if (tool === undefined) { fail(req.id, -32602, `unknown tool: ${String(name)}`); return; }
      try {
        const args = (req.params?.['arguments'] ?? {}) as Record<string, unknown>;
        reply(req.id, { content: [{ type: 'text', text: tool.run(args) }] });
      } catch (err) {
        // Surfaced as tool output rather than a protocol error, so the model can
        // see and report the failure instead of the call vanishing.
        reply(req.id, { content: [{ type: 'text', text: `tool error: ${String(err)}` }], isError: true });
      }
      return;
    }

    default:
      fail(req.id, -32601, `method not found: ${req.method}`);
  }
});
