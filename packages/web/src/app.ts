import { age, ageClass, clock, exact, gp, pct, zClass } from './format.js';
import { renderPositions, type OutcomesView, type PositionsView } from './positions.js';
import type { Candidate, ItemDetail, Snapshot } from './types.js';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`missing element #${id}`);
  return el as T;
};

let snapshot: Snapshot | null = null;
let selectedId: number | null = null;
let sortKey: keyof Candidate | 'name' = 'score';
let sortAsc = false;
let view: 'candidates' | 'positions' = 'candidates';

// ---------------------------------------------------------------- fetching

function query(): string {
  const p = new URLSearchParams({
    minVol: $<HTMLSelectElement>('minVol').value,
    maxAge: $<HTMLSelectElement>('maxAge').value,
    capture: $<HTMLSelectElement>('capture').value,
    top: '60',
    useCash: '1',
  });
  return p.toString();
}

async function load(): Promise<void> {
  try {
    const res = await fetch(`/api/candidates?${query()}`);
    if (!res.ok) throw new Error(`${res.status}`);
    snapshot = (await res.json()) as Snapshot;
    render();
    if (view === 'positions') await loadPositions();
  } catch (err) {
    renderFeed(null, String(err));
  }
}

async function loadPositions(): Promise<void> {
  // Positions and outcomes are fetched together but degrade independently: a
  // failure of one leaves the other rendered rather than blanking the tab.
  const [posRes, outRes] = await Promise.allSettled([
    fetch('/api/positions'),
    fetch('/api/outcomes'),
  ]);
  if (posRes.status !== 'fulfilled' || !posRes.value.ok) return;
  const positions = (await posRes.value.json()) as PositionsView;
  const outcomes = outRes.status === 'fulfilled' && outRes.value.ok
    ? ((await outRes.value.json()) as OutcomesView)
    : null;
  renderPositions($('positions'), positions, outcomes);
}

function showView(next: 'candidates' | 'positions'): void {
  view = next;
  $('view-candidates').hidden = next !== 'candidates';
  $('view-positions').hidden = next !== 'positions';
  $('tab-candidates').classList.toggle('active', next === 'candidates');
  $('tab-positions').classList.toggle('active', next === 'positions');
  if (next === 'positions') void loadPositions();
}

// ---------------------------------------------------------------- rendering

function render(): void {
  if (snapshot === null) return;
  renderFeed(snapshot, null);
  renderCash(snapshot);
  renderRows(sorted(snapshot.candidates));
  renderFunnel(snapshot);
}

function sorted(rows: Candidate[]): Candidate[] {
  const out = [...rows];
  out.sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortKey === 'name') { av = a.item.name; bv = b.item.name; }
    else if (sortKey === 'spreadZ') {
      // Rows with no baseline sort to the end in both directions. "Unknown" is
      // not a small number and must never win a sort by looking like one.
      const an = a.spreadZ, bn = b.spreadZ;
      if (an === null && bn === null) return 0;
      if (an === null) return 1;
      if (bn === null) return -1;
      av = Math.abs(an); bv = Math.abs(bn);
    } else { av = a[sortKey] as number; bv = b[sortKey] as number; }
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : av - (bv as number);
    return sortAsc ? cmp : -cmp;
  });
  return out;
}

function renderFeed(snap: Snapshot | null, error: string | null): void {
  const dot = $('feed-dot');
  const text = $('feed-text');
  dot.className = 'dot';

  if (error !== null || snap === null) {
    dot.classList.add('down');
    text.textContent = error === null ? 'no data' : `server unreachable — ${error}`;
    return;
  }
  const f = snap.feed;
  if (f.lastLatestPoll === null) {
    dot.classList.add('down');
    text.textContent = 'no poll recorded yet';
    return;
  }
  const since = Math.floor(Date.now() / 1000) - f.lastLatestPoll;
  if (f.lastLatestOk === false) {
    dot.classList.add('down');
    text.textContent = `feed error — ${(f.lastError ?? 'unknown').slice(0, 48)}`;
  } else if (since > 180) {
    dot.classList.add('stale');
    text.textContent = `stale — last poll ${age(since)} ago`;
  } else {
    dot.classList.add('live');
    text.textContent = `live · polled ${age(since)} ago · ${exact(f.tickCount)} ticks · ${exact(f.baselineCoverage)} baselines`;
  }
}

function renderCash(snap: Snapshot): void {
  const el = $('cash-value');
  if (snap.client === null) {
    // No plugin connected means no cash stack. It is reported as absent rather
    // than as zero, and sizing simply does not apply the affordability limit.
    el.textContent = 'not connected';
    el.className = 'cash-value absent';
    return;
  }
  el.textContent = `${gp(snap.client.cashStack)} gp`;
  el.className = 'cash-value';
}

function renderRows(rows: Candidate[]): void {
  const tbody = $('rows');
  const empty = $('empty');
  tbody.textContent = '';

  if (rows.length === 0) {
    empty.hidden = false;
    renderEmpty(empty);
    return;
  }
  empty.hidden = true;

  rows.forEach((c, i) => {
    const tr = document.createElement('tr');
    tr.dataset['id'] = String(c.item.id);
    if (c.item.id === selectedId) tr.classList.add('selected');

    tr.append(
      td('num rank', String(i + 1)),
      nameCell(c),
      td('num', exact(c.buy)),
      td('num', exact(c.sell)),
      td('num net', exact(c.netMargin)),
      td('num roi', pct(c.roi)),
      td('num', gp(c.volume24h)),
      unitsCell(c),
      td('num capital', gp(c.capitalRequired)),
      td('num pot', gp(c.potentialProfit)),
      ageCell(c),
      zCell(c),
      stageCell(c),
    );
    tr.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.stage') !== null) return;
      select(c.item.id);
    });
    tbody.append(tr);
  });
}

function renderEmpty(el: HTMLElement): void {
  el.textContent = '';
  const h = document.createElement('h3');
  h.textContent = 'No candidates passed the filters';
  el.append(h);

  if (snapshot === null) return;
  const f = snapshot.funnel;
  const reasons = Object.entries(f)
    .filter(([k]) => !['input', 'survived', 'returned'].includes(k))
    .sort((a, b) => b[1] - a[1]);

  for (const [reason, n] of reasons.slice(0, 4)) {
    const p = document.createElement('p');
    p.textContent = `${exact(n)} rejected — ${reason.replace(/-/g, ' ')}`;
    el.append(p);
  }
  const hint = document.createElement('p');
  hint.style.marginTop = '12px';
  hint.style.color = 'var(--faint)';
  hint.textContent = 'Loosen "max age" or "min vol" above, or check that the poller is running.';
  el.append(hint);
}

function td(cls: string, text: string): HTMLTableCellElement {
  const el = document.createElement('td');
  el.className = cls;
  el.textContent = text;
  return el;
}

function nameCell(c: Candidate): HTMLTableCellElement {
  const el = document.createElement('td');
  const n = document.createElement('span');
  n.className = 'item-name';
  n.textContent = c.item.name;
  el.append(n);
  const sub = document.createElement('span');
  sub.className = 'item-sub';
  sub.textContent = `#${c.item.id}`;
  el.append(sub);
  return el;
}

function unitsCell(c: Candidate): HTMLTableCellElement {
  const el = document.createElement('td');
  el.className = 'num';
  el.append(document.createTextNode(exact(c.tradeableUnits)));
  const tag = document.createElement('span');
  tag.className = c.limitedBy === 'cash' ? 'limited cash' : 'limited';
  tag.textContent = c.limitedBy;
  tag.title = `Binding constraint on position size: ${c.limitedBy}`;
  el.append(tag);
  return el;
}

function ageCell(c: Candidate): HTMLTableCellElement {
  const el = document.createElement('td');
  el.className = `num ${ageClass(c.stalenessSeconds)}`;
  el.append(document.createTextNode(age(c.stalenessSeconds)));
  // Both legs, always, because the gap between them is the thing that decides
  // whether the spread above is a spread or a coincidence.
  const legs = document.createElement('div');
  legs.className = 'legs';
  legs.textContent = `b ${age(c.buyAgeSeconds)} / s ${age(c.sellAgeSeconds)}`;
  legs.title = `Buy leg last traded ${c.buyAgeSeconds}s ago, sell leg ${c.sellAgeSeconds}s ago`;
  el.append(legs);
  return el;
}

function zCell(c: Candidate): HTMLTableCellElement {
  const el = document.createElement('td');
  el.className = 'num';
  if (c.spreadZ === null) {
    const tag = document.createElement('span');
    tag.className = 'z-unknown';
    tag.textContent = 'unknown';
    tag.title = `Only ${c.baselineSamples} baseline buckets stored; at least 24 are needed before a z-score means anything. Run the backfill to seed history.`;
    el.append(tag);
    return el;
  }
  const s = document.createElement('span');
  s.className = zClass(c.spreadZ);
  s.textContent = c.spreadZ.toFixed(2);
  s.title = `Current spread is ${c.spreadZ.toFixed(2)} SD from its own ${c.baselineSamples}-bucket norm`;
  el.append(s);
  return el;
}

function stageCell(c: Candidate): HTMLTableCellElement {
  const el = document.createElement('td');
  const b = document.createElement('button');
  b.className = 'stage';
  b.textContent = 'Stage';
  b.addEventListener('click', () => { select(c.item.id); });
  el.append(b);
  return el;
}

function renderFunnel(snap: Snapshot): void {
  const el = $('funnel');
  el.textContent = '';
  const f = snap.funnel;
  const order = ['input', 'no-mapping-entry', 'no-buy-side', 'no-sell-side', 'no-volume-data',
                 'stale', 'negative-after-tax', 'below-volume-floor', 'unaffordable', 'survived'];

  for (const key of order) {
    const n = f[key];
    if (n === undefined) continue;
    const step = document.createElement('span');
    step.className = key === 'survived' ? 'fstep keep' : key === 'input' ? 'fstep' : 'fstep drop';
    const label = document.createElement('span');
    label.textContent = key.replace(/-/g, ' ');
    const val = document.createElement('b');
    val.textContent = exact(n);
    step.append(val, label);
    el.append(step);
  }
}

// ---------------------------------------------------------------- drawer

function select(id: number): void {
  selectedId = id;
  for (const tr of document.querySelectorAll('#rows tr')) {
    tr.classList.toggle('selected', tr.getAttribute('data-id') === String(id));
  }
  void openDrawer(id);
}

async function openDrawer(id: number): Promise<void> {
  if (snapshot === null) return;
  const c = snapshot.candidates.find((x) => x.item.id === id);
  if (c === undefined) return;

  const drawer = $('drawer');
  drawer.hidden = false;
  $('d-name').textContent = c.item.name;

  const body = $('d-body');
  body.textContent = '';
  body.append(orderSection(c), metricsSection(c), provenanceSection(c));

  try {
    const res = await fetch(`/api/item?id=${id}`);
    if (res.ok) body.append(historySection((await res.json()) as ItemDetail));
  } catch { /* history is supplementary; its absence is not worth an error state */ }
}

/**
 * The staging panel.
 *
 * This is deliberately a set of exact values with copy buttons, not an automated
 * order. Jagex's third-party client rules permit a plugin to read and display
 * game state; they do not permit software to place an order for you, and
 * RuneLite's plugin API exposes no way to synthesise the input that would.
 * So the tool does everything up to the trade: exact item name for the search
 * box, exact price, exact quantity, and the total committed. You press the keys.
 */
function orderSection(c: Candidate): HTMLElement {
  const s = section('Stage this flip');
  const box = document.createElement('div');
  box.className = 'order';

  const rows: Array<[string, string, string]> = [
    ['Search for', c.item.name, c.item.name],
    ['Buy offer at', `${exact(c.buy)} gp`, String(c.buy)],
    ['Quantity', exact(c.tradeableUnits), String(c.tradeableUnits)],
    ['Capital committed', `${gp(c.capitalRequired)} gp`, String(c.capitalRequired)],
    ['Then sell at', `${exact(c.sell)} gp`, String(c.sell)],
    ['Profit if filled', `${gp(c.potentialProfit)} gp`, String(c.potentialProfit)],
  ];

  for (const [k, shown, raw] of rows) {
    const row = document.createElement('div');
    row.className = 'order-row';
    const key = document.createElement('span');
    key.className = 'order-k';
    key.textContent = k;
    const right = document.createElement('span');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';
    const val = document.createElement('span');
    val.className = 'order-v';
    val.textContent = shown;
    const btn = document.createElement('button');
    btn.className = 'copy';
    btn.textContent = 'copy';
    btn.addEventListener('click', () => { void copy(raw, k); });
    right.append(val, btn);
    row.append(key, right);
    box.append(row);
  }
  s.append(box);

  const note = document.createElement('div');
  note.className = 'note';
  note.textContent =
    'These values are copied for you to enter yourself. The tool never places, '
    + 'modifies or cancels an offer: automating a game action is against Jagex’s '
    + 'third-party client rules, and the RuneLite plugin API deliberately exposes '
    + 'no way to do it. Reading your cash and offers is permitted, and is what the '
    + 'plugin does.';
  s.append(note);
  return s;
}

function metricsSection(c: Candidate): HTMLElement {
  const s = section('Computed');
  const dl = document.createElement('dl');
  dl.className = 'kv';
  const pairs: Array<[string, string]> = [
    ['Quoted spread', `${exact(c.quotedBuy)} – ${exact(c.quotedSell)}`],
    ['Ranked at (undercut)', `${exact(c.buy)} – ${exact(c.sell)}`],
    ['Net after 2% tax', `${exact(c.netMargin)} gp`],
    ['Return on capital', pct(c.roi)],
    ['Volume 24h', exact(c.volume24h)],
    ['Absorbable per 4h', exact(c.absorbable)],
    ['Buy limit', c.item.buyLimit === null ? 'none published' : exact(c.item.buyLimit)],
    ['Units — limited by', `${exact(c.tradeableUnits)} (${c.limitedBy})`],
    ['Buy leg age', age(c.buyAgeSeconds)],
    ['Sell leg age', age(c.sellAgeSeconds)],
    ['Baseline buckets', exact(c.baselineSamples)],
    ['Spread z', c.spreadZ === null ? 'unknown' : c.spreadZ.toFixed(2)],
  ];
  for (const [k, v] of pairs) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  s.append(dl);
  return s;
}

/**
 * Every row can show where its numbers came from. This is the visible half of
 * the provenance guarantee — if a figure is on screen, this panel names the
 * endpoint and the timestamp the underlying trade carried.
 */
function provenanceSection(c: Candidate): HTMLElement {
  const s = section('Provenance');
  const p = document.createElement('div');
  p.className = 'prov';
  for (const o of c.sources.observations) {
    const line = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `/${o.endpoint}`;
    line.append(b, document.createTextNode(
      ` · trade at ${clock(o.sourceAt)} · fetched ${clock(o.fetchedAt)}`,
    ));
    p.append(line);
  }
  const fns = document.createElement('div');
  fns.style.marginTop = '6px';
  fns.textContent = `derived by: ${c.sources.derivedBy.join(' → ')}`;
  p.append(fns);
  s.append(p);
  return s;
}

function historySection(d: ItemDetail): HTMLElement {
  const s = section('Recent trades');
  if (d.ticks.length < 2) {
    const p = document.createElement('div');
    p.className = 'prov';
    p.textContent = `only ${d.ticks.length} stored tick(s) — history builds as the poller runs`;
    s.append(p);
    return s;
  }
  s.append(sparkline(d.ticks));
  const cap = document.createElement('div');
  cap.className = 'prov';
  cap.style.marginTop = '6px';
  cap.textContent = `${d.ticks.length} ticks stored · ${d.spreads.length} spread buckets`;
  s.append(cap);
  return s;
}

function sparkline(ticks: Array<{ side: 'high' | 'low'; price: number; sourceAt: number }>): SVGSVGElement {
  const W = 372, H = 48, PAD = 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'spark');

  const times = ticks.map((t) => t.sourceAt);
  const prices = ticks.map((t) => t.price);
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const p0 = Math.min(...prices), p1 = Math.max(...prices);
  const x = (t: number): number => (t1 === t0 ? W / 2 : PAD + ((t - t0) / (t1 - t0)) * (W - 2 * PAD));
  const y = (p: number): number => (p1 === p0 ? H / 2 : H - PAD - ((p - p0) / (p1 - p0)) * (H - 2 * PAD));

  for (const side of ['high', 'low'] as const) {
    const pts = ticks.filter((t) => t.side === side).sort((a, b) => a.sourceAt - b.sourceAt);
    if (pts.length < 2) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', pts.map((t) => `${x(t.sourceAt).toFixed(1)},${y(t.price).toFixed(1)}`).join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', side === 'high' ? 'var(--bad)' : 'var(--good)');
    path.setAttribute('stroke-width', '1.25');
    svg.append(path);
  }
  return svg;
}

function section(title: string): HTMLElement {
  const s = document.createElement('div');
  s.className = 'sect';
  const h = document.createElement('h3');
  h.textContent = title;
  s.append(h);
  return s;
}

// ---------------------------------------------------------------- misc

async function copy(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(`copied ${label.toLowerCase()}`);
  } catch {
    toast('clipboard unavailable — select and copy manually');
  }
}

let toastTimer = 0;
function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 1800);
}

// ---------------------------------------------------------------- wiring

for (const id of ['minVol', 'maxAge', 'capture']) {
  $(id).addEventListener('change', () => { void load(); });
}

$('refresh').addEventListener('click', () => { void forceRefresh(); });
$('tab-candidates').addEventListener('click', () => { showView('candidates'); });
$('tab-positions').addEventListener('click', () => { showView('positions'); });
$('d-close').addEventListener('click', () => { $('drawer').hidden = true; selectedId = null; render(); });

for (const th of document.querySelectorAll<HTMLElement>('th[data-sort]')) {
  th.addEventListener('click', () => {
    const key = th.dataset['sort'] as keyof Candidate | 'name';
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = false; }
    for (const other of document.querySelectorAll('th[data-sort]')) other.classList.remove('sorted', 'asc');
    th.classList.add('sorted');
    if (sortAsc) th.classList.add('asc');
    render();
  });
}

async function forceRefresh(): Promise<void> {
  const btn = $('refresh');
  btn.classList.add('busy');
  try {
    await fetch('/api/poll', { method: 'POST' });
    await load();
    toast('polled /latest');
  } finally {
    btn.classList.remove('busy');
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'SELECT') return;
  if (e.key === 'r') void forceRefresh();
  if (e.key === '1') showView('candidates');
  if (e.key === '2') showView('positions');
  if (e.key === 'Escape') { $('drawer').hidden = true; selectedId = null; render(); }
});

void load();
setInterval(() => { void load(); }, 15_000);
