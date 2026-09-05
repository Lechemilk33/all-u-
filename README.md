# OSRS Flip Finder

A Grand Exchange flip finder built on the OSRS Wiki real-time prices feed, with
one governing rule: **no number reaches a screen or a model unless it was
derived from a real observation.** Missing data is rejected with a reason, never
filled in with a default.

```
npm install
npm run build
FLIP_CONTACT="you@example.com" npm start        # http://127.0.0.1:8787
FLIP_CONTACT="you@example.com" npm run backfill # seeds spread baselines (~1 min)
```

`FLIP_CONTACT` is required. The Wiki API returns 403 to generic user agents and
asks that yours name the project and a way to reach you.

---

## How the guarantee is enforced

Not by prompting, and not by care. By construction:

| Mechanism | Where | What it prevents |
|---|---|---|
| `Observation` carries endpoint + fetch time + the trade's own timestamp | `core/provenance.ts` | A number with no traceable origin |
| `buildCandidate` returns a **reason**, never a partial row | `core/candidate.ts` | `undefined` becoming `0` |
| `spreadZScore` returns `null`, never `0`, below 24 samples | `core/metrics.ts` | "No baseline" reading as "perfectly normal" |
| `validateSuggestion` checks model output against the offered set | `core/validate.ts` | The model inventing items, names, prices or quantities |
| `npm run lint:nofallback` fails the build on `?? 0` | `scripts/` | The whole class of silent default |
| Funnel counts rendered under the table | web UI | A broken feed looking like a quiet market |

The validator is the important one. A model may only *choose among rows we
computed*. If it names an item that was not offered, echoes a name that
disagrees with `/mapping`, quotes a price outside the observed spread, or asks
for more units than the buy limit, volume and cash allow, the suggestion is
rejected with reasons and not stored.

```
$ log_suggestion item_id=21326 name="Nature impling jar" ...
REJECTED — not stored:
  - name "Nature impling jar" does not match /mapping name "Amethyst arrow" for id 21326
```

## The AI layer, without API keys

Everything runs off a Claude subscription, so there is no scheduled server-side
model call — a cron job cannot authenticate as you. The relationship is
therefore inverted: **the deterministic half runs continuously, and the model
pulls from it when you sit down to trade.**

`packages/mcp` is a dependency-free stdio MCP server exposing five tools:
`get_candidates`, `get_item_detail`, `get_client_state`, `log_suggestion`,
`get_suggestion_log`. Register it with Claude Code:

```json
{ "mcpServers": { "flip": {
    "command": "node",
    "args": ["packages/mcp/dist/index.js"],
    "env": { "FLIP_DB": "data/flip.db" } } } }
```

That inversion deletes a whole subsystem. There is no prompt cache, no
top-30 hash, no "call the model only when the set materially changed" — those
exist to control per-call API spend, and there is none.

## Reading your client, and what this will not do

`plugin/` is a RuneLite plugin that reports your coin stack, inventory and open
GE offers to `127.0.0.1`, so position sizing is bounded by money you actually
have. It refuses to send anything to a non-loopback host.

It **reads only**. It does not place, edit, collect or cancel an offer.
Automating a game action is against Jagex's third-party client rules, and the
RuneLite plugin API deliberately exposes no way to synthesise the input that
would be needed — plugins doing so are refused by the Plugin Hub. The
"one keypress, one action" allowance covers input *you* perform inside the
official client, not an external tool issuing the action.

So the tool does everything up to the trade: exact item name for the search box,
exact price, exact quantity, exact capital, each with a copy button. You press
the keys.

## What the numbers mean

**Tax.** 2% since 29 May 2025, floored, capped at 5m per item, charged to the
seller. The 48 exempt items are resolved by exact name against a live
`/mapping` response, and the resolver hard-fails on any name it cannot match.
There is no hard-coded "no tax below 50 gp" — that threshold is an artefact of
the floor (it sat at 100 gp under the old 1% rate), and encoding it would break
silently on the next rate change.

**Staleness is judged on the older leg.** `/latest` reports each side with its
own timestamp, and across the live feed the median gap between them is ~36
minutes (p90: over two days). Filtering on the fresher leg admits, as the
*typical* case, a "spread" computed between a current price and a half-hour-old
one. Both leg ages are always shown separately.

**Prices are the realistic fill.** `high` is the last instant-buy and `low` the
last instant-sell; a flip provides liquidity on both legs, and every public flip
site queues at those same two numbers. Ranking uses `low+1` / `high-1`. The
quoted spread stays visible as the optimistic bound.

**Position size is the tightest real constraint.** `net × buy_limit` is the
standard way to build a finder that recommends garbage: the buy limit is a
ceiling from Jagex, not a forecast. An item with a 13,000 limit trading 5,000/day
cannot absorb 13,000 units in four hours. Size is `min(buy limit, volume × 4/24 ×
capture, cash ÷ price)`, and the table names which one bound.

## What the data cannot see

- **No order-book depth.** You can never see how many offers sit at a price.
  Volume and trade count are the only proxies for whether you fill.
- **It is a sample.** The feed is crowd-sourced from RuneLite users, not Jagex.
  Thin items have genuinely noisy prints.
- **Everyone has it.** Every public flip site reads this same feed. Obvious
  margins on liquid items are competed away in minutes; the edge is in filters
  and timing, not the data.

## Layout

```
packages/core     tax, metrics, filters, scoring, provenance, validator  (no deps)
packages/ingest   Wiki client, SQLite store, poller, backfill            (no deps)
packages/server   HTTP API + static host                                 (no deps)
packages/web      the interface — vanilla TS, native ES modules          (no deps)
packages/mcp      stdio MCP server for Claude Code                       (no deps)
plugin/           RuneLite plugin, read-only                             (Java)
```

Runtime dependencies: none. TypeScript and Playwright are dev-only; storage is
`node:sqlite`, HTTP is `node:http`, fetching is the built-in `fetch`.

## Storage

The poller writes **one row per reported trade**, not one per poll. Inserting
every item every 30s would be ~13.1M rows/day, nearly all identical to the row
before; the API hands us each trade's timestamp, so a unique constraint turns
the poller into change-data-capture and a repeat poll of an untraded item is a
no-op.

## Checks

```
npm run typecheck        # strict, noUncheckedIndexedAccess, project references
npm test                 # 30 engine tests
npm run lint:nofallback  # fails on any numeric ?? / || fallback
npm run verify           # re-derives every claim against a live API fetch
node test/ui.mjs         # browser smoke test (server must be running)
```

`npm run verify` is the one to run when you doubt something. It fetches fresh,
rebuilds the funnel, prints the top rows, and re-derives the top row's
arithmetic independently of the engine that produced it.
