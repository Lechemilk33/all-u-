import { age, exact, gp, pct } from './format.js';

export interface Position {
  slot: number; itemId: number; name: string | null;
  side: 'buy' | 'sell'; state: string;
  offerPrice: number; totalQuantity: number; quantityFilled: number; fillFraction: number;
  spent: number; realisedUnitPrice: number | null;
  openedAt: number; lastChangeAt: number; ageSeconds: number; stalledSeconds: number; complete: boolean;
}

export interface FillStat {
  itemId: number; name: string | null; side: 'buy' | 'sell';
  completedOffers: number; medianSecondsToFill: number; medianRealisedPrice: number;
}

export interface PositionsView { positions: Position[]; fills: FillStat[]; connected: boolean }

export interface OutcomesView {
  outcomes: Array<{
    suggestionId: number; itemId: number; name: string | null; createdAt: number;
    predictedNet: number; marketNet: number | null;
    marketVerdict: 'achievable' | 'missed' | 'unknown';
    filledUnits: number | null; filledUnitPrice: number | null;
  }>;
  summary: {
    scored: number; achievable: number; missed: number; unknown: number;
    hitRate: number | null; medianPredictedNet: number | null; medianRealisedNet: number | null;
  };
}

/** An offer with no fill progress for this long is very likely undercut. */
const STALL_SECONDS = 600;

export function renderPositions(root: HTMLElement, view: PositionsView, outcomes: OutcomesView | null): void {
  root.textContent = '';

  if (!view.connected && view.positions.length === 0) {
    root.append(disconnected());
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'pos-wrap';

  wrap.append(slotsCard(view.positions));
  if (view.fills.length > 0) wrap.append(fillsCard(view.fills));
  if (outcomes !== null) wrap.append(outcomesCard(outcomes));

  root.append(wrap);
}

function disconnected(): HTMLElement {
  const d = document.createElement('div');
  d.className = 'disconnected';
  const h = document.createElement('h3');
  h.textContent = 'No client connected';
  const p1 = document.createElement('p');
  p1.textContent = 'Install the Flip Finder RuneLite plugin and set its endpoint to:';
  const code = document.createElement('code');
  code.textContent = 'http://127.0.0.1:8787';
  const p2 = document.createElement('p');
  p2.style.marginTop = '12px';
  p2.style.color = 'var(--faint)';
  p2.style.fontSize = '11px';
  p2.textContent = 'Offer progress, fill times and realised prices all come from the plugin. '
    + 'Nothing on this tab is estimated when it is not connected.';
  d.append(h, p1, code, p2);
  return d;
}

function slotsCard(positions: readonly Position[]): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  const h = document.createElement('h3');
  h.textContent = `Grand Exchange slots — ${positions.length} tracked`;
  card.append(h);

  if (positions.length === 0) {
    const p = document.createElement('div');
    p.style.color = 'var(--muted)';
    p.style.fontSize = '12px';
    p.textContent = 'No offers reported yet. Open an offer in game and it will appear here.';
    card.append(p);
    return card;
  }

  const grid = document.createElement('div');
  grid.className = 'pos-grid';
  for (const p of positions) grid.append(slotCard(p));
  card.append(grid);
  return card;
}

function slotCard(p: Position): HTMLElement {
  const stalled = !p.complete && p.quantityFilled < p.totalQuantity && p.stalledSeconds > STALL_SECONDS;

  const el = document.createElement('div');
  el.className = `slot ${p.side}${p.complete ? ' done' : ''}${stalled ? ' stalled' : ''}`;

  const top = document.createElement('div');
  top.className = 'slot-top';
  const name = document.createElement('span');
  name.className = 'slot-name';
  // The plugin reports an item id; the name comes from /mapping. If we have not
  // seen the item there, we say so rather than printing a guess.
  name.textContent = p.name === null ? `item #${p.itemId}` : p.name;
  const state = document.createElement('span');
  state.className = `slot-state ${p.state}`;
  state.textContent = p.state.replace('_', ' ');
  top.append(name, state);
  el.append(top);

  const track = document.createElement('div');
  track.className = 'bar-track';
  const fill = document.createElement('div');
  fill.className = `bar-fill${stalled ? ' stalled' : p.fillFraction < 1 ? ' partial' : ''}`;
  fill.style.width = `${(p.fillFraction * 100).toFixed(1)}%`;
  track.append(fill);
  el.append(track);

  const kv = document.createElement('div');
  kv.className = 'slot-kv';
  const pairs: Array<[string, string]> = [
    ['Filled', `${exact(p.quantityFilled)} / ${exact(p.totalQuantity)}  (${pct(p.fillFraction)})`],
    ['Offer price', `${exact(p.offerPrice)} gp`],
    // Absent until something fills; 0 would read as "free".
    ['Realised price', p.realisedUnitPrice === null ? 'nothing filled yet' : `${exact(p.realisedUnitPrice)} gp`],
    ['Coins moved', `${gp(p.spent)} gp`],
    ['Open for', age(p.ageSeconds)],
  ];
  for (const [k, v] of pairs) {
    const dk = document.createElement('span'); dk.textContent = k;
    const dv = document.createElement('span'); dv.textContent = v;
    kv.append(dk, dv);
  }
  el.append(kv);

  if (stalled) {
    const note = document.createElement('div');
    note.className = 'stall-note';
    note.textContent = `No fill for ${age(p.stalledSeconds)} — likely undercut. `
      + 'Cancel and re-offer manually if you want the position.';
    el.append(note);
  }
  return el;
}

/**
 * Time-to-fill, measured from your own completed offers.
 *
 * This is the one number here that no public flip site can show you, because
 * computing it needs your order history rather than the shared price feed. It
 * is what turns "the margin is 9 gp" into "the margin is 9 gp and it clears in
 * eleven minutes".
 */
function fillsCard(fills: readonly FillStat[]): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  const h = document.createElement('h3');
  h.textContent = 'Your fill history — measured, not estimated';
  card.append(h);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const [label, cls] of [['Item', ''], ['Side', ''], ['Completed', 'num'],
    ['Median time to fill', 'num'], ['Median realised', 'num']] as Array<[string, string]>) {
    const th = document.createElement('th');
    th.className = cls;
    th.textContent = label;
    hr.append(th);
  }
  thead.append(hr);
  const tbody = document.createElement('tbody');
  for (const f of fills.slice(0, 25)) {
    const tr = document.createElement('tr');
    for (const [text, cls] of [
      [f.name === null ? `item #${f.itemId}` : f.name, ''],
      [f.side, ''],
      [exact(f.completedOffers), 'num'],
      [age(f.medianSecondsToFill), 'num'],
      [`${exact(f.medianRealisedPrice)} gp`, 'num'],
    ] as Array<[string, string]>) {
      const td = document.createElement('td');
      td.className = cls;
      td.textContent = text;
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  card.append(table);
  return card;
}

function outcomesCard(view: OutcomesView): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  const h = document.createElement('h3');
  h.textContent = 'Suggestion outcomes — scored against stored ticks';
  card.append(h);

  const s = view.summary;
  const row = document.createElement('div');
  row.className = 'stat-row';

  const stat = (label: string, value: string, unknown = false): HTMLElement => {
    const d = document.createElement('div');
    d.className = 'stat';
    const v = document.createElement('span');
    v.className = unknown ? 'stat-v unknown' : 'stat-v';
    v.textContent = value;
    const k = document.createElement('span');
    k.className = 'stat-k';
    k.textContent = label;
    d.append(v, k);
    return d;
  };

  row.append(
    stat('scored', exact(s.scored)),
    // A hit rate over zero judged suggestions is not 0%, it is not yet known.
    s.hitRate === null
      ? stat('hit rate', 'not enough data', true)
      : stat('hit rate', pct(s.hitRate)),
    stat('achievable', exact(s.achievable)),
    stat('missed', exact(s.missed)),
    s.medianPredictedNet === null ? stat('median predicted', 'none', true)
      : stat('median predicted', `${exact(s.medianPredictedNet)} gp`),
    s.medianRealisedNet === null ? stat('median realised', 'none', true)
      : stat('median realised', `${exact(s.medianRealisedNet)} gp`),
  );
  card.append(row);

  if (s.unknown > 0) {
    const note = document.createElement('div');
    note.style.marginTop = '10px';
    note.style.fontSize = '11px';
    note.style.color = 'var(--faint)';
    note.textContent = `${exact(s.unknown)} suggestion(s) have no stored tick inside their window `
      + 'and are left unscored rather than counted either way.';
    card.append(note);
  }
  return card;
}
