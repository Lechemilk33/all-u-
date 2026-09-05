import { DatabaseSync } from 'node:sqlite';
import type { ItemRef, LatestQuote } from '@flip/core';

/**
 * Storage.
 *
 * SQLite rather than Postgres, deliberately. This is a single-user tool whose
 * model layer runs on the user's own machine (see the MCP server), so a network
 * database buys operational burden and nothing else. node:sqlite ships with Node
 * 22, which means the whole ingest path has no third-party dependency at all.
 */
export interface StoreStats {
  readonly items: number;
  readonly ticks: number;
  readonly volumes: number;
  readonly spreadPoints: number;
  readonly suggestions: number;
  /** 0 when no tick has ever been stored — SQLite MIN/MAX over an empty table. */
  readonly oldestTick: number;
  readonly newestTick: number;
}

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, members INTEGER NOT NULL,
        buy_limit INTEGER, highalch INTEGER, value INTEGER,
        examine TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );

      -- One row per *reported trade*, not one row per poll.
      --
      -- Inserting every item on every 30s poll would write 4,535 * 2,880 =
      -- ~13.1M rows a day, almost all of them identical to the row before.
      -- The API hands us the timestamp of the underlying trade, so the unique
      -- constraint below turns the poller into a change-data-capture loop: a
      -- repeat poll of an untraded item is a no-op INSERT OR IGNORE. Same
      -- information, one to two orders of magnitude fewer rows.
      CREATE TABLE IF NOT EXISTS price_ticks (
        item_id INTEGER NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('high','low')),
        price INTEGER NOT NULL,
        source_at INTEGER NOT NULL,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (item_id, side, source_at)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS ix_ticks_time ON price_ticks (source_at);

      CREATE TABLE IF NOT EXISTS volumes (
        item_id INTEGER PRIMARY KEY, volume_24h INTEGER NOT NULL, fetched_at INTEGER NOT NULL
      );

      -- Hourly spread observations, the baseline the z-score is computed from.
      CREATE TABLE IF NOT EXISTS spread_history (
        item_id INTEGER NOT NULL, bucket_at INTEGER NOT NULL, spread INTEGER NOT NULL,
        origin TEXT NOT NULL CHECK (origin IN ('live','backfill')),
        PRIMARY KEY (item_id, bucket_at)
      ) WITHOUT ROWID;

      -- State reported by the RuneLite plugin. Read-only mirror of the client;
      -- nothing here is ever inferred when the plugin is not connected.
      CREATE TABLE IF NOT EXISTS client_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cash_stack INTEGER, inventory_json TEXT, ge_offers_json TEXT,
        world INTEGER, member INTEGER, reported_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL, item_id INTEGER NOT NULL, action TEXT NOT NULL,
        buy_at INTEGER NOT NULL, sell_at INTEGER NOT NULL, quantity INTEGER NOT NULL,
        confidence REAL NOT NULL, reasoning TEXT NOT NULL,
        -- The candidate row exactly as it was shown to the model, so the
        -- suggestion can be scored later against what was actually known then.
        candidate_json TEXT NOT NULL,
        outcome_checked_at INTEGER, outcome_buy INTEGER, outcome_sell INTEGER, outcome_net INTEGER
      );

      -- Every Grand Exchange offer state transition the client reported.
      --
      -- Append-only, and the only record of what YOUR offers actually did. The
      -- price feed can tell you what the market traded at; only this can tell
      -- you whether your offer at that price ever filled, and how long it took.
      -- That makes time-to-fill the one metric here that no public flip site
      -- has, because computing it requires your own order history.
      CREATE TABLE IF NOT EXISTS ge_offer_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        state TEXT NOT NULL,
        price INTEGER NOT NULL,
        total_quantity INTEGER NOT NULL,
        quantity_sold INTEGER NOT NULL,
        -- Coins actually moved. A buy offer can fill BELOW your offer price, so
        -- spent/quantity_sold is the true cost basis and price is only what you
        -- asked for. Realised P&L uses the former.
        spent INTEGER NOT NULL,
        observed_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_offer_events_slot ON ge_offer_events (slot, observed_at);
      CREATE INDEX IF NOT EXISTS ix_offer_events_item ON ge_offer_events (item_id, observed_at);

      CREATE TABLE IF NOT EXISTS poll_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT NOT NULL, fetched_at INTEGER NOT NULL,
        rows_seen INTEGER NOT NULL, rows_written INTEGER NOT NULL, ok INTEGER NOT NULL, error TEXT
      );
    `);
  }

  upsertItems(items: readonly ItemRef[], now: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO items (id,name,members,buy_limit,highalch,value,examine,icon,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, members=excluded.members, buy_limit=excluded.buy_limit,
        highalch=excluded.highalch, value=excluded.value, examine=excluded.examine,
        icon=excluded.icon, updated_at=excluded.updated_at
    `);
    let n = 0;
    this.db.exec('BEGIN');
    try {
      for (const i of items) {
        stmt.run(i.id, i.name, i.members ? 1 : 0, i.buyLimit, i.highalch, i.value, i.examine, i.icon, now);
        n++;
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    return n;
  }

  /** Returns how many rows were genuinely new — i.e. how many real trades happened. */
  writeTicks(quotes: readonly LatestQuote[], fetchedAt: number): number {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO price_ticks (item_id,side,price,source_at,fetched_at) VALUES (?,?,?,?,?)',
    );
    let written = 0;
    this.db.exec('BEGIN');
    try {
      for (const q of quotes) {
        if (q.high !== null && q.highTime !== null) {
          written += Number(stmt.run(q.itemId, 'high', q.high, q.highTime, fetchedAt).changes);
        }
        if (q.low !== null && q.lowTime !== null) {
          written += Number(stmt.run(q.itemId, 'low', q.low, q.lowTime, fetchedAt).changes);
        }
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    return written;
  }

  writeVolumes(volumes: ReadonlyMap<number, number>, fetchedAt: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO volumes (item_id,volume_24h,fetched_at) VALUES (?,?,?)
      ON CONFLICT(item_id) DO UPDATE SET volume_24h=excluded.volume_24h, fetched_at=excluded.fetched_at
    `);
    this.db.exec('BEGIN');
    try {
      for (const [id, v] of volumes) stmt.run(id, v, fetchedAt);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    return volumes.size;
  }

  writeSpreadPoints(points: ReadonlyArray<{ itemId: number; bucketAt: number; spread: number }>, origin: 'live' | 'backfill'): number {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO spread_history (item_id,bucket_at,spread,origin) VALUES (?,?,?,?)',
    );
    let n = 0;
    this.db.exec('BEGIN');
    try {
      for (const p of points) n += Number(stmt.run(p.itemId, p.bucketAt, p.spread, origin).changes);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    return n;
  }

  readItems(): Map<number, ItemRef> {
    const rows = this.db.prepare('SELECT * FROM items').all() as Array<Record<string, unknown>>;
    const map = new Map<number, ItemRef>();
    for (const r of rows) {
      map.set(r['id'] as number, {
        id: r['id'] as number,
        name: r['name'] as string,
        members: (r['members'] as number) === 1,
        buyLimit: (r['buy_limit'] as number | null),
        highalch: (r['highalch'] as number | null),
        value: (r['value'] as number | null),
        examine: r['examine'] as string,
        icon: r['icon'] as string,
      });
    }
    return map;
  }

  readVolumes(): Map<number, number> {
    const rows = this.db.prepare('SELECT item_id, volume_24h FROM volumes').all() as Array<Record<string, unknown>>;
    return new Map(rows.map((r) => [r['item_id'] as number, r['volume_24h'] as number]));
  }

  /** Spread baselines, newest first, capped per item. */
  readSpreadHistory(sinceSeconds: number): Map<number, number[]> {
    const rows = this.db.prepare(
      'SELECT item_id, spread FROM spread_history WHERE bucket_at >= ? ORDER BY bucket_at DESC',
    ).all(sinceSeconds) as Array<Record<string, unknown>>;
    const map = new Map<number, number[]>();
    for (const r of rows) {
      const id = r['item_id'] as number;
      let arr = map.get(id);
      if (arr === undefined) { arr = []; map.set(id, arr); }
      if (arr.length < 200) arr.push(r['spread'] as number);
    }
    return map;
  }

  logPoll(endpoint: string, fetchedAt: number, seen: number, written: number, ok: boolean, error?: string): void {
    this.db.prepare(
      'INSERT INTO poll_log (endpoint,fetched_at,rows_seen,rows_written,ok,error) VALUES (?,?,?,?,?,?)',
    ).run(endpoint, fetchedAt, seen, written, ok ? 1 : 0, error ?? null);
  }

  stats(): StoreStats {
    const one = (sql: string): number => {
      const row = this.db.prepare(sql).get() as Record<string, unknown> | undefined;
      const v = row === undefined ? 0 : Object.values(row)[0];
      return typeof v === 'number' ? v : 0;
    };
    return {
      items: one('SELECT COUNT(*) FROM items'),
      ticks: one('SELECT COUNT(*) FROM price_ticks'),
      volumes: one('SELECT COUNT(*) FROM volumes'),
      spreadPoints: one('SELECT COUNT(*) FROM spread_history'),
      suggestions: one('SELECT COUNT(*) FROM suggestions'),
      oldestTick: one('SELECT MIN(source_at) FROM price_ticks'),
      newestTick: one('SELECT MAX(source_at) FROM price_ticks'),
    };
  }

  close(): void { this.db.close(); }
}
