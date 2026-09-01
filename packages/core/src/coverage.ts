/**
 * What the scan could and could not see.
 *
 * The FTC's 2025 action against accessiBe was about a vendor overstating what
 * its automated tool established. Curbcut states its own limits on the face of
 * every report, in the same type size as the score:
 *
 *  1. Automated testing reaches roughly a third of the WCAG success criteria.
 *     No automated tool can decide whether alt text is *accurate*, whether a
 *     heading is *meaningful*, or whether a flow is *usable*.
 *  2. A static scan of served HTML cannot compute colour or layout at all, so
 *     it cannot evaluate contrast — the single most common real-world failure.
 *
 * A tool that hides (2) reports a clean page that is not clean. So the render
 * mode travels with the result and the report renders `blindSpots` verbatim.
 */

import { SUCCESS_CRITERIA, criteriaAtLevel, type ConformanceLevel } from './wcag.js';

export type RenderMode = 'static-html' | 'rendered-dom' | 'live-dom';

export const RENDER_MODE_LABEL: Readonly<Record<RenderMode, string>> = {
  'static-html': 'Static HTML — the markup the server sent, not laid out',
  'rendered-dom': 'Rendered HTML — served markup with real styles and layout applied',
  'live-dom': 'Live page — the fully scripted page as a visitor sees it',
};

/** Rule families that need real layout and computed style to evaluate. */
const NEEDS_RENDERING = [
  'color-contrast',
  'color-contrast-enhanced',
  'link-in-text-block',
  'target-size',
  'scrollable-region-focusable',
  'css-orientation-lock',
  'avoid-inline-spacing',
  'meta-viewport-large',
] as const;

/** Rule families that need the page's own scripts to have run. */
const NEEDS_SCRIPTING = [
  'aria-dialog-name',
  'aria-hidden-focus',
  'nested-interactive',
  'frame-tested',
] as const;

export interface BlindSpot {
  readonly title: string;
  readonly detail: string;
  readonly affectedRules: readonly string[];
}

export interface Coverage {
  readonly renderMode: RenderMode;
  readonly renderModeLabel: string;
  /** Success criteria in scope at the target level. */
  readonly criteriaInScope: number;
  /**
   * Criteria any automated engine can meaningfully test. The widely cited figure
   * is that automation detects on the order of a third of WCAG issues; this is
   * the count of criteria axe-core carries at least one rule for.
   */
  readonly criteriaMachineTestable: number;
  readonly machineTestableShare: number;
  readonly blindSpots: readonly BlindSpot[];
  /** One-paragraph statement for the top of a report. */
  readonly statement: string;
}

/** Rules a given render mode cannot evaluate at all. */
export function unavailableRules(mode: RenderMode): ReadonlySet<string> {
  const out = new Set<string>();
  if (mode === 'static-html') for (const r of NEEDS_RENDERING) out.add(r);
  if (mode !== 'live-dom') for (const r of NEEDS_SCRIPTING) out.add(r);
  return out;
}

/** One engine rule and the success criteria it decides. */
export interface RuleCriteria {
  readonly ruleId: string;
  readonly criteria: readonly string[];
}

/** Turns axe's rule metadata into `{ruleId, criteria}` pairs. */
export function ruleCriteriaFromAxe(
  rules: readonly { readonly ruleId: string; readonly tags: readonly string[] }[],
): RuleCriteria[] {
  return rules.map((r) => ({
    ruleId: r.ruleId,
    criteria: r.tags
      .map((t) => /^wcag(\d{3,4})$/.exec(t)?.[1])
      .filter((d): d is string => !!d)
      .map((d) => SUCCESS_CRITERIA.find((c) => c.tag === d))
      .filter((c): c is (typeof SUCCESS_CRITERIA)[number] => !!c && !c.obsolete)
      .map((c) => c.num),
  }));
}

/**
 * Success criteria the engine can decide *in this render mode*. A criterion
 * counts only while at least one rule covering it can still run — so contrast
 * drops out of a static scan, while 2.1.1 survives it on the strength of the
 * rules that do not need layout.
 */
export function machineTestableCriteria(
  ruleCriteria: readonly RuleCriteria[],
  mode: RenderMode = 'live-dom',
): Set<string> {
  const blocked = unavailableRules(mode);
  const out = new Set<string>();
  for (const rule of ruleCriteria) {
    if (blocked.has(rule.ruleId)) continue;
    for (const sc of rule.criteria) out.add(sc);
  }
  return out;
}

export function describeCoverage(
  renderMode: RenderMode,
  target: ConformanceLevel,
  testableCriteria: ReadonlySet<string>,
): Coverage {
  const inScope = criteriaAtLevel(target);
  const testableInScope = inScope.filter((sc) => testableCriteria.has(sc.num)).length;
  const share = inScope.length > 0 ? testableInScope / inScope.length : 0;

  const blindSpots: BlindSpot[] = [
    {
      title: 'Automated testing cannot judge meaning',
      detail:
        'A rule can tell that an image has alt text. It cannot tell whether the alt text describes the image, whether a heading describes the section beneath it, or whether a form can actually be completed. Those failures are found by a person, and they are the ones that decide cases.',
      affectedRules: [],
    },
  ];

  if (renderMode === 'static-html') {
    blindSpots.unshift({
      title: 'Colour contrast was not evaluated',
      detail:
        'This scan read the HTML the server sent without laying it out, so no colour or size could be computed. Low contrast is the most common failure on the web — present on 83.9% of home pages in the WebAIM Million — and it is invisible to this mode. Treat a clean contrast result here as "not tested", not as "passed".',
      affectedRules: [...NEEDS_RENDERING],
    });
  }

  if (renderMode !== 'live-dom') {
    blindSpots.push({
      title: "The page's own JavaScript did not run",
      detail:
        'Menus, modals, carousels, cart drawers and validation messages built at runtime were not present to be tested. On a client-rendered site most of the interface is missing from this result. The browser extension tests the page as a visitor actually receives it.',
      affectedRules: [...NEEDS_SCRIPTING],
    });
  }

  return {
    renderMode,
    renderModeLabel: RENDER_MODE_LABEL[renderMode],
    criteriaInScope: inScope.length,
    criteriaMachineTestable: testableInScope,
    machineTestableShare: Math.round(share * 100) / 100,
    blindSpots,
    statement:
      `This scan tested ${testableInScope} of the ${inScope.length} WCAG 2.2 Level ${target} success criteria — ` +
      `the ${Math.round(share * 100)}% an automated engine can decide on its own. ` +
      `Everything it found is real. What it did not find is not evidence of compliance, and no automated result, from any vendor, is a compliance certificate.`,
  };
}
