# Tests

- `npm test` — engine unit tests (`packages/core/test`). No network, no browser.
- `node test/e2e.mjs` — full browser run: serves the built site, stands up a local
  stand-in for the fetch proxy, drives a real scan in Chromium and asserts the
  report renders. Requires `npm run build -w @curbcut/web` first.

`fixture.html` is a deliberately broken storefront. Every failure in it is
planted, including a contrast failure that only a rendered scan can see — that
one is the regression test for the whole rendered-DOM approach.

- `node test/bookmarklet.mjs` — injects `audit.js` into a deliberately hostile
  host page (aggressive global CSS, content built by script after load) and
  checks the panel mounts, stays isolated, finds the script-built content, and
  closes without residue.
- `node test/realworld.mjs [url...]` — scans real production sites through the
  real path. Network-dependent, so not part of CI.

The dogfood run also enforces WCAG 1.4.10 Reflow at 320 CSS pixels. axe cannot
decide that criterion, and we shipped a 500px-wide landing page once.
