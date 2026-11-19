// The "Amphithéâtre" voting mode: the half disk drawn as an amphitheatre of ROWS rows × COLS columns of seats
// (same 240 × 130 viewBox as the disk, so the layout doesn't change). The host picks a column, each candidate a
// free seat: one candidate per seat. A column is 0 (left end) … COLS − 1 (right end), a row 0 (nearest the centre)
// … ROWS − 1, a seat the number col × ROWS + row. Drawn after the examples of temp/hemicycle*.svg.
// See openspec/changes/define-game-concept/specs/amphitheatre-mode/spec.md.
import { clamp, CX, CY, el, f, point } from './disk';

export const COLS = 25, ROWS = 7;
const R_IN = 47, DEPTH = 6.2, PITCH = 7.6, GAP = 1.1, ROUND = 1.3;   // radii and sizes in viewBox units
const R_OUT = R_IN + (ROWS - 1) * PITCH + DEPTH;
const R_TRIBUNE = 41;                         // dashed arc inside the first row
const CAP = 3;                                // depth of the column's ends, outside the seats
const UNIT = 100 / COLS;                      // a column, on the 0..100 scale

export const seatOf = (col: number, row: number) => col * ROWS + row;
export const colOf = (seat: number) => Math.floor(seat / ROWS);
export const rowOf = (seat: number) => seat % ROWS;

/** An arc length at radius r, on the 0..100 scale. */
const along = (r: number, len: number) => (len / r) * (100 / Math.PI);
const P = (v: number, r: number) => point(v, r).map(f).join(' ');

/** A seat: an annular sector with rounded corners, a gap around it. */
function seatPath(col: number, row: number) {
  const r0 = R_IN + row * PITCH, r1 = r0 + DEPTH, half = along(r0 + DEPTH / 2, GAP / 2);
  const a = col * UNIT + half, b = (col + 1) * UNIT - half;   // radial sides
  const k0 = along(r0, ROUND), k1 = along(r1, ROUND);
  return `M${P(a, r0 + ROUND)} L${P(a, r1 - ROUND)} Q${P(a, r1)} ${P(a + k1, r1)} A${r1} ${r1} 0 0 1 ${P(b - k1, r1)}`
    + ` Q${P(b, r1)} ${P(b, r1 - ROUND)} L${P(b, r0 + ROUND)} Q${P(b, r0)} ${P(b - k0, r0)} A${r0} ${r0} 0 0 0 ${P(a + k0, r0)}`
    + ` Q${P(a, r0)} ${P(a, r0 + ROUND)} Z`;
}

/** A plain annular sector between two values and two radii. */
function sector(a: number, b: number, r0: number, r1: number) {
  return `M${P(a, r0)} L${P(a, r1)} A${r1} ${r1} 0 0 1 ${P(b, r1)} L${P(b, r0)} A${r0} ${r0} 0 0 0 ${P(a, r0)} Z`;
}

/** Seat under an SVG point (the gaps count as the nearest seat), or null outside the rows. */
function seatAt(x: number, y: number, slack: number): number | null {
  const dx = x - CX, dy = CY - y, r = Math.hypot(dx, dy);
  if (dy < -4 || r < R_IN - slack || r > R_OUT + slack) return null;
  const v = (1 - Math.atan2(Math.max(dy, 0), dx) / Math.PI) * 100;
  const col = clamp(Math.floor(v / UNIT), 0, COLS - 1);
  const row = clamp(Math.round((r - R_IN - DEPTH / 2) / PITCH), 0, ROWS - 1);
  return seatOf(col, row);
}

export type AmphiPick = 'column' | 'seat' | null;
export interface SeatMark { seat: number; color: string; kind: 'player' | 'mine' | 'pending'; label?: string }
/** The host's column: `fill` colours its seats (while choosing, like the examples); `band` also draws it around
 *  and outside the seats, so it stays readable once the candidates' seats cover it. */
export interface ColumnMark { col: number; color: string; style: 'fill' | 'band' }

export class Amphi {
  readonly svg: SVGSVGElement;
  private seats: SVGPathElement[] = [];
  private band: SVGGElement;
  private mode: AmphiPick = null;
  private taken = new Set<number>();
  private hover: number | null = null;   // seat under the pointer or the keyboard position
  private column: ColumnMark | null = null;

  constructor(host: HTMLElement, private opts: { onPick: (n: number) => void }) {
    this.svg = el('svg', { viewBox: '0 0 240 130', class: 'board amphi', role: 'grid', 'aria-label': 'Amphithéâtre' }) as SVGSVGElement;
    this.band = el('g', { class: 'col-band' });
    this.svg.append(el('path', { d: `M${P(0, R_TRIBUNE)} A${R_TRIBUNE} ${R_TRIBUNE} 0 0 1 ${P(100, R_TRIBUNE)}`, class: 'tribune' }), this.band);
    const g = el('g', { class: 'seats' });
    for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) {
      const p = el('path', { d: seatPath(col, row), class: 'seat', 'data-seat': seatOf(col, row) }) as SVGPathElement;
      this.seats[seatOf(col, row)] = p;
      g.append(p);
    }
    this.svg.append(g);
    host.append(this.svg);
    this.wire();
  }

  private at(e: PointerEvent): number | null {
    const m = this.svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return seatAt(p.x, p.y, this.mode === 'column' ? 8 : 2.5);   // a column can be picked a bit outside the seats
  }

  private wire() {
    this.svg.addEventListener('pointermove', e => { if (this.mode) this.setHover(this.at(e)); });
    this.svg.addEventListener('pointerleave', () => this.setHover(null));
    this.svg.addEventListener('click', e => {
      if (!this.mode) return;
      const s = this.at(e as PointerEvent);
      if (s !== null) this.pick(s);
    });
    // keyboard: ← → change column, ↑ ↓ change row (seat mode), Home / End, Enter picks
    this.svg.addEventListener('keydown', e => {
      if (!this.mode) return;
      const s = this.hover ?? seatOf((COLS - 1) / 2, 0);
      let col = colOf(s), row = rowOf(s);
      if (e.key === 'ArrowLeft') col--;
      else if (e.key === 'ArrowRight') col++;
      else if (e.key === 'ArrowUp' && this.mode === 'seat') row++;
      else if (e.key === 'ArrowDown' && this.mode === 'seat') row--;
      else if (e.key === 'Home') col = 0;
      else if (e.key === 'End') col = COLS - 1;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(s); return; }
      else return;
      e.preventDefault();
      this.setHover(seatOf(clamp(col, 0, COLS - 1), clamp(row, 0, ROWS - 1)));
    });
  }

  private pick(s: number) {
    if (this.mode === 'column') this.opts.onPick(colOf(s));
    else if (this.mode === 'seat' && !this.taken.has(s)) this.opts.onPick(s);
  }

  private setHover(s: number | null) {
    this.hover = s;
    for (const [i, p] of this.seats.entries()) {
      const on = s !== null && (this.mode === 'column' ? colOf(i) === colOf(s) : i === s && !this.taken.has(i));
      p.classList.toggle('is-hover', on);
    }
  }

  setInteractive(mode: AmphiPick) {
    this.mode = mode;
    this.svg.classList.toggle('is-interactive', !!mode);
    this.svg.dataset.pick = mode ?? '';
    if (mode) this.svg.setAttribute('tabindex', '0'); else { this.svg.removeAttribute('tabindex'); this.setHover(null); }
  }

  /** Colours the host's column and the seats: validated (taken, can't be picked) or mine not validated yet. */
  setMarks(column: ColumnMark | null, marks: SeatMark[]) {
    this.taken = new Set(marks.filter(m => m.kind === 'player').map(m => m.seat));
    const bySeat = new Map(marks.map(m => [m.seat, m]));
    for (const [i, p] of this.seats.entries()) {
      const m = bySeat.get(i), inCol = column !== null && colOf(i) === column.col;
      p.setAttribute('class', ['seat', inCol ? `is-col col-${column!.style}` : '', m ? `is-${m.kind}` : '', this.taken.has(i) ? 'is-taken' : '',
        p.classList.contains('is-hover') ? 'is-hover' : ''].filter(Boolean).join(' '));
      p.style.cssText = `${m ? `--c:${m.color};` : ''}${inCol ? `--hc:${column!.color};` : ''}`;
      p.replaceChildren();
      if (m?.label) { const t = el('title', {}); t.textContent = m.label; p.append(t); }
    }
    if (JSON.stringify(column) === JSON.stringify(this.column)) return;
    this.column = column;
    this.band.replaceChildren();
    if (column?.style !== 'band') return;
    // the column, around the seats and beyond them: a light band from the tribune to the outside, solid ends
    const a = column.col * UNIT, b = a + UNIT;
    this.band.setAttribute('style', `--hc:${column.color}`);
    this.band.append(
      el('path', { d: sector(a, b, R_TRIBUNE, R_OUT + CAP + 1), class: 'band' }),
      el('path', { d: sector(a, b, R_OUT + 1, R_OUT + 1 + CAP), class: 'cap' }),
      el('path', { d: sector(a, b, R_TRIBUNE, R_TRIBUNE + CAP), class: 'cap' }),
    );
  }
}
