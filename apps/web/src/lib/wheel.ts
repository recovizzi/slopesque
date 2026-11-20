// The "Roulette" activity: the host builds a wheel of propositions, each with an optional weight, in the game area;
// everyone watches it being built. On the draw, an angle 0..360 is drawn at random (the server's job) and a needle
// spins fast, slows down and stops on it: the sector under the needle wins.
// See openspec/changes/define-game-concept/specs/roulette-activity/spec.md.
import { el, f } from './disk';
import { esc } from './html';
import { icon } from './icons';

/** A proposition being built: its weight as typed ('' = no weight, it shares what is left of 100). */
export interface WheelItem { label: string; weight: string }
export const MIN_ITEMS = 2, MAX_ITEMS = 12;
export const SPIN_MS = 6000;   // length of the draw's animation
const TURNS = 6;               // full turns before stopping on the drawn angle

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
  const sh = shares(items), angle = (Math.round(Math.random() * 3600) / 10) % 360;
  return { items: structuredClone(items), shares: sh, angle, winner: sectorAt(sh, angle), at, from };
}

/** A proposition's colour, stable when others are added (golden angle). */
export const itemColor = (i: number) => `hsl(${Math.round((200 + i * 137.508) % 360)} 62% 62%)`;
const pct = (v: number) => (v >= 10 || v === 0 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace('.', ',');
const name = (i: WheelItem, k: number) => i.label.trim() || `Proposition ${k + 1}`;

// ------------------------------------------------------------------ the wheel (persistent SVG)
const C = 100, R = 90, NEEDLE = 80;
const at = (deg: number, r: number) => [C + r * Math.sin((deg * Math.PI) / 180), C - r * Math.cos((deg * Math.PI) / 180)];
const P = (deg: number, r: number) => at(deg, r).map(f).join(' ');
/** Fast first, slowing down to a stop (ease-out, quartic). */
const ease = (t: number) => 1 - (1 - t) ** 4;

export class Wheel {
  readonly svg: SVGSVGElement;
  private sectors: SVGGElement;
  private needle: SVGGElement;
  private drawn = '';
  private spin: Spin | null = null;
  private frame = 0;

  constructor(host: HTMLElement) {
    this.svg = el('svg', { viewBox: '-4 -4 208 208', class: 'wheel', role: 'img', 'aria-label': 'Roulette' }) as SVGSVGElement;
    this.sectors = el('g', { class: 'wheel-sectors' });
    this.needle = el('g', { class: 'wheel-needle' });
    const [tx, ty] = at(0, NEEDLE + 6);
    this.needle.append(
      el('line', { x1: C, y1: C, x2: C, y2: C - NEEDLE }),
      el('path', { d: `M${f(tx)} ${f(ty)} L${C - 5} ${C - NEEDLE + 4} L${C + 5} ${C - NEEDLE + 4} Z`, class: 'needle-tip' }),
      el('circle', { cx: C, cy: C, r: 7, class: 'hub' }),
    );
    this.svg.append(el('circle', { cx: C, cy: C, r: R, class: 'wheel-bg' }), this.sectors, el('circle', { cx: C, cy: C, r: R, class: 'wheel-rim' }), this.needle);
    host.append(this.svg);
    this.turn(0);
  }

  /** The sectors: one per proposition, sized by its share; `winner` highlighted after a draw. */
  setItems(items: WheelItem[], winner: number | null = null) {
    const sh = shares(items), key = JSON.stringify([items, winner]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.svg.classList.toggle('has-winner', winner !== null);
    this.sectors.replaceChildren();
    let start = 0;
    for (const [i, s] of sh.entries()) {
      if (s <= 0) continue;
      const end = start + s * 3.6, mid = (start + end) / 2;
      const g = el('g', { class: `sector${i === winner ? ' is-winner' : ''}`, style: `--c:${itemColor(i)}`, 'data-i': i });
      g.append(s >= 99.999
        ? el('circle', { cx: C, cy: C, r: R })
        : el('path', { d: `M${C} ${C} L${P(start, R)} A${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${P(end, R)} Z` }));
      if (s >= 5) {   // too thin: the legend names it
        const [x, y] = at(mid, s >= 99.999 ? 0 : R * 0.64), max = s >= 20 ? 14 : s >= 10 ? 9 : 5;
        const label = name(items[i], i), t = el('text', { x: f(x), y: f(y - 2), class: 'sector-label' });
        t.textContent = label.length > max ? `${label.slice(0, max - 1)}…` : label;
        const p = el('text', { x: f(x), y: f(y + 9), class: 'sector-pct' });
        p.textContent = `${pct(s)} %`;
        g.append(t, p);
      }
      this.sectors.append(g);
      start = end;
    }
  }

  /** Spins the needle to the drawn angle, from `spin.at` (a player joining mid-draw sees it where it is); null leaves
   *  it where it stopped. `skew`: the server's time minus this device's (the start is the server's, whatever the clock
   *  here; the result is the server's anyway). */
  setSpin(spin: Spin | null, skew = 0) {
    if (spin === this.spin) return;
    this.spin = spin;
    cancelAnimationFrame(this.frame);
    if (!spin) return;
    const turn = TURNS * 360 + ((((spin.angle - spin.from) % 360) + 360) % 360);
    const step = () => {
      const t = Math.min(1, (Date.now() + skew - spin.at) / SPIN_MS);
      this.turn(spin.from + turn * ease(Math.max(0, t)));
      this.svg.classList.toggle('is-spinning', t < 1);
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    step();
  }

  private turn(deg: number) {
    this.needle.setAttribute('transform', `rotate(${f(deg % 360)} ${C} ${C})`);
    this.svg.dataset.angle = f(deg % 360);
  }
}

// ------------------------------------------------------------------ views
/** The host builds the wheel: a label and an optional weight per proposition, their share, the alert above 100. */
export function editorHtml(items: WheelItem[]): string {
  const sh = shares(items), given = givenTotal(items), free = items.filter(i => weightOf(i.weight) === null).length;
  const rows = items.map((it, i) => {
    const bad = Number.isNaN(weightOf(it.weight));
    return `<li style="--c:${itemColor(i)}"><span class="swatch"></span>
      <input data-wh="label" data-i="${i}" value="${esc(it.label)}" maxlength="30" placeholder="Proposition ${i + 1}" autocomplete="off" aria-label="Proposition ${i + 1}">
      <input class="weight ${bad ? 'is-bad' : ''}" data-wh="weight" data-i="${i}" value="${esc(it.weight)}" maxlength="5" inputmode="decimal" placeholder="auto" autocomplete="off" aria-label="Poids de la proposition ${i + 1}">
      <span class="share" data-share="${i}">${pct(sh[i])} %</span>
      ${items.length > MIN_ITEMS ? `<button class="icon-btn sm" type="button" data-action="wheel-remove" data-i="${i}" title="Retirer" aria-label="Retirer">${icon.close}</button>` : '<span class="icon-sp"></span>'}</li>`;
  }).join('');
  const p = problem(items);
  let note = '';
  if (p === 'over') note = `<p class="wheel-alert" role="alert">Total des poids : ${pct(given)} %, au-dessus de 100. Baisse un poids pour lancer la roue.</p>`;
  else if (p === 'invalid') note = '<p class="wheel-alert" role="alert">Un poids doit être un nombre positif (ou vide).</p>';
  else if (p === 'zero') note = '<p class="wheel-alert" role="alert">Tous les poids sont à 0.</p>';
  else if (free && given >= 100) note = `<p class="note">Les poids donnés font déjà 100 % : les propositions sans poids n'ont aucune chance.</p>`;
  else if (free) note = `<p class="note">Poids donnés : ${pct(given)} %. Les ${pct(100 - given)} % restants se partagent entre les ${free > 1 ? `${free} propositions` : 'proposition'} sans poids.</p>`;
  else if (given < 100) note = `<p class="note">Total ${pct(given)} % : ramené à 100 % au lancer, en gardant les proportions.</p>`;
  return `<div class="wheel-edit">
    <div class="wheel-head"><span>Proposition</span><span>Poids</span><span>Part</span></div>
    <ol class="wheel-items">${rows}</ol>
    ${items.length < MAX_ITEMS ? '<button class="btn ghost sm" type="button" data-action="wheel-add">+ Ajouter une proposition</button>' : ''}
    ${note}</div>`;
}

/** Everyone else (and the host during the draw): the propositions, their weight and share; the winner after a draw. */
export function legendHtml(items: WheelItem[], winner: number | null = null): string {
  if (!items.length) return '<p class="poll-wait">La roue est vide pour l\'instant.</p>';
  const sh = shares(items);
  return `<ol class="wheel-legend">${items.map((it, i) => {
    const w = weightOf(it.weight);
    return `<li class="${i === winner ? 'win' : ''}" style="--c:${itemColor(i)}"><span class="swatch"></span>
      <span class="legend-label ${it.label.trim() ? '' : 'is-empty'}">${i === winner ? `<span class="crown">${icon.crown}</span>` : ''}${esc(name(it, i))}</span>
      <small>${w === null || Number.isNaN(w) ? 'auto' : `poids ${pct(w)}`}</small><b>${pct(sh[i])} %</b></li>`;
  }).join('')}</ol>`;
}

export const winnerText = (s: Spin) => ({ label: name(s.items[s.winner], s.winner), share: pct(s.shares[s.winner]), angle: pct(s.angle) });
