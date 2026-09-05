/**
 * Provenance is the spine of this codebase.
 *
 * The requirement is that no number ever shown to a human or handed to a model
 * may be invented. That is not a thing you achieve by being careful; it is a
 * thing you achieve by making the invented case unrepresentable. So:
 *
 *   - Nothing enters the system except as an `Observation`, which records which
 *     endpoint produced it, when we fetched it, and the timestamp the API itself
 *     attached to the underlying trade.
 *   - Nothing is computed except by a named function that declares the
 *     observations it consumed.
 *   - A row that cannot be fully computed is *rejected with a reason*, never
 *     completed with a default. There is no `?? 0` anywhere in this package,
 *     and `npm run lint:nofallback` fails the build if one appears.
 */

/** Every endpoint we are allowed to source a number from. */
export type Endpoint = 'latest' | '5m' | '1h' | '24h' | 'volumes' | 'mapping' | 'timeseries';

/** A single fact, as reported by the API, with the receipt still attached. */
export interface Observation {
  readonly endpoint: Endpoint;
  /** Unix seconds when *we* performed the fetch. */
  readonly fetchedAt: number;
  /**
   * Unix seconds the API attached to the fact itself — the moment the trade was
   * reported. For `mapping` (static reference data) this equals `fetchedAt`.
   * This is the timestamp that matters for staleness; `fetchedAt` only tells you
   * when we asked.
   */
  readonly sourceAt: number;
}

/** The complete set of observations a derived row was computed from. */
export interface Sources {
  readonly observations: readonly Observation[];
  /** Names of the pure functions applied, in order. Purely for auditability. */
  readonly derivedBy: readonly string[];
}

export function observe(endpoint: Endpoint, fetchedAt: number, sourceAt: number): Observation {
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    throw new ProvenanceError(`observe(${endpoint}): fetchedAt is not a real timestamp`);
  }
  if (!Number.isFinite(sourceAt) || sourceAt <= 0) {
    throw new ProvenanceError(`observe(${endpoint}): sourceAt is not a real timestamp`);
  }
  return { endpoint, fetchedAt, sourceAt };
}

export function sources(observations: readonly Observation[], derivedBy: readonly string[]): Sources {
  if (observations.length === 0) {
    throw new ProvenanceError('a derived value must cite at least one observation');
  }
  return { observations, derivedBy };
}

/** The age, in seconds, of the *oldest* observation backing a row. */
export function oldestAgeSeconds(s: Sources, now: number): number {
  let oldest = Infinity;
  for (const o of s.observations) oldest = Math.min(oldest, o.sourceAt);
  return now - oldest;
}

/** The age, in seconds, of the newest observation backing a row. */
export function newestAgeSeconds(s: Sources, now: number): number {
  let newest = -Infinity;
  for (const o of s.observations) newest = Math.max(newest, o.sourceAt);
  return now - newest;
}

export class ProvenanceError extends Error {
  override readonly name = 'ProvenanceError';
}

/**
 * Throws unless every enumerated numeric field is a real, finite number.
 *
 * Called at the moment a candidate is constructed, not at render time, so a
 * malformed row is rejected with a recorded reason instead of reaching a screen
 * and instead of taking the process down.
 */
export function assertAllFinite(label: string, fields: Readonly<Record<string, number>>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ProvenanceError(`${label}.${key} is ${String(value)}, which is not a real number`);
    }
  }
}
