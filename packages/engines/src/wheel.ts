// The Roulette (openspec: roulette-activity): a wheel of propositions with optional weights; a draw is an angle drawn
// at random by the server, the sector under the needle wins. Pure rules ported from the maquette's wheel.ts.

/** A proposition being built: its weight as typed ('' = no weight, it shares what is left of 100). */
export interface WheelItem { label: string; weight: string }
export const MIN_ITEMS = 2, MAX_ITEMS = 12;
export const SPIN_MS = 6000;   // length of the draw's animation

/** A draw: the wheel as it was launched, the drawn angle (degrees, clockwise from the top), the winner, and where the
 *  needle starts from (where the previous draw left it), so every player sees the same motion. */
export interface Spin { items: WheelItem[]; shares: number[]; angle: number; winner: number; at: number; from: number }

/** A typed weight: null when empty, NaN when not a number ≥ 0. */
export function weightOf(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Sum of the weights given (the ones typed). Above 100: an alert, the wheel can't be launched. */
export const givenTotal = (items: WheelItem[]) => items.reduce((s, i) => s + (weightOf(i.weight) || 0), 0);

/** Each proposition's share of the wheel, in %, adding up to 100. The propositions without a weight share equally what
 *  the others leave of 100; if the total is still under 100 (all weighted: 60 and 20), it's brought back to 100. */
export function shares(items: WheelItem[]): number[] {
  const ws = items.map(i => weightOf(i.weight)), free = ws.filter(w => w === null).length;
  const rest = Math.max(0, 100 - givenTotal(items));
  const raw = ws.map(w => (w === null ? rest / free : w || 0));
  const total = raw.reduce((s, v) => s + v, 0);
  return total > 0 ? raw.map(v => (v / total) * 100) : items.map(() => 100 / items.length);
}

export type Problem = 'over' | 'invalid' | 'empty' | 'zero' | null;
/** Why the wheel can't be launched yet (null: it can). */
export function problem(items: WheelItem[]): Problem {
  if (items.some(i => Number.isNaN(weightOf(i.weight)))) return 'invalid';
  if (givenTotal(items) > 100) return 'over';
  if (items.length < MIN_ITEMS || items.some(i => !i.label.trim())) return 'empty';
  if (items.every(i => weightOf(i.weight) === 0)) return 'zero';
  return null;
}

/** The sector under an angle (degrees clockwise from the top). */
export function sectorAt(shares: number[], angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  let end = 0;
  for (const [i, s] of shares.entries()) { end += s * 3.6; if (a < end && s > 0) return i; }
  for (let i = shares.length - 1; i >= 0; i--) if (shares[i] > 0) return i;   // 360°, rounding
  return 0;
}

/** Draws a spin: an angle uniform on the circle, the winner under it. */
export function draw(items: WheelItem[], at = Date.now(), from = 0): Spin {
  const sh = shares(items), angle = (crypto.getRandomValues(new Uint32Array(1))[0]! % 3600) / 10;
  return { items: structuredClone(items), shares: sh, angle, winner: sectorAt(sh, angle), at, from };
}

