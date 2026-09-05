# OSRS Flip Finder

A Grand Exchange flip finder built on the OSRS Wiki real-time prices feed, with
one governing rule: **no number reaches a screen or a model unless it was
derived from a real observation.** Missing data is rejected with a reason, never
filled in with a default.

## Start here

Needs **Node 22.5 or newer** and git. Nothing else — no runtime dependencies, no
database to install, no API keys.

```bash
node --version    # must be v22.5.0 or higher
```

Node is installed per machine, not per project, so having other projects working
does not mean the version is new enough — storage is `node:sqlite`, which is
built into Node from 22.5 and is the reason there is no database to install. On
an older Node the app stops with a message telling you so. `nvm install 22 &&
nvm use 22` if you need it.

```bash
git clone -b claude/osrs-flip-finder-data-dwowmt https://github.com/Lechemilk33/all-u-.git flip
cd flip
npm install
npm run build
FLIP_CONTACT="you@example.com" npm start
```

Open **http://127.0.0.1:8787**. Candidates appear on the first poll, a few
seconds in.

`FLIP_CONTACT` is required and must be a real address: the Wiki API returns 403
to generic user agents and asks that yours name the project and a contact.

Then, once, in a second terminal:

```bash
FLIP_CONTACT="you@example.com" npm run backfill   # ~1 minute
```

Until that runs, every `spread_z` reads `unknown` — correctly, since there is no
baseline yet. The backfill seeds ~15 days of hourly history for the 400
highest-volume items so the anomaly signal works from day one.

Leave the server running. It polls `/latest` every 45s and writes one row per
reported trade, so history accumulates for as long as it is up. Stop it with
Ctrl-C; nothing is lost.

### Where to put it

Clone it as its **own folder**, not inside an existing project. It is a
self-contained server with its own npm workspace root, its own `tsconfig.json`
project references, and root-level `build`/`start` scripts — dropped inside
another repo, those collide with the host's equivalents and npm hoists
dependencies in ways neither project expects.

It does not need to live inside anything. It serves a local web UI and writes a
SQLite file next to itself; nothing else in your setup has to know it exists.

If you do want it inside a repo you already have, put it in a subdirectory and
leave it out of the parent's `workspaces` — then run every command from inside
that subdirectory. It has its own `package.json` and lockfile, so that works,
but the sibling folder is simpler and nothing is gained by nesting it.

### What works without the game client

Everything except the parts that need to see your account: ranking, tax and
exemptions, the F2P/members filter, staging with copy buttons, and the MCP
tools for Claude Code. That is most of the value and it works the moment the
server starts.

Connecting the RuneLite plugin adds cash-stack sizing, live offer tracking,
measured time-to-fill, and prefill. It needs a RuneLite plugin dev setup
(`plugin/` is a standard Gradle plugin project — see the
[RuneLite plugin guide](https://github.com/runelite/plugin-hub/blob/master/README.md)),
which is a longer job than the five minutes above.

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

`packages/mcp` is a dependency-free stdio MCP server exposing seven tools:
`get_candidates`, `get_item_detail`, `get_client_state`, `get_open_positions`,
`get_outcomes`, `log_suggestion` and `get_suggestion_log`.

Register it with Claude Code from inside the project directory:

```bash
claude mcp add flip -- node "$PWD/packages/mcp/dist/index.js"
```

It reads `FLIP_DB`, defaulting to `data/flip.db` relative to wherever it is
launched — so set it explicitly if Claude Code starts elsewhere:

```bash
claude mcp add flip -e FLIP_DB="$PWD/data/flip.db" -- node "$PWD/packages/mcp/dist/index.js"
```

Then ask for flips in plain language; the tools do the rest. The MCP server
reads the same database the web UI does, so both can run at once.

That inversion deletes a whole subsystem. There is no prompt cache, no
top-30 hash, no "call the model only when the set materially changed" — those
exist to control per-call API spend, and there is none.

## Order tracking, and where the line is

`plugin/` is a RuneLite plugin that reports your coin stack, inventory and Grand
Exchange offer state to `127.0.0.1`. It refuses to send anything to a
non-loopback host.

The line is **no synthesised input, and no new server actions** — which is not
the same as "no writes at all", and the difference is where the useful part
lives.

**What the plugin may not do:**

- Generate mouse or keyboard input. Jagex, 25 January 2017: *"You may now only
  use your operating system's official default mouse keys program, unless it is
  to remap a key to any other button."* AutoHotkey and similar programmable
  mouse keys were named as previously tolerated and *"This is no longer the
  case."* An external clicker driving the client is that category exactly.
- Add menu entries. The Third Party Client Guidelines prohibit *"any addition of
  new menu entries which cause actions to be sent to the server"*.
- Place, edit or cancel offers. `GrandExchangeOffer` is six getters and zero
  setters — `getItemId`, `getPrice`, `getTotalQuantity`, `getQuantitySold`,
  `getSpent`, `getState`. There is no `placeOffer` to call, and no official
  Jagex order API exists.

Rule 7 backs all of it: automation tools, macros and bots are prohibited, and
macroing major is a permanent ban available on a first offence, with a possible
bank rollback.

**What the plugin may do, and does here:** prefill the Grand Exchange search box
and price input from a staged order. That sets client variables and re-runs the
client's own key-listener script through the RuneLite plugin API — no OS-level
input event is synthesised, and no menu entry is added. `07flip`, listed in the
official [plugin-hub registry](https://github.com/runelite/plugin-hub/blob/master/plugins/07flip),
uses exactly this mechanism. You still click the slot and click Confirm; those
are the server actions and they stay yours.

Prefill is **off by default** (`Prefill staged orders` in the plugin config), and
the version-sensitive widget and VarClient ids are exposed as settings so a
RuneLite update turns the feature off rather than breaking it.

**One caveat, stated plainly.** RuneLite's
[Rejected or Rolled Back Features](https://github.com/runelite/runelite/wiki/Rejected-or-Rolled-Back-Features)
list includes: *"Plugins which programmatically insert text into the user's
chatbox input for any reason (pasting messages, shorthand expansion, etc.). This
is considered to be autotyping."* The Grand Exchange search and price inputs use
that same chatbox widget, so prefill uses the same mechanism the rule names —
though every example it gives is a chat-message case, and a hub-listed plugin
does it for GE inputs. That is genuine ambiguity rather than settled ground.
It is why the feature ships off, and why nothing else in this project depends on
it: turn it on if you judge the reading reasonable, and everything else works
identically without it.

**What is not ambiguous** is confirming or cancelling an offer. Those send
actions to the server, which the client guidelines prohibit adding new ways to
do. `07flip` — the most permissive flipping plugin that has passed hub review —
*highlights* the Confirm button and does not click it. That is the clearest
available signal about where the reviewed line sits, and this project sits on
the same side of it.

What the read side gives you is worth more than it sounds. The plugin subscribes
to `GrandExchangeOfferChanged`, which fires the moment a fill lands, so the
finder measures:

| Signal | Why it isn't in the price feed |
|---|---|
| **Time to fill**, per item and side | Needs *your* order history, not the shared feed. No public flip site has it. |
| **True cost basis** | `getSpent() / quantitySold`. A buy can fill below your ask, so the ask is not what you paid. |
| **Undercut detection** | An offer with fill progress that stops has been outbid. Only your own offer state shows this. |
| **Realised P&L** | The only honest way to score a suggestion. |

Placing and cancelling stay manual. The drawer's **Send to client** button
stages an order for prefill, and every value also has a copy button for when
prefill is off.

The no-fabrication rule follows the price all the way into the game: staging
re-validates against the live pipeline, so an item the pipeline is not offering,
a price outside the observed spread, or a quantity beyond the permitted units is
refused rather than typed. The item name comes from `/mapping`, never from the
request. The spread travels with the staged order, so the client refuses a
prefill whose price the market has since left behind, and a staged order expires
after 15 minutes rather than being entered into a live offer later.

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

**Members items are filtered, not annotated.** `/mapping` carries a `members`
flag and the plugin reports the world type it is actually on, so the `items`
selector defaults to matching your world: on a free world you see only the 818
free-to-play items, because members items cannot be bought there at all. With no
client connected it shows everything rather than assuming an account type. Every
row carries an F2P/P2P badge regardless, so an unfiltered list still tells you
which flips you can make.

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
packages/ingest   Wiki client, store, poller, backfill, order tracking   (no deps)
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

`scripts/simulate-client.mjs` posts the same payloads the plugin posts, so the
positions UI can be exercised without a game client attached. It takes its item
ids and prices from the live candidate set rather than inventing them.

Storage is a plain SQLite file at `data/flip.db`, so any language can read it —
`sqlite3.connect('data/flip.db')` from Python works fine for analysis or
notebooks. Writes should go through the API so validation and the
change-only-insert rule are not bypassed.

`npm run verify` is the one to run when you doubt something. It fetches fresh,
rebuilds the funnel, prints the top rows, and re-derives the top row's
arithmetic independently of the engine that produced it.
