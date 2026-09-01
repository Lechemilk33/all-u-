/**
 * Removes every executable thing from fetched HTML before it is put in a frame.
 *
 * The scanner needs the page laid out with real styles so it can measure colour
 * and size. It does not need — and must not run — the page's own JavaScript:
 * the markup comes from an arbitrary third-party URL, and the frame it lands in
 * is same-origin with Curbcut.
 *
 * Parsing with DOMParser rather than regex matters here. DOMParser does not
 * execute anything while parsing, and it resolves the tag soup the same way a
 * browser would, so a `<scr<script>ipt>` style break-out cannot survive it.
 */

export interface SanitizeResult {
  readonly html: string;
  readonly removedScripts: number;
  readonly removedHandlers: number;
}

/** Attributes that execute code, beyond the on* family. */
const DANGEROUS_ATTRS = ['srcdoc', 'formaction', 'ping'];

const isJavascriptUrl = (value: string): boolean =>
  /^\s*(javascript|data\s*:\s*text\/html|vbscript)\s*:/i.test(value);

export function sanitizeForScan(rawHtml: string, baseUrl: string): SanitizeResult {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  let removedScripts = 0;
  let removedHandlers = 0;

  for (const el of Array.from(doc.querySelectorAll('script, noscript template'))) {
    el.remove();
    removedScripts++;
  }

  // Anything that can fetch and run more code, or navigate the frame away.
  for (const el of Array.from(doc.querySelectorAll('meta[http-equiv]'))) {
    if (/refresh/i.test(el.getAttribute('http-equiv') ?? '')) el.remove();
  }
  for (const el of Array.from(doc.querySelectorAll('base'))) el.remove();

  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        removedHandlers++;
        continue;
      }
      if (DANGEROUS_ATTRS.includes(name)) {
        el.removeAttribute(attr.name);
        removedHandlers++;
        continue;
      }
      if ((name === 'href' || name === 'src' || name === 'action') && isJavascriptUrl(attr.value)) {
        el.removeAttribute(attr.name);
        removedHandlers++;
      }
    }
  }

  // Frames inside the scanned page would load third-party origins we did not
  // ask for. The scan is of this document, so they go.
  for (const el of Array.from(doc.querySelectorAll('iframe, frame, object, embed'))) {
    const placeholder = doc.createElement('div');
    // Keep the element's box so layout — and therefore contrast — stays honest.
    placeholder.setAttribute('data-curbcut-removed', el.tagName.toLowerCase());
    const title = el.getAttribute('title');
    if (title) placeholder.setAttribute('data-title', title);
    el.replaceWith(placeholder);
  }

  // A <base> makes the page's own relative stylesheets, fonts and images resolve
  // against the origin site so it renders as its visitors see it.
  const base = doc.createElement('base');
  base.setAttribute('href', baseUrl);
  doc.head.insertBefore(base, doc.head.firstChild);

  // Content-Security-Policy meta tags from the origin would block our own
  // injected engine. The frame carries no privileges worth protecting with them.
  for (const el of Array.from(doc.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]'))) {
    el.remove();
  }

  return {
    html: `<!doctype html>\n${doc.documentElement.outerHTML}`,
    removedScripts,
    removedHandlers,
  };
}
