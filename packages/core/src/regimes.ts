/**
 * The legal regimes that turn a WCAG failure into money owed.
 *
 * Everything here is a statement about law, so every entry carries a citation
 * and a `verifiedOn` date. Curbcut reports render these verbatim rather than
 * paraphrasing them: the value of the report is that a lawyer can check it.
 *
 * This is reference information, not legal advice, and the product says so
 * wherever these strings surface.
 */

import type { ConformanceLevel } from './wcag.js';

export type RegimeId =
  | 'ada-title-ii'
  | 'ada-title-iii'
  | 'section-508'
  | 'eaa'
  | 'eu-wad'
  | 'aoda'
  | 'uk-psbar'
  | 'aca';

export type WcagVersion = '2.0' | '2.1' | '2.2';

export type EnforcementKind =
  | 'private-litigation'
  | 'regulator'
  | 'procurement'
  | 'mixed';

export interface Deadline {
  /** ISO date the obligation bites. */
  readonly date: `${number}-${number}-${number}`;
  readonly label: string;
  /** Who this particular date applies to. */
  readonly appliesTo: string;
}

export interface Regime {
  readonly id: RegimeId;
  readonly shortName: string;
  readonly name: string;
  readonly jurisdiction: string;
  /** ISO 3166-1 alpha-2 codes, or 'EU'. Used for regime auto-selection. */
  readonly territories: readonly string[];
  /** Plain-language description of who is covered. */
  readonly appliesTo: string;
  readonly standard: { readonly wcag: WcagVersion; readonly level: ConformanceLevel; readonly note?: string };
  readonly enforcement: EnforcementKind;
  /** How a claim actually starts. This is what people want to know. */
  readonly howClaimsStart: string;
  readonly exposure: string;
  readonly deadlines: readonly Deadline[];
  readonly citation: { readonly label: string; readonly url: string };
  readonly verifiedOn: string;
}

export const REGIMES: readonly Regime[] = [
  {
    id: 'ada-title-ii',
    shortName: 'ADA Title II',
    name: 'Americans with Disabilities Act, Title II — DOJ web accessibility rule',
    jurisdiction: 'United States (federal)',
    territories: ['US'],
    appliesTo:
      'State and local government entities: cities, counties, school districts, public universities, transit authorities, courts, libraries, and special district governments.',
    standard: {
      wcag: '2.1',
      level: 'AA',
      note: 'The 2024 DOJ rule adopts WCAG 2.1 Level AA as the technical standard at 28 CFR § 35.200.',
    },
    enforcement: 'mixed',
    howClaimsStart:
      'A complaint to the DOJ Civil Rights Division, or a private suit under 42 U.S.C. § 12133. Unlike Title III, Title II plaintiffs can recover compensatory damages, which raises the ceiling on settlements.',
    exposure:
      'Injunctive relief plus attorney fees, compensatory damages, and a DOJ consent decree with multi-year reporting obligations. Public entities also carry procurement and grant-condition risk.',
    deadlines: [
      {
        date: '2026-04-24',
        label: 'Compliance required',
        appliesTo: 'Public entities with a population of 50,000 or more, and all public transit authorities',
      },
      {
        date: '2027-04-26',
        label: 'Compliance required',
        appliesTo: 'Public entities with a population under 50,000, and all special district governments',
      },
    ],
    citation: {
      label: '28 CFR Part 35, Subpart H (89 FR 31320, April 24, 2024)',
      url: 'https://www.ecfr.gov/current/title-28/chapter-I/part-35/subpart-H',
    },
    verifiedOn: '2026-09-01',
  },
  {
    id: 'ada-title-iii',
    shortName: 'ADA Title III',
    name: 'Americans with Disabilities Act, Title III — public accommodations',
    jurisdiction: 'United States (federal)',
    territories: ['US'],
    appliesTo:
      'Private businesses that are places of public accommodation: retail and e-commerce, restaurants, hotels, banks, healthcare providers, entertainment venues, and professional offices serving the public.',
    standard: {
      wcag: '2.1',
      level: 'AA',
      note: 'No codified technical standard exists for Title III. Courts, DOJ settlements and consent decrees converge on WCAG 2.1 Level AA, which is the benchmark Curbcut applies.',
    },
    enforcement: 'private-litigation',
    howClaimsStart:
      'Almost always a demand letter from a plaintiff-side firm, followed by a federal complaint if unanswered. Filings are concentrated in the Southern District of New York, the Eastern District of New York, and Florida.',
    exposure:
      'Title III itself allows injunctive relief and attorney fees, not damages — but parallel state claims (notably New York State and City Human Rights Law, and California\'s Unruh Act at $4,000 in statutory damages per violation) supply the damages, which is why these cases settle.',
    deadlines: [],
    citation: {
      label: '42 U.S.C. § 12181 et seq.',
      url: 'https://www.ada.gov/topics/title-iii/',
    },
    verifiedOn: '2026-09-01',
  },
  {
    id: 'section-508',
    shortName: 'Section 508',
    name: 'Section 508 of the Rehabilitation Act',
    jurisdiction: 'United States (federal)',
    territories: ['US'],
    appliesTo:
      'US federal agencies, and any vendor selling information and communication technology to them. Effectively a gate on federal contracts.',
    standard: {
      wcag: '2.0',
      level: 'AA',
      note: 'The Revised 508 Standards incorporate WCAG 2.0 Level AA by reference. Agencies increasingly write WCAG 2.1 AA into solicitations, so 2.1 AA is the safer procurement target.',
    },
    enforcement: 'procurement',
    howClaimsStart:
      'A failed accessibility review during procurement, a rejected or challenged VPAT / Accessibility Conformance Report, or an administrative complaint under § 508(f).',
    exposure:
      'Lost or rescinded contracts, bid protests, and remediation at the vendor\'s own cost. The practical penalty is exclusion from federal buying.',
    deadlines: [],
    citation: {
      label: '36 CFR Part 1194 (Revised 508 Standards)',
      url: 'https://www.access-board.gov/ict/',
    },
    verifiedOn: '2026-09-01',
  },
  {
    id: 'eaa',
    shortName: 'EAA',
    name: 'European Accessibility Act (Directive (EU) 2019/882)',
    jurisdiction: 'European Union',
    territories: ['EU'],
    appliesTo:
      'Businesses selling covered products and services to EU consumers: e-commerce, consumer banking, e-books, electronic communications, transport services and ticketing, and audiovisual media access. Applies regardless of where the business is established. Microenterprises providing services (fewer than 10 staff and under €2m turnover) are exempt.',
    standard: {
      wcag: '2.1',
      level: 'AA',
      note: 'Conformity is presumed by meeting the harmonised standard EN 301 549, whose web chapter maps to WCAG 2.1 Level AA.',
    },
    enforcement: 'regulator',
    howClaimsStart:
      'A consumer complaint to the national market surveillance authority, which triggers an inspection and a formal notice to remedy. Fines follow only if the notice is ignored.',
    exposure:
      'Set by each member state, not by the directive. Reported national maxima range from roughly €100,000 in Germany to €1,000,000 in Spain, with Hungary tying penalties to turnover. Ireland is the only member state providing criminal sanctions. Authorities can also order a service withdrawn from the market.',
    deadlines: [
      {
        date: '2025-06-28',
        label: 'Enforceable across all member states',
        appliesTo: 'All covered products and services placed on the EU market',
      },
      {
        date: '2030-06-28',
        label: 'End of transition for pre-existing service contracts',
        appliesTo: 'Service contracts concluded before 28 June 2025',
      },
    ],
    citation: {
      label: 'Directive (EU) 2019/882',
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882',
    },
    verifiedOn: '2026-09-01',
  },
  {
    id: 'eu-wad',
    shortName: 'EU Web Directive',
    name: 'EU Web Accessibility Directive (Directive (EU) 2016/2102)',
    jurisdiction: 'European Union',
    territories: ['EU'],
    appliesTo: 'Public sector bodies in EU member states: government, healthcare, education, and their websites and mobile apps.',
    standard: { wcag: '2.1', level: 'AA', note: 'Via EN 301 549.' },
    enforcement: 'regulator',
    howClaimsStart:
      'A complaint through the mandatory national feedback mechanism, escalating to the designated monitoring body. Member states report monitoring results to the Commission on a three-year cycle.',
    exposure:
      'Enforcement is national and largely non-financial: published non-compliance findings, mandated remediation plans, and a required accessibility statement that must be kept accurate.',
    deadlines: [],
    citation: {
      label: 'Directive (EU) 2016/2102',
      url: 'https://eur-lex.europa.eu/eli/dir/2016/2102/oj',
    },
    verifiedOn: '2026-09-01',
  },
  {
    id: 'aoda',
    shortName: 'AODA',
    name: 'Accessibility for Ontarians with Disabilities Act — Integrated Accessibility Standards',
    jurisdiction: 'Ontario, Canada',
    territories: ['CA'],
    appliesTo:
      'Ontario businesses and non-profits with 50 or more employees, and all public sector organisations.',
    standard: {
      wcag: '2.0',
      level: 'AA',
      note: 'O. Reg. 191/11 requires WCAG 2.0 Level AA, excluding live captions and pre-recorded audio description.',
    },
    enforcement: 'regulator',
    howClaimsStart:
      'A mandatory self-filed accessibility compliance report, audited by the Ministry. Inaccurate reports are themselves a violation.',
    exposure:
      'Administrative monetary penalties under the Act reach CAD $100,000 per day for a corporation and CAD $50,000 per day for a director or officer.',
    deadlines: [
      { date: '2021-01-01', label: 'All covered sites and content', appliesTo: 'Large organisations and the public sector — already in force' },
    ],
    citation: { label: 'O. Reg. 191/11, s. 14', url: 'https://www.ontario.ca/laws/regulation/110191' },
    verifiedOn: '2026-09-01',
  },
  {
    id: 'uk-psbar',
    shortName: 'UK PSBAR',
    name: 'Public Sector Bodies Accessibility Regulations 2018, with the Equality Act 2010',
    jurisdiction: 'United Kingdom',
    territories: ['GB'],
    appliesTo:
      'UK public sector bodies for PSBAR. The Equality Act 2010 duty to make reasonable adjustments applies to service providers generally, including private businesses.',
    standard: { wcag: '2.1', level: 'AA' },
    enforcement: 'mixed',
    howClaimsStart:
      'Monitoring by the Central Digital and Data Office, or a discrimination claim brought by an individual under the Equality Act.',
    exposure:
      'Published non-compliance findings and enforcement by the Equality and Human Rights Commission. Equality Act claims carry uncapped damages for injury to feelings plus costs.',
    deadlines: [],
    citation: {
      label: 'SI 2018/952',
      url: 'https://www.legislation.gov.uk/uksi/2018/952/contents',
    },
    verifiedOn: '2026-09-01',
  },
  {
    id: 'aca',
    shortName: 'ACA',
    name: 'Accessible Canada Act',
    jurisdiction: 'Canada (federal)',
    territories: ['CA'],
    appliesTo:
      'Federally regulated entities: banks, telecommunications, broadcasting, interprovincial transport, and federal government departments.',
    standard: { wcag: '2.1', level: 'AA', note: 'Via the CAN/ASC-EN 301 549 standard adopted by Accessibility Standards Canada.' },
    enforcement: 'regulator',
    howClaimsStart:
      'A complaint to the Accessibility Commissioner at the Canadian Human Rights Commission, or a sector complaint to the CRTC or the Canadian Transportation Agency.',
    exposure: 'Administrative monetary penalties up to CAD $250,000 per violation, plus mandatory published accessibility plans and progress reports.',
    deadlines: [],
    citation: { label: 'S.C. 2019, c. 10', url: 'https://laws-lois.justice.gc.ca/eng/acts/A-0.6/' },
    verifiedOn: '2026-09-01',
  },
] as const;

const BY_ID = new Map(REGIMES.map((r) => [r.id, r]));
export const regimeById = (id: RegimeId): Regime | undefined => BY_ID.get(id);

/** Days until a deadline relative to `now`; negative once it has passed. */
export function daysUntil(date: string, now: Date = new Date()): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

export interface UpcomingDeadline extends Deadline {
  readonly regime: Regime;
  readonly daysAway: number;
  readonly passed: boolean;
}

/** Every deadline across the selected regimes, soonest first, past ones last. */
export function deadlinesFor(ids: readonly RegimeId[], now: Date = new Date()): UpcomingDeadline[] {
  const out: UpcomingDeadline[] = [];
  for (const id of ids) {
    const regime = BY_ID.get(id);
    if (!regime) continue;
    for (const d of regime.deadlines) {
      const daysAway = daysUntil(d.date, now);
      out.push({ ...d, regime, daysAway, passed: daysAway < 0 });
    }
  }
  return out.sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return a.passed ? b.daysAway - a.daysAway : a.daysAway - b.daysAway;
  });
}

/** The strictest standard among the selected regimes — what the scan grades against. */
export function bindingStandard(ids: readonly RegimeId[]): { wcag: WcagVersion; level: ConformanceLevel } {
  const wcagRank: Record<WcagVersion, number> = { '2.0': 0, '2.1': 1, '2.2': 2 };
  const levelRank: Record<ConformanceLevel, number> = { A: 0, AA: 1, AAA: 2 };
  let wcag: WcagVersion = '2.0';
  let level: ConformanceLevel = 'A';
  for (const id of ids) {
    const r = BY_ID.get(id);
    if (!r) continue;
    if (wcagRank[r.standard.wcag] > wcagRank[wcag]) wcag = r.standard.wcag;
    if (levelRank[r.standard.level] > levelRank[level]) level = r.standard.level;
  }
  return { wcag, level };
}
