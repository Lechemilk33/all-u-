import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUCCESS_CRITERIA, criteriaAtLevel, criterionFromAxeTag, criterionByNumber,
  REGIMES, deadlinesFor, bindingStandard, daysUntil,
  CRITERION_RISK, riskForCriteria, toFinding, scoreExposure, buildExhibits,
  bandFor, weighFinding, describeCoverage, machineTestableCriteria, ruleCriteriaFromAxe,
  RECIPES, recipeFor, buildReport, REGION_WEIGHT,
} from '../dist/index.js';

const node = (over = {}) => ({ target: ['#a'], html: '<img src=x>', region: 'main', ...over });
const rule = (over = {}) => ({
  id: 'image-alt', description: 'd', help: 'h', helpUrl: 'u',
  impact: 'critical', tags: ['wcag2a', 'wcag111'], nodes: [node()], ...over,
});

test('WCAG dataset is complete and internally consistent', () => {
  assert.equal(SUCCESS_CRITERIA.length, 87);
  assert.equal(new Set(SUCCESS_CRITERIA.map((s) => s.num)).size, 87);
  assert.equal(criteriaAtLevel('AA').length, 55, 'WCAG 2.2 AA is 55 criteria');
  assert.equal(criteriaAtLevel('A').length, 31);
  assert.ok(SUCCESS_CRITERIA.every((s) => /^https:\/\/www\.w3\.org\/WAI\/WCAG22\/Understanding\/[a-z0-9-]+$/.test(s.url)));
  assert.equal(criterionByNumber('4.1.1').obsolete, true);
});

test('axe tags resolve to the right criteria', () => {
  assert.equal(criterionFromAxeTag('wcag143').num, '1.4.3');
  assert.equal(criterionFromAxeTag('wcag2aa'), undefined);
  assert.equal(criterionFromAxeTag('best-practice'), undefined);
});

test('every risk entry names a real success criterion', () => {
  for (const r of CRITERION_RISK) assert.ok(criterionByNumber(r.sc), `unknown criterion ${r.sc}`);
});

test('risk selection prefers the more serious criterion', () => {
  assert.equal(riskForCriteria(['2.4.9', '1.4.3']).sc, '1.4.3');
  assert.equal(riskForCriteria([]).salience, 1, 'unknown criteria get a conservative default');
});

test('deadline arithmetic is timezone-stable', () => {
  const now = new Date('2026-09-01T23:30:00Z');
  assert.equal(daysUntil('2026-09-02', now), 1);
  assert.equal(daysUntil('2026-09-01', now), 0);
  assert.equal(daysUntil('2026-08-31', now), -1);
});

test('deadlines sort upcoming first, passed last', () => {
  const ds = deadlinesFor(REGIMES.map((r) => r.id), new Date('2026-09-01T00:00:00Z'));
  const firstPassed = ds.findIndex((d) => d.passed);
  assert.ok(firstPassed > 0);
  assert.ok(ds.slice(firstPassed).every((d) => d.passed));
});

test('binding standard takes the strictest of the selected regimes', () => {
  assert.deepEqual(bindingStandard(['section-508', 'eaa']), { wcag: '2.1', level: 'AA' });
  assert.deepEqual(bindingStandard(['section-508']), { wcag: '2.0', level: 'AA' });
  assert.deepEqual(bindingStandard([]), { wcag: '2.0', level: 'A' });
});

test('findings carry criteria, level and allegation', () => {
  const f = toFinding(rule());
  assert.deepEqual(f.criteria.map((c) => c.num), ['1.1.1']);
  assert.equal(f.level, 'A');
  assert.equal(f.salience, 5);
  assert.equal(f.bestPracticeOnly, false);
  assert.ok(f.allegation.length > 20);
});

test('best-practice rules are marked and excluded from scoring', () => {
  const f = toFinding(rule({ id: 'region', tags: ['best-practice'] }));
  assert.equal(f.bestPracticeOnly, true);
  assert.equal(f.level, null);
  assert.equal(scoreExposure([f]).index, 0);
});

test('obsolete criteria never produce a conformance failure', () => {
  const f = toFinding(rule({ id: 'duplicate-id', tags: ['wcag2a', 'wcag411'] }));
  assert.deepEqual(f.criteria, []);
  assert.equal(f.bestPracticeOnly, true);
});

test('region weighting makes checkout cost more than footer', () => {
  const checkout = weighFinding(toFinding(rule({ nodes: [node({ region: 'checkout' })] })));
  const footer = weighFinding(toFinding(rule({ nodes: [node({ region: 'footer' })] })));
  assert.ok(checkout > footer);
  const expected = REGION_WEIGHT.checkout / REGION_WEIGHT.footer;
  assert.ok(Math.abs(checkout / footer - expected) < 1e-9, 'ratio should track the region weights exactly');
});

test('volume has diminishing returns', () => {
  const one = weighFinding(toFinding(rule({ nodes: [node()] })));
  const hundred = weighFinding(toFinding(rule({ nodes: Array.from({ length: 100 }, () => node()) })));
  assert.ok(hundred < one * 100, 'a hundred failures must not score a hundred times one');
  assert.ok(hundred > one * 4);
});

test('index is bounded, monotonic, and banded', () => {
  assert.equal(scoreExposure([]).index, 0);
  assert.equal(scoreExposure([]).band, 'clean');
  const many = Array.from({ length: 60 }, (_, i) =>
    toFinding(rule({ id: `r${i}`, nodes: Array.from({ length: 40 }, () => node({ region: 'checkout' })) })));
  const big = scoreExposure(many);
  assert.ok(big.index <= 100 && big.index >= 95);
  assert.equal(bandFor(0), 'clean');
  assert.equal(bandFor(19), 'low');
  assert.equal(bandFor(44), 'elevated');
  assert.equal(bandFor(69), 'high');
  assert.equal(bandFor(70), 'severe');
});

test('a median WebAIM-profile page lands mid-band, not pinned to an extreme', () => {
  const mk = (id, tags, n, region) =>
    toFinding({ ...rule(), id, tags, nodes: Array.from({ length: n }, () => node({ region })) });
  const median = scoreExposure([
    mk('color-contrast', ['wcag2aa', 'wcag143'], 30, 'main'),
    mk('image-alt', ['wcag2a', 'wcag111'], 8, 'main'),
    mk('label', ['wcag2a', 'wcag412'], 5, 'form'),
    mk('link-name', ['wcag2a', 'wcag244', 'wcag412'], 6, 'navigation'),
    mk('button-name', ['wcag2a', 'wcag412'], 3, 'main'),
    mk('html-has-lang', ['wcag2a', 'wcag311'], 1, 'unknown'),
  ]);
  assert.ok(median.index >= 50 && median.index <= 70, `median page scored ${median.index}, expected 50–70`);
});

test('verdict fails on any A or AA criterion and lists them sorted', () => {
  const v = scoreExposure([
    toFinding(rule({ id: 'color-contrast', tags: ['wcag2aa', 'wcag143'] })),
    toFinding(rule()),
  ]).verdict;
  assert.equal(v.conforms, false);
  assert.deepEqual(v.failedCriteria, ['1.1.1', '1.4.3']);
});

test('AAA-only findings do not break AA conformance', () => {
  const v = scoreExposure([toFinding(rule({ id: 'color-contrast-enhanced', tags: ['wcag2aaa', 'wcag146'] }))], 'AA').verdict;
  assert.equal(v.conforms, true);
});

test('exhibits are ranked and pick the worst-region node', () => {
  const f = toFinding(rule({ nodes: [node({ region: 'footer' }), node({ region: 'checkout' })] }));
  const ex = buildExhibits(scoreExposure([f]));
  assert.equal(ex[0].node.region, 'checkout');
  assert.equal(ex[0].rank, 1);
  assert.equal(buildExhibits(scoreExposure([f]), 0).length, 0);
});

test('coverage shrinks when the engine cannot render', () => {
  const rc = ruleCriteriaFromAxe([
    { ruleId: 'color-contrast', tags: ['wcag143'] },
    { ruleId: 'image-alt', tags: ['wcag111'] },
    { ruleId: 'frame-focusable-content', tags: ['wcag211'] },
    { ruleId: 'scrollable-region-focusable', tags: ['wcag211'] },
  ]);
  const live = machineTestableCriteria(rc, 'live-dom');
  const stat = machineTestableCriteria(rc, 'static-html');
  assert.ok(live.has('1.4.3') && !stat.has('1.4.3'), 'contrast is untestable without layout');
  assert.ok(stat.has('2.1.1'), 'a criterion survives while any of its rules still runs');
  assert.ok(describeCoverage('static-html', 'AA', stat).blindSpots.length >
            describeCoverage('live-dom', 'AA', live).blindSpots.length);
});

test('every recipe matches a real axe rule id and has substance', () => {
  const ids = new Set(RECIPES.map((r) => r.ruleId));
  assert.equal(ids.size, RECIPES.length, 'no duplicate recipes');
  for (const r of RECIPES) {
    assert.ok(r.fix.length >= 2, `${r.ruleId} needs real steps`);
    assert.ok(r.pitfalls.length >= 1, `${r.ruleId} needs pitfalls`);
    assert.ok(r.problem.length > 40 && r.impact.length > 40);
  }
  assert.equal(recipeFor('image-alt').effort, 'hours');
  assert.equal(recipeFor('nope'), undefined);
});

test('report assembles end to end and never omits the disclaimer', () => {
  const rep = buildReport({
    url: 'https://shop.example/checkout', title: 'Checkout', scannedAt: '2026-09-01T00:00:00.000Z',
    engine: 'axe-core 4.13.0', renderMode: 'static-html',
    findings: [toFinding(rule({ nodes: [node({ region: 'checkout' })] }))],
    needsReview: [], regimes: ['ada-title-iii'],
    testableCriteria: new Set(['1.1.1']),
  });
  assert.equal(rep.host, 'shop.example');
  assert.ok(rep.headline.includes('shop.example'));
  assert.ok(rep.disclaimer.includes('not legal advice'));
  assert.equal(rep.standard.level, 'AA');
  assert.equal(rep.exhibits.length, 1);
  assert.ok(rep.sources.length >= 5);
});

test('a clean page reports clean without claiming compliance', () => {
  const rep = buildReport({
    url: 'https://clean.example/', title: 'Clean', scannedAt: '2026-09-01T00:00:00.000Z',
    engine: 'axe-core 4.13.0', renderMode: 'live-dom', findings: [], needsReview: [],
    regimes: ['eaa'], testableCriteria: new Set(['1.1.1']),
  });
  assert.equal(rep.exposure.index, 0);
  assert.equal(rep.exposure.verdict.conforms, true);
  assert.ok(/not a conformance claim/i.test(rep.exposure.verdict.statement));
  assert.ok(/does not mean the site is accessible/i.test(rep.disclaimer));
});
