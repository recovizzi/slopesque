// The Amphithéâtre's geometry (openspec: amphitheatre-mode): the half disk drawn as an amphitheatre of ROWS rows ×
// COLS columns of seats, in the disk's 240 × 130 viewBox (model.ts), so the layout doesn't change. The host picks a
// column 0 (left end) … COLS − 1 (right end), each candidate a free seat: a row 0 (nearest the centre) … ROWS − 1, a
// seat the number column × ROWS + row (the engines' seatOf). Drawn after the examples of temp/hemicycle*.svg.
import { colOf, COLS, rowOf, ROWS, seatOf } from '@slopesque/engines';
import { clamp, CX, CY, f, point } from './model';

// radii and sizes in viewBox units: the first row's inner radius, a seat's depth, a row's pitch, the gap between two
// seats, the rounding of their corners
const R_IN = 47;
const DEPTH = 6.2;
const PITCH = 7.6;
const GAP = 1.1;
const ROUND = 1.3;
const R_OUT = R_IN + (ROWS - 1) * PITCH + DEPTH;
const R_TRIBUNE = 41; // dashed arc inside the first row
const CAP = 3; // depth of the column's ends, outside the seats
const UNIT = 100 / COLS; // a column, on the 0..100 scale

export type AmphiPick = 'column' | 'seat' | null;
export interface SeatMark {
  seat: number;
  color: string;
  kind: 'player' | 'mine' | 'pending';
  label?: string;
}
/** The host's column: `fill` colours its seats (while choosing, like the examples); `band` also draws it around
 *  and outside the seats, so it stays readable once the candidates' seats cover it. */
export interface ColumnMark {
  col: number;
  color: string;
  style: 'fill' | 'band';
}

/** An arc length at radius r, on the 0..100 scale. */
const along = (r: number, len: number) => (len / r) * (100 / Math.PI);
const P = (v: number, r: number) => point(v, r).map(f).join(' ');

/** A seat: an annular sector with rounded corners, a gap around it. */
export function seatPath(col: number, row: number) {
  const r0 = R_IN + row * PITCH,
    r1 = r0 + DEPTH,
    half = along(r0 + DEPTH / 2, GAP / 2);
  const a = col * UNIT + half,
    b = (col + 1) * UNIT - half; // radial sides
  const k0 = along(r0, ROUND),
    k1 = along(r1, ROUND);
  return (
    `M${P(a, r0 + ROUND)} L${P(a, r1 - ROUND)} Q${P(a, r1)} ${P(a + k1, r1)} A${r1} ${r1} 0 0 1 ${P(b - k1, r1)}` +
    ` Q${P(b, r1)} ${P(b, r1 - ROUND)} L${P(b, r0 + ROUND)} Q${P(b, r0)} ${P(b - k0, r0)} A${r0} ${r0} 0 0 0 ${P(a + k0, r0)}` +
    ` Q${P(a, r0)} ${P(a, r0 + ROUND)} Z`
  );
}

/** Every seat's path, by seat number (computed once). */
export const SEAT_PATHS: string[] = Array.from({ length: COLS * ROWS }, (_, s) => seatPath(colOf(s), rowOf(s)));

/** A plain annular sector between two values and two radii. */
export function sector(a: number, b: number, r0: number, r1: number) {
  return `M${P(a, r0)} L${P(a, r1)} A${r1} ${r1} 0 0 1 ${P(b, r1)} L${P(b, r0)} A${r0} ${r0} 0 0 0 ${P(a, r0)} Z`;
}

/** The dashed arc of the tribune, inside the first row. */
export const TRIBUNE = `M${P(0, R_TRIBUNE)} A${R_TRIBUNE} ${R_TRIBUNE} 0 0 1 ${P(100, R_TRIBUNE)}`;

/** The host's column drawn as a band: light from the tribune to beyond the seats, with solid ends. */
export function columnBand(col: number) {
  const a = col * UNIT,
    b = a + UNIT;
  return {
    band: sector(a, b, R_TRIBUNE, R_OUT + CAP + 1),
    caps: [sector(a, b, R_OUT + 1, R_OUT + 1 + CAP), sector(a, b, R_TRIBUNE, R_TRIBUNE + CAP)],
  };
}

/** Seat under an SVG point (the gaps count as the nearest seat), or null outside the rows. */
export function seatAt(x: number, y: number, slack: number): number | null {
  const dx = x - CX,
    dy = CY - y,
    r = Math.hypot(dx, dy);
  if (dy < -4 || r < R_IN - slack || r > R_OUT + slack) return null;
  const v = (1 - Math.atan2(Math.max(dy, 0), dx) / Math.PI) * 100;
  const col = clamp(Math.floor(v / UNIT), 0, COLS - 1);
  const row = clamp(Math.round((r - R_IN - DEPTH / 2) / PITCH), 0, ROWS - 1);
  return seatOf(col, row);
}

/** How far outside the seats a pointer still picks: a column a bit more than a seat. */
export const slackOf = (mode: AmphiPick) => (mode === 'column' ? 8 : 2.5);

/** The keyboard on the seats: ← → change column, ↑ ↓ change row (seat mode), Home / End go to the ends, Enter or
 *  Space picks the seat shown (from the middle column, first row). Null: a key the board leaves alone. */
export function seatKey(
  key: string,
  mode: 'column' | 'seat',
  hover: number | null,
): { move: number } | { pick: number } | null {
  const s = hover ?? seatOf((COLS - 1) / 2, 0);
  let col = colOf(s),
    row = rowOf(s);
  if (key === 'ArrowLeft') col--;
  else if (key === 'ArrowRight') col++;
  else if (key === 'ArrowUp' && mode === 'seat') row++;
  else if (key === 'ArrowDown' && mode === 'seat') row--;
  else if (key === 'Home') col = 0;
  else if (key === 'End') col = COLS - 1;
  else if (key === 'Enter' || key === ' ') return { pick: s };
  else return null;
  return { move: seatOf(clamp(col, 0, COLS - 1), clamp(row, 0, ROWS - 1)) };
}

/** What a pick on seat `s` gives: the column (host), the seat if free (candidate), or nothing. */
export function pickOf(mode: AmphiPick, s: number, taken: Set<number>): number | null {
  if (mode === 'column') return colOf(s);
  if (mode === 'seat' && !taken.has(s)) return s;
  return null;
}

/** Is seat `i` lit under the pointer (or the keyboard): its whole column (host), or itself when free (candidate)? */
export function isHover(mode: AmphiPick, hover: number | null, i: number, taken: Set<number>) {
  if (hover === null || !mode) return false;
  return mode === 'column' ? colOf(i) === colOf(hover) : i === hover && !taken.has(i);
}

/** Is seat `i` in the host's column? */
export const inColumn = (i: number, column: ColumnMark | null): column is ColumnMark =>
  column !== null && colOf(i) === column.col;

/** A seat's classes: in the host's column (filled or banded), marked (a player's, mine, mine not validated), taken
 *  (can't be picked), lit. */
export function seatClass(
  i: number,
  column: ColumnMark | null,
  mark: SeatMark | undefined,
  taken: boolean,
  hover: boolean,
) {
  return [
    'seat',
    inColumn(i, column) ? `is-col col-${column.style}` : '',
    mark ? `is-${mark.kind}` : '',
    taken ? 'is-taken' : '',
    hover ? 'is-hover' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
