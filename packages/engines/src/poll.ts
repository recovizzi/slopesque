// The Sondage (openspec: poll-activity): defined choices, free answers, or a gradient (a slider between 2 propositions,
// a polygon whose corners are 3 or more: 2D). Pure rules: answers, grouping, temperatures, the outcome with the
// host's tie-break. Ported from the maquette's poll.ts (the views stay in the app).

export type PollKind = 'choices' | 'free' | 'gradient';
export const POLL_KINDS: Record<PollKind, { name: string; help: string }> = {
  choices: { name: 'Choix définis', help: 'Tu écris les choix (2 minimum), chacun en choisit un.' },
  free: { name: 'Choix libre', help: 'Chacun écrit sa réponse ; les réponses identiques sont regroupées.' },
  gradient: { name: 'Gradient', help: '2 propositions : un point sur un curseur entre les deux. 3 ou plus : un point dans la forme dont elles sont les coins (2D).' },
};
export const MIN_CHOICES = 2, MAX_CHOICES = 8;

export type Point = [number, number];
/** choices: the index of a choice; free: the text; gradient: a point (see corners). */
export type PollAnswer = number | string | Point;
/** pics: in « Choix définis », a picture per choice, optional (an image, a GIF or a sticker), aligned with choices. */
export interface PollPic { kind: 'image' | 'sticker' | 'gif'; src: string; w: number; h: number }
export interface PollDraft { kind: PollKind; question: string; choices: string[]; pics: (PollPic | null)[] }
export interface Poll extends PollDraft { answers: Record<string, PollAnswer> }

export const emptyDraft = (kind: PollKind = 'choices'): PollDraft => ({ kind, question: '', choices: ['', ''], pics: [null, null] });
/** A choice needs a text, or (Choix définis) a picture. */
export const ready = (d: PollDraft) => !!d.question.trim()
  && (d.kind === 'free' || d.choices.every((c, i) => c.trim() || (d.kind === 'choices' && d.pics?.[i])));
/** Free answers are grouped regardless of case, accents, spaces and final punctuation. */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\s.!?…]+$/u, '').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ gradient geometry
/** Corners of the gradient. 2 propositions: the ends of a slider, [0, 0] and [1, 0]. 3 or more: a regular polygon of
 *  radius 1 around [0, 0], the first corner at the top. An answer is a point in the same coordinates. */
export function corners(n: number): Point[] {
  if (n === 2) return [[0, 0], [1, 0]];
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [Math.cos(a), Math.sin(a)] as Point;
  });
}
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const r3 = (v: number) => Math.round(v * 1000) / 1000;

function inside(p: Point, poly: Point[]) {   // convex polygon
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}

const area = (a: Point, b: Point, c: Point) => ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;

/** Position of a point between the corners: weights summing to 1, 1 on a corner, linear along an edge, equal at
 *  the centre. Slider: 1 − t and t. Polygon: Wachspress (generalised barycentric) coordinates. */
function barycentric(p: Point, cs: Point[]): number[] {
  const n = cs.length;
  if (n === 2) return [1 - p[0], p[0]];
  const a = cs.map((c, i) => Math.abs(area(p, c, cs[(i + 1) % n])));   // a[i]: triangle p, corner i, corner i + 1
  const edge = a.findIndex(v => v < 1e-9);
  if (edge >= 0) {   // on an edge (or a corner): linear between its two corners
    const b = (edge + 1) % n, t = dist(p, cs[edge]) / dist(cs[edge], cs[b]);
    return cs.map((_, i) => (i === edge ? 1 - t : i === b ? t : 0));
  }
  const w = cs.map((c, i) => Math.abs(area(cs[(i + n - 1) % n], c, cs[(i + 1) % n])) / (a[(i + n - 1) % n] * a[i]));
  const sum = w.reduce((x, y) => x + y, 0);
  return w.map(v => v / sum);
}

export const SHARPNESS = 2;
/** How one answer splits its 100 points between the propositions: its barycentric weights raised to SHARPNESS,
 *  then normalised (sum 1), so that closeness counts more than linearly and a point leans clearly to its nearest
 *  corner. Halfway from the centre to a corner of a square: 80 % to it, 9 % to each neighbour, 1 % to the opposite;
 *  a corner: 100 %; the centre: equal shares; a slider at 25 %: 90 / 10. */
export function shares(p: Point, cs: Point[]): number[] {
  const w = barycentric(p, cs).map(v => Math.max(0, v) ** SHARPNESS);
  const sum = w.reduce((x, y) => x + y, 0);
  return w.map(v => v / sum);
}

/** Temperature of each proposition: every player hands out the same 100 points according to their position
 *  (shares), the temperature is the mean, in ° (the temperatures add up to about 100). A crowd halfway to a corner
 *  outweighs a single player stuck on another. */
export function temperatures(poll: Poll): number[] {
  const cs = corners(poll.choices.length), pts = Object.values(poll.answers) as Point[];
  if (!pts.length) return cs.map(() => 0);
  const sum = cs.map(() => 0);
  for (const p of pts) shares(p, cs).forEach((v, i) => { sum[i] += v; });
  return sum.map(v => Math.round((100 * v) / pts.length));
}

const LINE = { x0: 18, x1: 282, y: 20 };
const SHAPE = { cx: 150, cy: 98, r: 64 };

/** Answer at an SVG point of the gradient, or null outside the slider / the shape. */
export function fromSvg(n: number, x: number, y: number): Point | null {
  if (n === 2) {
    const t = (x - LINE.x0) / (LINE.x1 - LINE.x0);
    return y < 2 || y > 38 || t < -0.04 || t > 1.04 ? null : [r3(clamp(t, 0, 1)), 0];
  }
  const p: Point = [(x - SHAPE.cx) / SHAPE.r, (y - SHAPE.cy) / SHAPE.r];
  return inside(p, corners(n)) ? [r3(p[0]), r3(p[1])] : null;
}

// ------------------------------------------------------------------ outcome
export interface Ranked { key: string; label: string; ids: string[]; value: number }
export interface Outcome { ranked: Ranked[]; winner: string | null; hostEdge: boolean; tie: boolean }

/** Answers ranked (votes, repeats, or temperature); a tie for number 1 is broken by the host's own answer. */
export function outcome(poll: Poll, hostId: string): Outcome {
  const entries = Object.entries(poll.answers);
  let ranked: Ranked[];
  if (poll.kind === 'choices') {
    ranked = poll.choices.map((label, i) => ({ key: String(i), label, ids: entries.filter(([, a]) => a === i).map(([id]) => id), value: 0 }));
    for (const r of ranked) r.value = r.ids.length;
  } else if (poll.kind === 'free') {
    const groups = new Map<string, Ranked>();
    for (const [id, a] of entries) {
      const key = normalize(a as string);
      const g = groups.get(key) ?? { key, label: (a as string).trim(), ids: [], value: 0 };
      g.ids.push(id); g.value = g.ids.length;
      groups.set(key, g);
    }
    ranked = [...groups.values()];
  } else {
    const temps = temperatures(poll);
    ranked = poll.choices.map((label, i) => ({ key: String(i), label, ids: [], value: temps[i] }));
  }
  ranked.sort((a, b) => b.value - a.value);
  const top = ranked[0]?.value ?? 0;
  const tied = ranked.filter(r => r.value === top);
  if (!top) return { ranked, winner: null, hostEdge: false, tie: false };
  if (tied.length === 1) return { ranked, winner: tied[0].key, hostEdge: false, tie: false };
  // a tie for number 1: the host's answer decides
  const mine = poll.answers[hostId];
  let key: string | null = null;
  if (mine !== undefined) {
    if (poll.kind === 'choices') key = String(mine);
    else if (poll.kind === 'free') key = normalize(mine as string);
    else {
      const cs = corners(poll.choices.length);
      key = tied.map(r => r.key).sort((a, b) => dist(mine as Point, cs[+a]) - dist(mine as Point, cs[+b]))[0];
    }
  }
  const win = tied.find(r => r.key === key);
  if (!win) return { ranked, winner: null, hostEdge: false, tie: true };
  ranked = [win, ...ranked.filter(r => r !== win)];
  return { ranked, winner: win.key, hostEdge: true, tie: false };
}

