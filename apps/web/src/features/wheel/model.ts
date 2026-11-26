// The Roulette's view logic, without DOM (openspec: roulette-activity). The rules are the engines' (Wheel: weights,
// shares, what stops a launch: the server's own); this file adds what only the panel needs: the wheel's drawing (its
// sectors and their labels, the needle and its motion), the colours, the numbers as written, and what the editor says.
import { Wheel } from '@slopesque/engines';

export type WheelItem = Wheel.WheelItem;
export type Spin = Wheel.Spin;

/** A proposition's colour, stable when others are added (golden angle). */
export const itemColor = (i: number) => `hsl(${Math.round((200 + i * 137.508) % 360)} 62% 62%)`;
/** A share or a weight as written: whole from 10 (and 0), one decimal below, a decimal comma. */
export const pct = (v: number) =>
  (v >= 10 || v === 0 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace('.', ',');
export const itemName = (it: WheelItem, k: number) => it.label.trim() || `Proposition ${k + 1}`;

// ------------------------------------------------------------------ the wheel (SVG, viewBox -4 -4 208 208)
export const C = 100,
  R = 90,
  NEEDLE = 80;
const TURNS = 6; // full turns before stopping on the drawn angle
/** A coordinate as written in the SVG (two decimals). */
export const f = (n: number) => n.toFixed(2);
/** The point at `deg` degrees clockwise from the top, `r` from the centre. */
export const at = (deg: number, r: number): [number, number] => [
  C + r * Math.sin((deg * Math.PI) / 180),
  C - r * Math.cos((deg * Math.PI) / 180),
];
const P = (deg: number, r: number) => at(deg, r).map(f).join(' ');

export interface Sector {
  i: number;
  /** The wedge's path; null: the only proposition with a share, the whole disc. */
  path: string | null;
  /** Its name and share, when the sector is wide enough (5 % and more; else the legend names it). */
  label: { x: string; y: string; pctY: string; text: string; pct: string } | null;
}

/** The sectors: one per proposition with a share, clockwise from the top, sized by its share. */
export function sectors(items: WheelItem[]): Sector[] {
  const out: Sector[] = [];
  let start = 0;
  for (const [i, s] of Wheel.shares(items).entries()) {
    if (s <= 0) continue;
    const end = start + s * 3.6,
      whole = s >= 99.999;
    const path = whole ? null : `M${C} ${C} L${P(start, R)} A${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${P(end, R)} Z`;
    let label = null;
    if (s >= 5) {
      const [x, y] = at((start + end) / 2, whole ? 0 : R * 0.64),
        max = s >= 20 ? 14 : s >= 10 ? 9 : 5;
      const name = itemName(items[i], i);
      label = {
        x: f(x),
        y: f(y - 2),
        pctY: f(y + 9),
        text: name.length > max ? `${name.slice(0, max - 1)}…` : name,
        pct: `${pct(s)} %`,
      };
    }
    out.push({ i, path, label });
    start = end;
  }
  return out;
}

/** The needle's arrow head. */
export function needleTip() {
  const [x, y] = at(0, NEEDLE + 6);
  return `M${f(x)} ${f(y)} L${C - 5} ${C - NEEDLE + 4} L${C + 5} ${C - NEEDLE + 4} Z`;
}

/** Fast first, slowing down to a stop (ease-out, quartic). */
export const ease = (t: number) => 1 - (1 - t) ** 4;
/** Where the needle is (degrees, 0..360) at `now` (the server's time) during a draw: from where the last draw left it,
 *  TURNS full turns, then the drawn angle; `done` once it stopped. A player joining mid-draw sees it where it is. */
export function needleAt(spin: Spin, now: number) {
  const t = Math.min(1, (now - spin.at) / Wheel.SPIN_MS);
  const turn = TURNS * 360 + ((((spin.angle - spin.from) % 360) + 360) % 360);
  return { deg: (spin.from + turn * ease(Math.max(0, t))) % 360, done: t >= 1 };
}

// ------------------------------------------------------------------ texts
/** What the editor says under the propositions: why the wheel can't be launched (alert), or how the weights given
 *  are shared out. */
export function editorNote(items: WheelItem[]): { alert: boolean; text: string } | null {
  const p = Wheel.problem(items),
    given = Wheel.givenTotal(items),
    free = items.filter(i => Wheel.weightOf(i.weight) === null).length;
  const alert = (text: string) => ({ alert: true, text }),
    note = (text: string) => ({ alert: false, text });
  if (p === 'over')
    return alert(`Total des poids : ${pct(given)} %, au-dessus de 100. Baisse un poids pour lancer la roue.`);
  if (p === 'invalid') return alert('Un poids doit être un nombre positif (ou vide).');
  if (p === 'zero') return alert('Tous les poids sont à 0.');
  if (free && given >= 100)
    return note("Les poids donnés font déjà 100 % : les propositions sans poids n'ont aucune chance.");
  const them = free > 1 ? `${free} propositions` : 'proposition';
  if (free)
    return note(
      `Poids donnés : ${pct(given)} %. Les ${pct(100 - given)} % restants se partagent entre les ${them} sans poids.`,
    );
  if (given < 100) return note(`Total ${pct(given)} % : ramené à 100 % au lancer, en gardant les proportions.`);
  return null;
}

/** A proposition's weight in the legend: « auto » without one. */
export function weightText(it: WheelItem) {
  const w = Wheel.weightOf(it.weight);
  return w === null || Number.isNaN(w) ? 'auto' : `poids ${pct(w)}`;
}

/** The result of a draw: the winner's name, its chances and where the needle stopped. */
export const winnerText = (s: Spin) => ({
  label: itemName(s.items[s.winner], s.winner),
  share: pct(s.shares[s.winner]),
  angle: pct(s.angle),
});
