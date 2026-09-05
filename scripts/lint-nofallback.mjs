/**
 * Enforces the rule the whole project rests on: a missing value must never be
 * silently replaced with a number.
 *
 * `?? 0` is how a pipeline starts inventing data. It is always available, it
 * always compiles, and it turns "we don't know" into a confident figure that
 * reaches a screen indistinguishable from a measured one. So it is banned in the
 * engine, mechanically, rather than by good intentions.
 *
 * `?? []` and `?? null` are allowed: an empty collection and an explicit null
 * are honest representations of absence, and the code downstream treats them as
 * such.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['packages/core/src', 'packages/ingest/src', 'packages/server/src', 'packages/mcp/src'];

const BANNED = [
  { re: /\?\?\s*-?\d/g,           what: 'numeric ?? fallback' },
  { re: /\|\|\s*-?\d/g,           what: 'numeric || fallback' },
  { re: /\?\?\s*['"`]0['"`]/g,    what: 'string-zero fallback' },
  { re: /Number\([^)]*\)\s*\|\|/g, what: 'Number(...) || fallback' },
  { re: /isNaN\s*\(/g,            what: 'isNaN (use Number.isFinite and reject)' },
];

// An opt-out must say why, in the code, either on the line itself or on the
// line directly above it — the same place a reader will look.
const ALLOW = /nofallback-ok:/;
const allowed = (lines, i) => ALLOW.test(lines[i] ?? '') || ALLOW.test(lines[i - 1] ?? '');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

let violations = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const raw = readFileSync(file, 'utf8');
    // Blank out block comments before scanning, keeping line numbers intact, so
    // prose describing the rule is not reported as a violation of it.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const lines = src.split('\n');
    const rawLines = raw.split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (allowed(rawLines, i)) return;
      for (const { re, what } of BANNED) {
        re.lastIndex = 0;
        if (re.test(code)) {
          console.error(`${file}:${i + 1}  ${what}\n    ${rawLines[i].trim()}`);
          violations++;
        }
      }
    });
  }
}

if (violations > 0) {
  console.error(`\n${violations} fabrication risk(s). A missing value must be rejected with a reason, not defaulted.`);
  process.exit(1);
}
console.log(`no-fallback lint clean across ${ROOTS.length} packages`);
