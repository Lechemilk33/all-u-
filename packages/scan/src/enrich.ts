/**
 * Works out where on a page a failing element sits.
 *
 * This is the input that lets the exposure model tell a broken checkout button
 * apart from a broken footer link. It runs against a live DOM (extension,
 * bookmarklet) or a parsed one (CLI), so it uses nothing but standard DOM APIs.
 */

import type { Region } from '@curbcut/core';

/** Attribute values worth reading when guessing what a container is for. */
const HINT_ATTRS = ['id', 'class', 'name', 'action', 'href', 'aria-label', 'data-testid'] as const;

const CHECKOUT_RE = /\b(checkout|cart|basket|payment|billing|shipping|order-summary|place-?order|add-to-(cart|bag)|purchase)\b/i;
const AUTH_RE = /\b(login|log-in|signin|sign-in|signup|sign-up|register|registration|create-account|my-account|password|forgot)\b/i;
const SEARCH_RE = /\b(search|autocomplete|typeahead)\b/i;

function hintText(el: Element): string {
  let s = el.tagName.toLowerCase();
  for (const attr of HINT_ATTRS) {
    const v = el.getAttribute(attr);
    if (v) s += ` ${v}`;
  }
  return s;
}

/**
 * Walks ancestors from the element to the document root and returns the most
 * consequential region it sits inside. Checkout beats auth beats form beats
 * navigation, because that is the order in which failures cost money.
 */
export function regionOf(el: Element, pageUrl?: string): Region {
  const path: Element[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) path.push(node);

  let sawForm = false;
  let sawNav = false;
  let sawFooter = false;
  let sawMain = false;

  for (const node of path) {
    const tag = node.tagName.toLowerCase();
    const role = node.getAttribute('role')?.toLowerCase() ?? '';
    const hint = hintText(node);

    if (CHECKOUT_RE.test(hint)) return 'checkout';
    if (AUTH_RE.test(hint)) return 'auth';

    if (tag === 'form' || role === 'form') sawForm = true;
    if (tag === 'nav' || tag === 'header' || role === 'navigation' || role === 'banner') sawNav = true;
    if (tag === 'footer' || role === 'contentinfo') sawFooter = true;
    if (tag === 'main' || role === 'main') sawMain = true;
  }

  // Structural landmarks win over the URL hint. A navigation link is navigation
  // wherever it appears, and a footer is a footer even on a checkout page —
  // treating a whole page as "checkout" because of its path would inflate the
  // score of every chrome element on it.
  if (sawFooter) return 'footer';
  if (sawNav) return 'navigation';

  // Only now does the page's own URL disambiguate markup that is otherwise
  // generic: a bare <div> wrapper on /checkout really is checkout content.
  if (pageUrl) {
    if (CHECKOUT_RE.test(pageUrl)) return 'checkout';
    if (AUTH_RE.test(pageUrl)) return 'auth';
  }

  if (sawForm && !SEARCH_RE.test(hintText(el))) return 'form';
  if (sawMain) return 'main';
  return 'unknown';
}

/** Short visible label for an element, used as evidence in reports. */
export function visibleLabelOf(el: Element): string | undefined {
  const own = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (own) return own.slice(0, 120);

  const aria = el.getAttribute('aria-label')?.trim();
  if (aria) return aria.slice(0, 120);

  const alt = el.getAttribute('alt')?.trim();
  if (alt) return alt.slice(0, 120);

  const placeholder = el.getAttribute('placeholder')?.trim();
  if (placeholder) return placeholder.slice(0, 120);

  const parentText = (el.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return parentText ? parentText.slice(0, 120) : undefined;
}

/**
 * Resolves an axe target selector back to its element so it can be classified.
 * axe targets are arrays that descend through shadow roots; Curbcut only needs
 * the light-DOM case, and falls back to `unknown` rather than guessing.
 */
export function resolveTarget(doc: Document, target: readonly unknown[]): Element | null {
  const flat = target.flat(Infinity).filter((t): t is string => typeof t === 'string');
  const selector = flat[flat.length - 1];
  if (!selector) return null;
  try {
    return doc.querySelector(selector);
  } catch {
    return null;
  }
}
