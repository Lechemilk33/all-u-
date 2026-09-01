/**
 * WCAG 2.2 success criteria, complete (87 entries, including the criterion
 * obsoleted in 2.2). Source of truth for every conformance claim Curbcut makes.
 *
 * The compact table keeps the data reviewable in one screen per guideline;
 * `SUCCESS_CRITERIA` is the expanded, typed form everything else consumes.
 */

export type ConformanceLevel = 'A' | 'AA' | 'AAA';

export type PrincipleId = '1' | '2' | '3' | '4';

export interface Principle {
  readonly id: PrincipleId;
  readonly name: string;
  readonly plain: string;
}

export const PRINCIPLES: readonly Principle[] = [
  { id: '1', name: 'Perceivable', plain: 'People must be able to perceive the content — see it, hear it, or have it read aloud.' },
  { id: '2', name: 'Operable', plain: 'People must be able to operate the interface, including without a mouse.' },
  { id: '3', name: 'Understandable', plain: 'Content and controls must behave predictably and explain themselves.' },
  { id: '4', name: 'Robust', plain: 'Content must work with assistive technology, now and as that technology changes.' },
] as const;

export interface SuccessCriterion {
  /** Dotted number, e.g. "1.4.3". */
  readonly num: string;
  /** Digits only, e.g. "143" — matches the axe-core tag form `wcag143`. */
  readonly tag: string;
  readonly name: string;
  readonly level: ConformanceLevel;
  readonly principle: PrincipleId;
  /** "1.4" — the guideline this criterion sits under. */
  readonly guideline: string;
  /** WCAG version in which the criterion first appeared. */
  readonly since: '2.0' | '2.1' | '2.2';
  /** True for 4.1.1 Parsing, which WCAG 2.2 marks obsolete. */
  readonly obsolete?: boolean;
  readonly url: string;
}

/** `num|name|level|since|obsolete?` */
const TABLE = `
1.1.1|Non-text Content|A|2.0
1.2.1|Audio-only and Video-only (Prerecorded)|A|2.0
1.2.2|Captions (Prerecorded)|A|2.0
1.2.3|Audio Description or Media Alternative (Prerecorded)|A|2.0
1.2.4|Captions (Live)|AA|2.0
1.2.5|Audio Description (Prerecorded)|AA|2.0
1.2.6|Sign Language (Prerecorded)|AAA|2.0
1.2.7|Extended Audio Description (Prerecorded)|AAA|2.0
1.2.8|Media Alternative (Prerecorded)|AAA|2.0
1.2.9|Audio-only (Live)|AAA|2.0
1.3.1|Info and Relationships|A|2.0
1.3.2|Meaningful Sequence|A|2.0
1.3.3|Sensory Characteristics|A|2.0
1.3.4|Orientation|AA|2.1
1.3.5|Identify Input Purpose|AA|2.1
1.3.6|Identify Purpose|AAA|2.1
1.4.1|Use of Color|A|2.0
1.4.2|Audio Control|A|2.0
1.4.3|Contrast (Minimum)|AA|2.0
1.4.4|Resize Text|AA|2.0
1.4.5|Images of Text|AA|2.0
1.4.6|Contrast (Enhanced)|AAA|2.0
1.4.7|Low or No Background Audio|AAA|2.0
1.4.8|Visual Presentation|AAA|2.0
1.4.9|Images of Text (No Exception)|AAA|2.0
1.4.10|Reflow|AA|2.1
1.4.11|Non-text Contrast|AA|2.1
1.4.12|Text Spacing|AA|2.1
1.4.13|Content on Hover or Focus|AA|2.1
2.1.1|Keyboard|A|2.0
2.1.2|No Keyboard Trap|A|2.0
2.1.3|Keyboard (No Exception)|AAA|2.0
2.1.4|Character Key Shortcuts|A|2.1
2.2.1|Timing Adjustable|A|2.0
2.2.2|Pause, Stop, Hide|A|2.0
2.2.3|No Timing|AAA|2.0
2.2.4|Interruptions|AAA|2.0
2.2.5|Re-authenticating|AAA|2.0
2.2.6|Timeouts|AAA|2.1
2.3.1|Three Flashes or Below Threshold|A|2.0
2.3.2|Three Flashes|AAA|2.0
2.3.3|Animation from Interactions|AAA|2.1
2.4.1|Bypass Blocks|A|2.0
2.4.2|Page Titled|A|2.0
2.4.3|Focus Order|A|2.0
2.4.4|Link Purpose (In Context)|A|2.0
2.4.5|Multiple Ways|AA|2.0
2.4.6|Headings and Labels|AA|2.0
2.4.7|Focus Visible|AA|2.0
2.4.8|Location|AAA|2.0
2.4.9|Link Purpose (Link Only)|AAA|2.0
2.4.10|Section Headings|AAA|2.0
2.4.11|Focus Not Obscured (Minimum)|AA|2.2
2.4.12|Focus Not Obscured (Enhanced)|AAA|2.2
2.4.13|Focus Appearance|AAA|2.2
2.5.1|Pointer Gestures|A|2.1
2.5.2|Pointer Cancellation|A|2.1
2.5.3|Label in Name|A|2.1
2.5.4|Motion Actuation|A|2.1
2.5.5|Target Size (Enhanced)|AAA|2.1
2.5.6|Concurrent Input Mechanisms|AAA|2.1
2.5.7|Dragging Movements|AA|2.2
2.5.8|Target Size (Minimum)|AA|2.2
3.1.1|Language of Page|A|2.0
3.1.2|Language of Parts|AA|2.0
3.1.3|Unusual Words|AAA|2.0
3.1.4|Abbreviations|AAA|2.0
3.1.5|Reading Level|AAA|2.0
3.1.6|Pronunciation|AAA|2.0
3.2.1|On Focus|A|2.0
3.2.2|On Input|A|2.0
3.2.3|Consistent Navigation|AA|2.0
3.2.4|Consistent Identification|AA|2.0
3.2.5|Change on Request|AAA|2.0
3.2.6|Consistent Help|A|2.2
3.3.1|Error Identification|A|2.0
3.3.2|Labels or Instructions|A|2.0
3.3.3|Error Suggestion|AA|2.0
3.3.4|Error Prevention (Legal, Financial, Data)|AA|2.0
3.3.5|Help|AAA|2.0
3.3.6|Error Prevention (All)|AAA|2.0
3.3.7|Redundant Entry|A|2.2
3.3.8|Accessible Authentication (Minimum)|AA|2.2
3.3.9|Accessible Authentication (Enhanced)|AAA|2.2
4.1.1|Parsing|A|2.0|obsolete
4.1.2|Name, Role, Value|A|2.0
4.1.3|Status Messages|AA|2.1
`.trim();

/**
 * W3C "Understanding" slugs drop the parenthesis characters but keep the words
 * inside them: "Contrast (Minimum)" -> "contrast-minimum".
 */
const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const SUCCESS_CRITERIA: readonly SuccessCriterion[] = TABLE.split('\n').map((line) => {
  const [num, name, level, since, flag] = line.split('|') as [
    string,
    string,
    ConformanceLevel,
    '2.0' | '2.1' | '2.2',
    string | undefined,
  ];
  const principle = num.slice(0, 1) as PrincipleId;
  const sc: SuccessCriterion = {
    num,
    tag: num.replace(/\./g, ''),
    name,
    level,
    principle,
    guideline: num.split('.').slice(0, 2).join('.'),
    since,
    url: `https://www.w3.org/WAI/WCAG22/Understanding/${slug(name)}`,
    ...(flag === 'obsolete' ? { obsolete: true as const } : {}),
  };
  return sc;
});

const BY_NUM = new Map(SUCCESS_CRITERIA.map((sc) => [sc.num, sc]));
const BY_TAG = new Map(SUCCESS_CRITERIA.map((sc) => [sc.tag, sc]));

export const criterionByNumber = (num: string): SuccessCriterion | undefined => BY_NUM.get(num);
export const criterionByTag = (tag: string): SuccessCriterion | undefined => BY_TAG.get(tag);

/** Extracts `1.4.3` from an axe-core tag like `wcag143`. */
export function criterionFromAxeTag(tag: string): SuccessCriterion | undefined {
  const m = /^wcag(\d{3,4})$/.exec(tag);
  return m?.[1] ? BY_TAG.get(m[1]) : undefined;
}

/** Criteria required at a level, cumulative (AA implies A). Excludes obsolete. */
export function criteriaAtLevel(level: ConformanceLevel): readonly SuccessCriterion[] {
  const rank: Record<ConformanceLevel, number> = { A: 1, AA: 2, AAA: 3 };
  return SUCCESS_CRITERIA.filter((sc) => !sc.obsolete && rank[sc.level] <= rank[level]);
}

export const principleName = (id: PrincipleId): string =>
  PRINCIPLES.find((p) => p.id === id)?.name ?? 'Unknown';
