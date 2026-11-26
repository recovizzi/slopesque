// The half disk's geometry (openspec: semicircle-disk): an outlined half disk, open at the bottom, in a 240 × 130
// viewBox (shared with the Amphithéâtre, amphi-model.ts). A position is a value from 0 (left end) to 100 (right end):
// the angle of a ray from the centre, value × 1.8°. This module (and amphi-model.ts) is the only place that turns a
// value into SVG coordinates; the rest of the app, the server and the scoring only see the value.

export type RayKind = 'target' | 'player' | 'mine' | 'ghost';
export interface Ray {
  id: string;
  value: number; // 0..100
  color: string;
  kind: RayKind;
  label?: string;
}

export const VIEWBOX = '0 0 240 130';
export const R = 108; // the half disk's radius
export const CX = 120; // the centre, at the middle of the base
export const CY = 120;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** A coordinate as written in a path (two decimals). */
export const f = (n: number) => n.toFixed(2);

/** Point at `value` (0 left … 100 right) on a circle of radius `r`. */
export function point(value: number, r = R): [number, number] {
  const phi = Math.PI * (1 - value / 100); // angle from the positive x axis
  return [CX + r * Math.cos(phi), CY - r * Math.sin(phi)];
}

/** Value under an SVG point, or null when it's outside the half disk (a little slack on the edges). */
export function valueAt(x: number, y: number): number | null {
  const dx = x - CX,
    dy = CY - y;
  if (dy < -6 || Math.hypot(dx, dy) > R + 6) return null;
  const phi = Math.atan2(Math.max(dy, 0), dx); // 0 (right) … π (left)
  return Math.round(clamp((1 - phi / Math.PI) * 100, 0, 100) * 10) / 10;
}

/** The half disk's outline (its fill, and its stroke on top of the rays). */
export const OUTLINE = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY} Z`;

export interface Segment {
  x1: string | number;
  y1: string | number;
  x2: string | number;
  y2: string | number;
}

/** A line from the centre to `value`, at radius `r`. */
export function spoke(value: number, r = R): Segment {
  const [x, y] = point(value, r);
  return { x1: CX, y1: CY, x2: f(x), y2: f(y) };
}

/** The graduations: every 10, the middle one longer. */
export const TICKS: Segment[] = Array.from({ length: 9 }, (_, i) => {
  const v = (i + 1) * 10;
  const [x1, y1] = point(v, R - (v === 50 ? 10 : 5)),
    [x2, y2] = point(v, R);
  return { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) };
});

/** Wedge (sector) between two values: the target ray, drawn as thick as its tolerance. */
export function wedge(from: number, to: number, r = R) {
  const [x1, y1] = point(clamp(from, 0, 100), r),
    [x2, y2] = point(clamp(to, 0, 100), r);
  return `M${CX} ${CY} L${f(x1)} ${f(y1)} A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)} Z`;
}

/** The rays in drawing order: the targets first, then the players' (mine last: on top of the others). */
export function drawOrder(rays: Ray[]) {
  const order = (r: Ray) => (r.kind === 'mine' ? 1 : 0);
  return {
    targets: rays.filter(r => r.kind === 'target'),
    others: rays.filter(r => r.kind !== 'target').sort((a, b) => order(a) - order(b)),
  };
}

/** A player's ray: a line that stops short of the edge, a dot on the edge (bigger for mine). */
export function rayShape(r: Ray) {
  const [cx, cy] = point(r.value);
  return { line: spoke(r.value, R - 9), dot: { cx: f(cx), cy: f(cy), r: r.kind === 'mine' ? 5 : 4 } };
}

/** The keyboard on the disk: ← → (and ↓ ↑) move by 1 (Shift: 5), Home / End go to the ends, Enter or Space
 *  confirms the position shown. Null: a key the disk leaves alone. */
export function rayKey(
  key: string,
  shift: boolean,
  current: number | null,
): { move: number } | { pick: number } | null {
  const step = shift ? 5 : 1;
  const v = current ?? 50;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return { move: clamp(v - step, 0, 100) };
  if (key === 'ArrowRight' || key === 'ArrowUp') return { move: clamp(v + step, 0, 100) };
  if (key === 'Home') return { move: 0 };
  if (key === 'End') return { move: 100 };
  if (key === 'Enter' || key === ' ') return { pick: v };
  return null;
}
