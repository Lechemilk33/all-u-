# Tests

- `npm test` — engine unit tests (`packages/core/test`). No network, no browser.
- `node test/e2e.mjs` — full browser run: serves the built site, stands up a local
  stand-in for the fetch proxy, drives a real scan in Chromium and asserts the
  report renders. Requires `npm run build -w @curbcut/web` first.

`fixture.html` is a deliberately broken storefront. Every failure in it is
planted, including a contrast failure that only a rendered scan can see — that
one is the regression test for the whole rendered-DOM approach.
