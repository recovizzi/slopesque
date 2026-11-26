// The Sondage's view logic, without DOM (openspec: poll-activity). The rules are the engines' (Poll: kinds, corners,
// fromSvg, ready…: the server's own); this file adds what only the panel needs: the draft being written and what is
// published of it, where the gradient draws its slider or polygon, its labels and its answers, the heatmap's pixels
// and colours, and the times and counts shown.
import { Poll } from '@slopesque/engines';
import type { GifRef } from '@slopesque/shared';

export type Point = Poll.Point;
export type PollKind = Poll.PollKind;

// ------------------------------------------------------------------ the draft (the host writes the poll)
/** A choice's picture while writing: what is shown, and how the server finds it (an image uploaded for the poll, a
 *  sticker of the room, a GIF's link). */
export interface DraftPic extends Poll.PollPic {
  mediaId?: string;
  stickerId?: string;
  gif?: GifRef;
}
/** The poll being written; `keys` name its rows (a row keeps its field and its picture when another is removed). */
export interface Draft extends Poll.PollDraft {
  pics: (DraftPic | null)[];
  keys: number[];
}

let lastKey = 0;
const newKey = () => ++lastKey;

export const emptyDraft = (kind: PollKind = 'choices'): Draft => ({
  ...Poll.emptyDraft(kind),
  pics: [null, null],
  keys: [newKey(), newKey()],
});
export const setKind = (d: Draft, kind: PollKind): Draft => ({ ...d, kind });
export const setQuestion = (d: Draft, question: string): Draft => ({ ...d, question });
export const setChoice = (d: Draft, i: number, text: string): Draft => ({
  ...d,
  choices: d.choices.map((c, k) => (k === i ? text : c)),
});
export const setPic = (d: Draft, i: number, pic: DraftPic | null): Draft => ({
  ...d,
  pics: d.choices.map((_, k) => (k === i ? pic : (d.pics[k] ?? null))),
});
export const addChoice = (d: Draft): Draft =>
  d.choices.length >= Poll.MAX_CHOICES
    ? d
    : { ...d, choices: [...d.choices, ''], pics: [...d.pics, null], keys: [...d.keys, newKey()] };
export const removeChoice = (d: Draft, i: number): Draft => ({
  ...d,
  choices: d.choices.filter((_, k) => k !== i),
  pics: d.pics.filter((_, k) => k !== i),
  keys: d.keys.filter((_, k) => k !== i),
});
/** `f` applied to the row named `key`, if it is still there (a picture arrives after its row was removed…). */
export const atRow = (d: Draft, key: number, f: (d: Draft, i: number) => Draft) => {
  const i = d.keys.indexOf(key);
  return i < 0 ? d : f(d, i);
};

/** The intent `poll:publish`: no choices for free answers, pictures only for « Choix définis » (each as the server
 *  finds it). */
export const publishBody = (d: Draft) => ({
  kind: d.kind,
  question: d.question,
  choices: d.kind === 'free' ? [] : d.choices,
  pics:
    d.kind === 'choices'
      ? d.pics.map(p => (p ? { mediaId: p.mediaId, stickerId: p.stickerId, gif: p.gif } : null))
      : [],
});

/** `insert` typed over the selection [start, end) of `text`, cut at `max`: the new text and where the caret goes. */
export function insertAt(text: string, start: number, end: number, insert: string, max: number) {
  return { text: (text.slice(0, start) + insert + text.slice(end)).slice(0, max), caret: start + insert.length };
}

export const picOf = (p: { pics?: (Poll.PollPic | null)[] }, i: number) => p.pics?.[i] ?? null;

// ------------------------------------------------------------------ the gradient's drawing (SVG, 300 wide)
/** The slider (2 propositions) and the polygon (3+): Poll.fromSvg reads a click with the same numbers. */
export const LINE = { x0: 18, x1: 282, y: 20 };
export const SHAPE = { cx: 150, cy: 98, r: 64 };

/** A point of the gradient (Poll.corners' coordinates) in the SVG. */
export const toSvg = (n: number, p: Point): Point =>
  n === 2 ? [LINE.x0 + (LINE.x1 - LINE.x0) * p[0], LINE.y] : [SHAPE.cx + SHAPE.r * p[0], SHAPE.cy + SHAPE.r * p[1]];
/** A coordinate as written in the SVG (one decimal). */
export const fx = (v: number) => v.toFixed(1);
/** The polygon's corners as an SVG `points` list. */
export const polygonPoints = (n: number) =>
  Poll.corners(n)
    .map(p => toSvg(n, p).map(fx).join(','))
    .join(' ');
/** An answer's dot: bigger on the slider. */
export const dotRadius = (n: number) => (n === 2 ? 6 : 4.5);
/** A proposition's name, cut to fit next to its corner. */
export const short = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export const propositionName = (choices: string[], i: number) => choices[i] || `Proposition ${i + 1}`;

export interface Label {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}
/** Where each proposition's name goes: under the ends of the slider; around the polygon, a little outside its corner
 *  (below the low corners, above the top one), anchored away from the centre. */
export function labelPlaces(n: number): Label[] {
  if (n === 2)
    return [
      { x: LINE.x0, y: 46, anchor: 'start' },
      { x: LINE.x1, y: 46, anchor: 'end' },
    ];
  return Poll.corners(n).map(p => {
    const [x, y] = toSvg(n, [p[0] * 1.16, p[1] * 1.16]);
    const dy = p[1] > 0.3 ? 5 : p[1] < -0.9 ? -2 : 0;
    return { x, y: y + 3 + dy, anchor: p[0] > 0.2 ? 'start' : p[0] < -0.2 ? 'end' : 'middle' };
  });
}

// ------------------------------------------------------------------ the heatmap
/** Cold (blue) → hot (red), for 0..1 (a temperature relative to the hottest, like the heatmap). */
export const heatColor = (v: number) => `hsl(${Math.round(230 * (1 - v))} 72% 48%)`;
/** A temperature's colour, relative to the hottest of the poll. */
export const tempColor = (value: number, values: number[]) => {
  const max = Math.max(0, ...values);
  return heatColor(max ? value / max : 0);
};

export function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The heatmap's pixels (RGBA): a 1D strip of 200 under the slider, or 100 × 100 over the polygon's box; each answer
 *  a gaussian, the densest place red, nearly empty places transparent. */
export function heatPixels(n: number, pts: Point[]) {
  const one = n === 2,
    w = one ? 200 : 100,
    h = one ? 1 : 100,
    sigma = one ? 0.07 : 0.24;
  const at = (i: number, j: number): Point =>
    one ? [(i + 0.5) / w, 0] : [((i + 0.5) / w) * 2 - 1, ((j + 0.5) / h) * 2 - 1];
  const dens = new Float32Array(w * h);
  let max = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const p = at(i, j);
      const d = pts.reduce((s, q) => s + Math.exp(-(dist(p, q) ** 2) / (2 * sigma * sigma)), 0);
      dens[j * w + i] = d;
      max = Math.max(max, d);
    }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    const v = max ? dens[k] / max : 0;
    const [r, g, b] = hslRgb(230 * (1 - v), 0.72, 0.5);
    data.set([r, g, b, v < 0.03 ? 0 : (0.2 + 0.7 * v) * 255], k * 4);
  }
  return { w, h, data };
}

// ------------------------------------------------------------------ times and counts
/** A poll's answer time: « 3 min », « 1 h ». */
export const fmtDuration = (s: number) => (s < 3600 ? `${s / 60} min` : `${s / 3600} h`);
/** Time left on the stage: « 42 s », « 4:05 », « 2 h 05 min ». */
export function fmtLeft(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
/** Time left in a chat message (shorter): « 4:05 », « 2 h 05 ». */
export function fmtLeftShort(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000)),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
/** « 1 réponse », « 3 réponses ». */
export const answers = (n: number) => `${n} réponse${n > 1 ? 's' : ''}`;
/** A choice's share of the answers, in whole %. */
export const percent = (value: number, total: number) => (total ? Math.round((100 * value) / total) : 0);
