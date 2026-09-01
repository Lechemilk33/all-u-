/**
 * Curbcut command line.
 *
 * Two jobs the web scanner cannot do: audit many pages in one run, and produce
 * a file you can hand to someone. Everything runs locally — there is no service
 * behind this and no per-scan cost.
 *
 * The static path cannot evaluate contrast, and the report says so rather than
 * reporting a clean result it did not earn. Where a rendered result is needed,
 * scan the page with the bookmarklet or the web app.
 */

import { readFile, writeFile } from 'node:fs/promises';
import {
  buildReport,
  machineTestableCriteria,
  ruleCriteriaFromAxe,
  suggestRegimes,
  BAND_LABEL,
  REGION_LABEL,
  type RegimeId,
  type Report,
} from '@curbcut/core';
import { scanUrl } from '@curbcut/scan/node';

export interface CliOptions {
  readonly urls: readonly string[];
  readonly regimes: readonly RegimeId[];
  readonly format: 'text' | 'json' | 'csv' | 'markdown';
  readonly out?: string;
  readonly concurrency: number;
  readonly quiet: boolean;
}

const HELP = `
curbcut — accessibility exposure scanning

  curbcut <url> [url...]            scan one or more pages
  curbcut --file urls.txt           scan every URL in a file, one per line

Options
  --jurisdiction <code>   US (default), US-PUBLIC, US-FEDERAL, EU, GB, CA
  --format <fmt>          text (default), json, csv, markdown
  --out <path>            write to a file instead of stdout
  --concurrency <n>       parallel scans, default 4
  --quiet                 suppress progress output on stderr
  --help                  this message

Notes
  This is a static scan: it reads the HTML the server sent without laying it
  out, so it cannot evaluate colour contrast — the most common failure on the
  web. Every report states its own coverage. For a full result, use the
  bookmarklet on the rendered page.

Examples
  curbcut https://example.com
  curbcut --file prospects.txt --format csv --out exposure.csv
  curbcut https://city.gov --jurisdiction US-PUBLIC --format markdown
`.trim();

/** Minimal argv parsing — no dependency worth adding for this. */
export function parseArgs(argv: readonly string[]): CliOptions | { help: true } {
  const urls: string[] = [];
  let jurisdiction = 'US';
  let format: CliOptions['format'] = 'text';
  let out: string | undefined;
  let concurrency = 4;
  let quiet = false;
  let file: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    else if (arg === '--quiet' || arg === '-q') quiet = true;
    else if (arg === '--jurisdiction') jurisdiction = argv[++i] ?? 'US';
    else if (arg === '--format') format = (argv[++i] ?? 'text') as CliOptions['format'];
    else if (arg === '--out') out = argv[++i];
    else if (arg === '--file') file = argv[++i];
    else if (arg === '--concurrency') concurrency = Math.max(1, Number(argv[++i]) || 4);
    else if (arg && !arg.startsWith('-')) urls.push(arg);
  }

  const opts: CliOptions & { file?: string } = {
    urls,
    regimes: suggestRegimes(jurisdiction),
    format,
    ...(out ? { out } : {}),
    concurrency,
    quiet,
    ...(file ? { file } : {}),
  };
  return opts;
}

const normalise = (raw: string): string =>
  /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;

export interface ScanOutcome {
  readonly url: string;
  readonly report?: Report;
  readonly error?: string;
}

async function scanOne(url: string, regimes: readonly RegimeId[]): Promise<ScanOutcome> {
  try {
    const result = await scanUrl(url, { level: 'AA' });
    // Coverage comes from the engine's full rule set, not from the rules that
    // fired here: a clean page must not report that it tested almost nothing.
    const report = buildReport({
      url: result.url,
      title: result.title,
      scannedAt: result.scannedAt,
      engine: result.engine,
      renderMode: result.renderMode,
      findings: result.findings,
      needsReview: result.needsReview,
      regimes,
      testableCriteria: machineTestableCriteria(ruleCriteriaFromAxe(result.engineRules), result.renderMode),
      ...(result.coverageWarning ? { coverageWarning: result.coverageWarning } : {}),
    });
    return { url, report };
  } catch (err) {
    return { url, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Runs `limit` scans at a time so a long list does not open 500 sockets. */
async function pool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      const item = items[i];
      if (i >= items.length || item === undefined) return;
      out[i] = await fn(item);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ----------------------------------------------------------- formatters */

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

function asText(results: readonly ScanOutcome[]): string {
  const lines: string[] = [];
  for (const r of results) {
    if (!r.report) {
      lines.push(`\n${r.url}\n  could not scan — ${r.error}`);
      continue;
    }
    const rep = r.report;
    lines.push('');
    lines.push(`${rep.host}  —  Exposure Index ${rep.exposure.index}/100 (${BAND_LABEL[rep.exposure.band]})`);
    lines.push('─'.repeat(72));
    lines.push(`  ${rep.headline}`);
    lines.push(`  ${rep.exposure.verdict.statement}`);
    if (rep.coverageWarning) lines.push(`  ! ${rep.coverageWarning}`);
    lines.push('');
    for (const e of rep.exhibits) {
      lines.push(
        `  ${e.rank}. ${pad(e.finding.ruleId, 24)} ${String(e.instances).padStart(4)} el  ` +
          `${pad(REGION_LABEL[e.node.region], 22)} ${String(Math.round(e.share * 100)).padStart(3)}%`,
      );
    }
    lines.push('');
    lines.push(`  Coverage: ${rep.coverage.criteriaMachineTestable}/${rep.coverage.criteriaInScope} Level AA criteria testable in this mode.`);
    for (const b of rep.coverage.blindSpots) lines.push(`    · ${b.title}`);
  }
  lines.push('');
  lines.push('Not legal advice. No automated result, from any vendor, is a compliance certificate.');
  return lines.join('\n');
}

function asCsv(results: readonly ScanOutcome[]): string {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['url', 'host', 'index', 'band', 'conforms_aa', 'failed_criteria', 'elements', 'blocking_elements', 'top_rule', 'render_mode', 'error'].join(','),
  ];
  for (const r of results) {
    const rep = r.report;
    rows.push(
      [
        q(r.url),
        q(rep?.host),
        rep?.exposure.index ?? '',
        q(rep ? BAND_LABEL[rep.exposure.band] : ''),
        rep ? rep.exposure.verdict.conforms : '',
        q(rep?.exposure.verdict.failedCriteria.join(' ')),
        rep?.exposure.totalInstances ?? '',
        rep?.exposure.blockingInstances ?? '',
        q(rep?.exhibits[0]?.finding.ruleId),
        q(rep?.coverage.renderMode),
        q(r.error),
      ].join(','),
    );
  }
  return rows.join('\n');
}

function asMarkdown(results: readonly ScanOutcome[]): string {
  const out: string[] = [];
  for (const r of results) {
    if (!r.report) {
      out.push(`## ${r.url}\n\nCould not scan — ${r.error}\n`);
      continue;
    }
    const rep = r.report;
    out.push(`## ${rep.host}\n`);
    out.push(`**Exposure Index ${rep.exposure.index}/100 — ${BAND_LABEL[rep.exposure.band]}**\n`);
    out.push(`${rep.headline}\n`);
    out.push(`${rep.summary}\n`);
    if (rep.exhibits.length) {
      out.push('### What a complaint would point at\n');
      out.push('| # | Rule | Elements | Where | Share |');
      out.push('|---|------|---------:|-------|------:|');
      for (const e of rep.exhibits) {
        out.push(`| ${e.rank} | \`${e.finding.ruleId}\` | ${e.instances} | ${REGION_LABEL[e.node.region]} | ${Math.round(e.share * 100)}% |`);
      }
      out.push('');
    }
    if (rep.remediation.length) {
      out.push('### Remediation, in order\n');
      for (const m of rep.remediation.slice(0, 6)) {
        out.push(`${m.rank}. **${m.title}** — ${m.instances} element(s), ${m.effort} of work`);
      }
      out.push('');
    }
    out.push(`### Coverage\n\n${rep.coverage.statement}\n`);
    for (const b of rep.coverage.blindSpots) out.push(`- **${b.title}.** ${b.detail}`);
    out.push('');
    out.push(`> ${rep.disclaimer}\n`);
  }
  return out.join('\n');
}

/* ---------------------------------------------------------------- main */

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    console.log(HELP);
    return 0;
  }

  const withFile = parsed as CliOptions & { file?: string };
  let urls = [...withFile.urls];

  if (withFile.file) {
    const text = await readFile(withFile.file, 'utf8');
    urls.push(
      ...text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#')),
    );
  }

  urls = [...new Set(urls.map(normalise))];

  if (urls.length === 0) {
    console.log(HELP);
    return 1;
  }

  let done = 0;
  const results = await pool(urls, withFile.concurrency, async (url) => {
    const outcome = await scanOne(url, withFile.regimes);
    done++;
    if (!withFile.quiet && urls.length > 1) {
      process.stderr.write(`\rScanned ${done}/${urls.length}`);
    }
    return outcome;
  });
  if (!withFile.quiet && urls.length > 1) process.stderr.write('\n');

  const ranked = [...results].sort(
    (a, b) => (b.report?.exposure.index ?? -1) - (a.report?.exposure.index ?? -1),
  );

  const rendered =
    withFile.format === 'json'
      ? JSON.stringify(ranked, null, 2)
      : withFile.format === 'csv'
        ? asCsv(ranked)
        : withFile.format === 'markdown'
          ? asMarkdown(ranked)
          : asText(ranked);

  if (withFile.out) {
    await writeFile(withFile.out, `${rendered}\n`, 'utf8');
    if (!withFile.quiet) console.error(`Wrote ${withFile.out}`);
  } else {
    console.log(rendered);
  }

  return results.some((r) => r.error) ? 2 : 0;
}
