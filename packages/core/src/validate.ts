import type { Candidate } from './types.js';

/**
 * A suggestion as emitted by a model.
 *
 * Every field is `unknown` on arrival. A model's output is untrusted input in
 * exactly the way a form post is untrusted input, and it is parsed rather than
 * believed.
 */
export interface RawSuggestion {
  readonly [key: string]: unknown;
}

export interface Suggestion {
  readonly itemId: number;
  readonly action: 'buy' | 'skip';
  readonly buyAt: number;
  readonly sellAt: number;
  readonly quantity: number;
  readonly confidence: number;
  readonly reasoning: string;
}

export type ValidationResult =
  | { ok: true; suggestion: Suggestion; candidate: Candidate }
  | { ok: false; errors: readonly string[] };

/**
 * Check a model's suggestion against the candidate set it was given.
 *
 * This is the enforcement point for "the AI never makes anything up". The model
 * is not trusted to report prices, quantities, or item names; it is trusted only
 * to *choose among rows we computed*. Anything it says about a row is either
 * identical to what we already hold or the suggestion is rejected outright.
 *
 * Concretely this catches: an item id that was never in the candidate set, a
 * hallucinated item name, a buy price outside the observed spread, a quantity
 * above what the buy limit / volume / cash allows, and an invented confidence
 * scale. Prose in `reasoning` is the only field the model authors freely, and it
 * is never parsed for numbers.
 */
export function validateSuggestion(raw: RawSuggestion, offered: readonly Candidate[]): ValidationResult {
  const errors: string[] = [];
  const byId = new Map(offered.map((c) => [c.item.id, c]));

  const itemId = raw['item_id'];
  if (typeof itemId !== 'number' || !Number.isInteger(itemId)) {
    return { ok: false, errors: [`item_id must be an integer, got ${JSON.stringify(itemId)}`] };
  }
  const candidate = byId.get(itemId);
  if (candidate === undefined) {
    return {
      ok: false,
      errors: [`item_id ${itemId} was not in the candidate set; the model may only choose from rows it was given`],
    };
  }

  // If the model echoed a name, it must match ours exactly. This is the check
  // that would have caught a table claiming id 21326 is "Nature impling jar"
  // when /mapping says it is "Amethyst arrow".
  const name = raw['name'];
  if (name !== undefined && name !== candidate.item.name) {
    errors.push(`name "${String(name)}" does not match /mapping name "${candidate.item.name}" for id ${itemId}`);
  }

  const action = raw['action'];
  if (action !== 'buy' && action !== 'skip') {
    errors.push(`action must be "buy" or "skip", got ${JSON.stringify(action)}`);
  }

  const buyAt = numberField(raw, 'buy_at', errors);
  const sellAt = numberField(raw, 'sell_at', errors);
  const quantity = numberField(raw, 'qty', errors);
  const confidence = numberField(raw, 'confidence', errors);

  if (buyAt !== null) {
    // A buy offer must sit between the last instant-sell and the last
    // instant-buy. Outside that band the model has invented a price.
    if (buyAt < candidate.quotedBuy || buyAt > candidate.quotedSell) {
      errors.push(
        `buy_at ${buyAt} is outside the observed spread ${candidate.quotedBuy}–${candidate.quotedSell}`,
      );
    }
  }
  if (sellAt !== null) {
    if (sellAt < candidate.quotedBuy || sellAt > candidate.quotedSell) {
      errors.push(
        `sell_at ${sellAt} is outside the observed spread ${candidate.quotedBuy}–${candidate.quotedSell}`,
      );
    }
  }
  if (buyAt !== null && sellAt !== null && sellAt <= buyAt) {
    errors.push(`sell_at ${sellAt} must exceed buy_at ${buyAt}`);
  }
  if (quantity !== null) {
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push(`qty must be a non-negative integer, got ${quantity}`);
    } else if (quantity > candidate.tradeableUnits) {
      errors.push(
        `qty ${quantity} exceeds the ${candidate.tradeableUnits} units permitted by ${candidate.limitedBy}`,
      );
    }
  }
  if (confidence !== null && (confidence < 0 || confidence > 1)) {
    errors.push(`confidence must be within 0–1, got ${confidence}`);
  }

  const reasoning = raw['reasoning'];
  if (typeof reasoning !== 'string' || reasoning.trim() === '') {
    errors.push('reasoning must be a non-empty string');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    candidate,
    suggestion: {
      itemId,
      action: action as 'buy' | 'skip',
      buyAt: buyAt as number,
      sellAt: sellAt as number,
      quantity: quantity as number,
      confidence: confidence as number,
      reasoning: reasoning as string,
    },
  };
}

function numberField(raw: RawSuggestion, key: string, errors: string[]): number | null {
  const v = raw[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${key} must be a finite number, got ${JSON.stringify(v)}`);
    return null;
  }
  return v;
}
