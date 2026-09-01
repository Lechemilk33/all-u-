/**
 * How a WCAG failure translates into legal risk.
 *
 * Two things drive the model, and they are deliberately kept apart:
 *
 *  - `salience`  — how often this failure type actually shows up in demand
 *                  letters and filed complaints. Some criteria are cited in
 *                  nearly every complaint; others are real accessibility
 *                  problems that essentially never appear in litigation.
 *  - `blocking`  — whether the failure stops a user finishing a task. This is
 *                  the fact pattern that decides cases, independent of how
 *                  fashionable the criterion is.
 *
 * A high-salience, high-blocking failure on a checkout button is the finding
 * that costs money. A low-salience, non-blocking failure in a footer is not,
 * and a report that treats them alike is why most scanners get ignored.
 */

/** 0–5. Frequency with which the criterion is named in accessibility complaints. */
export type Salience = 0 | 1 | 2 | 3 | 4 | 5;

/** Whether the failure can prevent task completion for an affected user. */
export type Blocking = 'blocks' | 'impairs' | 'degrades';

export interface CriterionRisk {
  readonly sc: string;
  readonly salience: Salience;
  readonly blocking: Blocking;
  /** What a plaintiff actually alleges when this shows up. */
  readonly allegation: string;
}

/**
 * Salience is graded from the public record of US web accessibility litigation
 * and the enforcement actions summarised in `SOURCES` below: 1.1.1 is the most
 * frequently pleaded criterion, followed by the criteria covering form labels,
 * accessible names, contrast and keyboard operability. Criteria that are rarely
 * or never pleaded are scored 0–1 even where they are genuine failures.
 */
export const CRITERION_RISK: readonly CriterionRisk[] = [
  { sc: '1.1.1', salience: 5, blocking: 'blocks', allegation: 'Images conveying information — product photos, icon-only controls, promotional banners — are announced as nothing, or as a filename, so a screen reader user cannot identify them.' },
  { sc: '4.1.2', salience: 5, blocking: 'blocks', allegation: 'Buttons, links and form controls have no accessible name, so a screen reader announces "button" with no indication of what it does.' },
  { sc: '1.3.1', salience: 5, blocking: 'blocks', allegation: 'Form fields are not programmatically associated with their labels, and structure is conveyed only visually, so the page is unusable without sight.' },
  { sc: '1.4.3', salience: 5, blocking: 'impairs', allegation: 'Body text, prices and error messages fall below the 4.5:1 contrast minimum and cannot be read by users with low vision.' },
  { sc: '2.4.4', salience: 4, blocking: 'impairs', allegation: 'Links have no discernible text or read only as "click here", so a screen reader user navigating by link list cannot tell where any link goes.' },
  { sc: '2.1.1', salience: 4, blocking: 'blocks', allegation: 'Interactive content cannot be reached or operated with a keyboard alone, excluding users who cannot use a mouse.' },
  { sc: '3.3.2', salience: 4, blocking: 'blocks', allegation: 'Form fields give no label or instruction, so a user cannot determine what to enter — pleaded most often against checkout and account creation flows.' },
  { sc: '2.4.1', salience: 3, blocking: 'impairs', allegation: 'No skip link or landmark structure, forcing screen reader users through the entire navigation on every page.' },
  { sc: '3.1.1', salience: 3, blocking: 'impairs', allegation: 'The page declares no language, so screen readers mispronounce the content, in some cases unintelligibly.' },
  { sc: '2.4.2', salience: 3, blocking: 'impairs', allegation: 'Pages have no title or a duplicated title, so users cannot distinguish tabs or orient themselves in history.' },
  { sc: '1.4.11', salience: 3, blocking: 'impairs', allegation: 'Control boundaries, focus indicators and icon graphics fall below 3:1 contrast, making the interface unusable at low vision.' },
  { sc: '2.1.2', salience: 3, blocking: 'blocks', allegation: 'Keyboard focus enters a component — commonly a modal or embedded player — and cannot be moved out, trapping the user on the page.' },
  { sc: '3.3.1', salience: 3, blocking: 'blocks', allegation: 'Form errors are signalled only by colour or only visually, so a user cannot tell which field failed or why.' },
  { sc: '2.4.7', salience: 3, blocking: 'blocks', allegation: 'Keyboard focus is invisible, so a sighted keyboard user cannot tell what is selected while navigating.' },
  { sc: '1.2.2', salience: 3, blocking: 'blocks', allegation: 'Video content has no captions, excluding deaf and hard-of-hearing users — pleaded frequently against media, education and hospitality sites.' },
  { sc: '4.1.3', salience: 2, blocking: 'impairs', allegation: 'Dynamic updates — cart totals, validation, search results — are not announced, so a screen reader user does not learn the page changed.' },
  { sc: '1.4.4', salience: 2, blocking: 'impairs', allegation: 'The viewport blocks zoom, so users who magnify text cannot enlarge the page.' },
  { sc: '1.4.10', salience: 2, blocking: 'impairs', allegation: 'Content requires two-dimensional scrolling at 320 CSS pixels, breaking the page for magnifier and small-screen users.' },
  { sc: '2.5.3', salience: 2, blocking: 'impairs', allegation: 'A control\'s visible label does not appear in its accessible name, so voice control users cannot activate it by saying what they see.' },
  { sc: '1.4.1', salience: 2, blocking: 'impairs', allegation: 'Colour alone conveys meaning — required fields, link text, status — which colour-blind users cannot perceive.' },
  { sc: '1.2.1', salience: 2, blocking: 'blocks', allegation: 'Audio-only or video-only content has no text alternative.' },
  { sc: '1.3.5', salience: 2, blocking: 'degrades', allegation: 'Common inputs lack autocomplete tokens, defeating assistive autofill for users with motor and cognitive disabilities.' },
  { sc: '2.5.8', salience: 2, blocking: 'impairs', allegation: 'Touch targets fall below the 24 by 24 CSS pixel minimum, making the interface unusable for users with tremor or limited dexterity.' },
  { sc: '1.4.2', salience: 2, blocking: 'impairs', allegation: 'Audio plays automatically for more than three seconds with no way to stop it, drowning out screen reader speech.' },
  { sc: '2.2.1', salience: 2, blocking: 'blocks', allegation: 'A time limit cannot be extended or turned off, cutting off users who need longer to read or type.' },
  { sc: '2.2.2', salience: 2, blocking: 'impairs', allegation: 'Moving or auto-updating content cannot be paused, which is disabling for users with attention and vestibular conditions.' },
  { sc: '1.3.4', salience: 1, blocking: 'impairs', allegation: 'Content is locked to one display orientation, excluding users with a fixed-mount device.' },
  { sc: '3.1.2', salience: 1, blocking: 'degrades', allegation: 'Foreign-language passages are not marked, so a screen reader reads them in the wrong voice.' },
  { sc: '2.4.9', salience: 1, blocking: 'degrades', allegation: 'Identically named links lead to different destinations.' },
  { sc: '1.4.6', salience: 0, blocking: 'degrades', allegation: 'Contrast does not meet the enhanced AAA threshold. Not required by any regime Curbcut tracks.' },
  { sc: '2.2.4', salience: 0, blocking: 'degrades', allegation: 'Interruptions cannot be postponed. AAA only.' },
  { sc: '3.2.5', salience: 0, blocking: 'degrades', allegation: 'Context changes are not solely user-initiated. AAA only.' },
  { sc: '2.1.3', salience: 0, blocking: 'degrades', allegation: 'Keyboard operability without exception. AAA only.' },
  { sc: '4.1.1', salience: 0, blocking: 'degrades', allegation: 'Parsing. Obsolete in WCAG 2.2 and no longer a conformance failure.' },
] as const;

const RISK_BY_SC = new Map(CRITERION_RISK.map((r) => [r.sc, r]));

const DEFAULT_RISK: CriterionRisk = {
  sc: '',
  salience: 1,
  blocking: 'degrades',
  allegation: 'A conformance failure against this criterion.',
};

export function riskForCriterion(sc: string): CriterionRisk {
  return RISK_BY_SC.get(sc) ?? { ...DEFAULT_RISK, sc };
}

/** The worst risk across the criteria a single rule maps to. */
export function riskForCriteria(scs: readonly string[]): CriterionRisk {
  const order: Record<Blocking, number> = { degrades: 0, impairs: 1, blocks: 2 };
  let best: CriterionRisk | undefined;
  for (const sc of scs) {
    const r = riskForCriterion(sc);
    if (
      !best ||
      r.salience > best.salience ||
      (r.salience === best.salience && order[r.blocking] > order[best.blocking])
    ) {
      best = r;
    }
  }
  return best ?? DEFAULT_RISK;
}

/**
 * Population benchmarks from the WebAIM Million, February 2026 — an automated
 * scan of the home pages of the top one million domains. Used to tell a site
 * owner where they sit relative to the web, which is the only comparison that
 * makes an absolute error count mean anything.
 */
export const BENCHMARK_2026 = {
  label: 'WebAIM Million, February 2026',
  url: 'https://webaim.org/projects/million/',
  /** Share of home pages with at least one detectable WCAG 2 failure. */
  pagesWithFailures: 0.959,
  /** Mean detectable errors per home page. */
  meanErrorsPerPage: 56.1,
  /** Share of home pages exhibiting each failure category. */
  categoryPrevalence: {
    'low-contrast': 0.839,
    'missing-alt-text': 0.531,
    'missing-form-label': 0.51,
    'empty-link': 0.463,
    'empty-button': 0.306,
    'missing-document-language': 0.135,
  },
  /** These six categories account for roughly this share of all errors found. */
  shareOfAllErrors: 0.96,
} as const;

export type BenchmarkCategory = keyof typeof BENCHMARK_2026.categoryPrevalence;

/** Maps an axe rule to the WebAIM failure category it belongs to, when it has one. */
export const RULE_TO_BENCHMARK: Readonly<Record<string, BenchmarkCategory>> = {
  'color-contrast': 'low-contrast',
  'image-alt': 'missing-alt-text',
  'input-image-alt': 'missing-alt-text',
  'area-alt': 'missing-alt-text',
  'role-img-alt': 'missing-alt-text',
  'svg-img-alt': 'missing-alt-text',
  'object-alt': 'missing-alt-text',
  label: 'missing-form-label',
  'select-name': 'missing-form-label',
  'aria-input-field-name': 'missing-form-label',
  'aria-toggle-field-name': 'missing-form-label',
  'link-name': 'empty-link',
  'button-name': 'empty-button',
  'input-button-name': 'empty-button',
  'aria-command-name': 'empty-button',
  'html-has-lang': 'missing-document-language',
  'html-lang-valid': 'missing-document-language',
};

/**
 * Rule-level phrasing that beats the criterion-level default.
 *
 * The weight always comes from the criterion. This only changes the sentence
 * shown to a reader, for rules whose failure is narrower than the criterion
 * that carries them — a nameless link and a nameless <select> both fail 4.1.2,
 * and a reader is better served hearing about the one in front of them.
 */
export const RULE_ALLEGATION: Readonly<Record<string, string>> = {
  'link-name': 'Links have no discernible text, so a screen reader user navigating by link list hears only "link" and cannot tell where any of them go.',
  'button-name': 'Buttons have no accessible name and are announced only as "button" — commonly a modal close control, which leaves the user with no way out of the dialog.',
  'input-button-name': 'Submit and reset buttons have no accessible name, so a user cannot tell what submitting the form will do.',
  'select-name': 'A select control has no accessible name, so its options can be heard but the choice they represent cannot.',
  'frame-title': 'An embedded frame has no title, so it is announced only as "frame". Where the frame is a payment field, checkout becomes opaque.',
  'aria-input-field-name': 'A custom input — combobox, listbox, slider — has no accessible name, so the control is announced by its role alone.',
  'image-alt': 'Images conveying information — product photos, icon-only controls, promotional banners — are announced as nothing, or as a filename, so a screen reader user cannot identify them.',
  'input-image-alt': 'An image used as a submit button has no alternative text, so the action it performs cannot be determined before pressing it.',
  'area-alt': 'Image map areas have no alternative text, making the regions of the image unnavigable.',
  'html-has-lang': 'The page declares no language, so screen readers fall back to a default voice and may render the content unintelligibly.',
  'label': 'Form fields are not programmatically associated with their labels, so a screen reader announces "edit, blank" and the user cannot tell what to enter.',
  'document-title': 'The page has no title, so users cannot tell where they have landed or distinguish it in tabs and history.',
  'bypass': 'There is no skip link and no landmark structure, forcing keyboard and screen reader users through the entire navigation before reaching content on every page.',
  'meta-viewport': 'The viewport blocks zoom, so users who magnify text cannot enlarge the page on a mobile device.',
};

/**
 * Observed market rates, in USD, for what happens after a complaint lands.
 * Ranges, never point estimates — the report presents them as the market
 * numbers they are, attributed, and never as a prediction about this site.
 */
export const MARKET_RATES = {
  demandLetterResponse: { low: 3_000, high: 15_000, label: 'Responding to a demand letter and negotiating a settlement' },
  typicalSettlement: { low: 15_000, high: 50_000, label: 'Typical settlement in a filed web accessibility case', note: 'Reported averages cluster near $30,000.' },
  litigatedTotal: { low: 60_000, high: 200_000, label: 'Settlement plus defence costs where a case is contested' },
  manualAudit: { low: 2_500, high: 10_000, label: 'Professional manual audit of a production site' },
  monitoring: { low: 200, high: 1_000, label: 'Ongoing monitoring, per month' },
} as const;

export const SOURCES: readonly { readonly id: string; readonly label: string; readonly url: string }[] = [
  { id: 'webaim-million', label: 'WebAIM Million 2026 — accessibility of the top 1,000,000 home pages', url: 'https://webaim.org/projects/million/' },
  { id: 'doj-title-ii', label: 'US DOJ final rule on Title II web accessibility, 89 FR 31320', url: 'https://www.ecfr.gov/current/title-28/chapter-I/part-35/subpart-H' },
  { id: 'eaa', label: 'Directive (EU) 2019/882 — European Accessibility Act', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882' },
  { id: 'en301549', label: 'EN 301 549 — Accessibility requirements for ICT products and services', url: 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/' },
  { id: 'wcag22', label: 'Web Content Accessibility Guidelines 2.2, W3C Recommendation', url: 'https://www.w3.org/TR/WCAG22/' },
  { id: 'ftc-accessibe', label: 'FTC action against accessiBe over overlay accessibility claims, 2025', url: 'https://www.ftc.gov/news-events/news/press-releases' },
] as const;
