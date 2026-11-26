// The "Sondage" activity: the host writes a question and picks how to answer it — defined choices, free answers,
// or a gradient (a point on a slider between 2 propositions, or inside the polygon whose corners are 3 or more
// propositions: 2D). Model, geometry, outcome (with the host's tie-break) and the HTML / SVG of each view.
// See openspec/changes/define-game-concept/specs/poll-activity/spec.md.
type Media = { kind: 'image' | 'sticker' | 'gif'; src: string; w: number; h: number };
type Sticker = { id: string; src: string; w: number; h: number };
import { withCustom, type CustomEmoji } from '../../lib/emoji';
import { esc } from '../../legacy/html';
import { icon } from '../../legacy/icons';

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
export interface PollDraft { kind: PollKind; question: string; choices: string[]; pics: (Media | null)[] }
export interface Poll extends PollDraft { answers: Record<string, PollAnswer> }

export const emptyDraft = (kind: PollKind = 'choices'): PollDraft => ({ kind, question: '', choices: ['', ''], pics: [null, null] });
/** A choice needs a text, or (Choix définis) a picture. */
export const ready = (d: PollDraft) => !!d.question.trim()
  && (d.kind === 'free' || d.choices.every((c, i) => c.trim() || (d.kind === 'choices' && d.pics?.[i])));
export const picOf = (p: { pics?: (Media | null)[] }, i: number) => p.pics?.[i] ?? null;
/** A choice's label, the game's custom emoji as their image; « Choix 2 » for a choice that is only a picture. */
const choiceLabel = (c: string, i: number, custom: CustomEmoji[]) => (c.trim() ? withCustom(esc(c), custom) : `<i>Choix ${i + 1}</i>`);
const picHtml = (m: Media, cls: string) => `<img class="${cls} pic-${m.kind}" src="${esc(m.src)}" width="${m.w}" height="${m.h}" alt="" loading="lazy" draggable="false">`;

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
const r3 = (v: number) => Math.round(v * 1000) / 1000;

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

// SVG: viewBox 300 wide; the slider (1D) or the polygon (2D)
const LINE = { x0: 18, x1: 282, y: 20 };
const SHAPE = { cx: 150, cy: 98, r: 64 };
const toSvg = (n: number, p: Point): Point =>
  n === 2 ? [LINE.x0 + (LINE.x1 - LINE.x0) * p[0], LINE.y] : [SHAPE.cx + SHAPE.r * p[0], SHAPE.cy + SHAPE.r * p[1]];

/** Answer at an SVG point of the gradient, or null outside the slider / the shape. */
export function fromSvg(n: number, x: number, y: number): Point | null {
  if (n === 2) {
    const t = (x - LINE.x0) / (LINE.x1 - LINE.x0);
    return y < 2 || y > 38 || t < -0.04 || t > 1.04 ? null : [r3(clamp(t, 0, 1)), 0];
  }
  const p: Point = [(x - SHAPE.cx) / SHAPE.r, (y - SHAPE.cy) / SHAPE.r];
  return inside(p, corners(n)) ? [r3(p[0]), r3(p[1])] : null;
}

/** Cold (blue) → hot (red), for 0..1 (a temperature relative to the hottest, like the heatmap). */
export const heatColor = (v: number) => `hsl(${Math.round(230 * (1 - v))} 72% 48%)`;

function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const heatCache = new Map<string, string>();
/** Heatmap of the answers as a PNG data URL: a 1D strip under the slider, or a square over the polygon's box. */
function heatmap(n: number, pts: Point[]): string {
  const key = `${n}|${JSON.stringify(pts)}`;
  const hit = heatCache.get(key);
  if (hit) return hit;
  const one = n === 2, w = one ? 200 : 100, h = one ? 1 : 100, sigma = one ? 0.07 : 0.24;
  const at = (i: number, j: number): Point => (one ? [(i + 0.5) / w, 0] : [((i + 0.5) / w) * 2 - 1, ((j + 0.5) / h) * 2 - 1]);
  const dens = new Float32Array(w * h);
  let max = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = at(i, j);
    const d = pts.reduce((s, q) => s + Math.exp(-(dist(p, q) ** 2) / (2 * sigma * sigma)), 0);
    dens[j * w + i] = d;
    max = Math.max(max, d);
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!, img = ctx.createImageData(w, h);
  for (let k = 0; k < w * h; k++) {
    const v = max ? dens[k] / max : 0;
    const [r, g, b] = hslRgb(230 * (1 - v), 0.72, 0.5);
    img.data.set([r, g, b, v < 0.03 ? 0 : (0.2 + 0.7 * v) * 255], k * 4);
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL();
  heatCache.set(key, url);
  return url;
}

export interface Dot { at: Point; color: string; kind: 'player' | 'mine' | 'pending'; names?: string }
const short = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The gradient: the slider (2 propositions) or the polygon (3+), with the answers' dots and, once revealed, the
 *  heatmap. `pick`: clickable (data-gradient). */
export function gradientSvg(choices: string[], o: { pick?: boolean; dots?: Dot[]; heat?: Point[] }): string {
  const n = choices.length, cs = corners(n);
  const dots = (o.dots ?? []).map(d => {
    const [x, y] = toSvg(n, d.at);
    return `<circle class="g-dot is-${d.kind}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${n === 2 ? 6 : 4.5}" style="--c:${d.color}"${d.names ? ` data-names="${esc(d.names)}"` : ''}/>`;
  }).join('');
  const label = (i: number, x: number, y: number, anchor: string) =>
    `<text class="g-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" data-label="${i}">${esc(short(choices[i] || `Proposition ${i + 1}`))}<title>${esc(choices[i])}</title></text>`;
  const attrs = `${o.pick ? ' data-gradient tabindex="0"' : ''} role="img" aria-label="Gradient entre ${esc(choices.join(', '))}"`;
  // the heatmap's clip, named by its shape: several gradients on a page (polls in the chat) each find theirs (an id
  // is page-wide: a shared « g-clip » clipped a triangle's heat by the slider of a poll above it)
  const clip = `g-clip-${n}`;
  if (n === 2) {
    const heat = o.heat ? `<image href="${heatmap(2, o.heat)}" x="${LINE.x0}" y="${LINE.y - 7}" width="${LINE.x1 - LINE.x0}" height="14" preserveAspectRatio="none" clip-path="url(#${clip})"/>` : '';
    return `<svg class="gradient g1 ${o.pick ? 'is-pick' : ''}" viewBox="0 0 300 50"${attrs}>
      <defs><clipPath id="${clip}"><rect x="${LINE.x0}" y="${LINE.y - 7}" width="${LINE.x1 - LINE.x0}" height="14" rx="7"/></clipPath></defs>
      <rect class="g-track" x="${LINE.x0}" y="${LINE.y - 7}" width="${LINE.x1 - LINE.x0}" height="14" rx="7"/>${heat}
      <line class="g-mid" x1="150" y1="${LINE.y - 10}" x2="150" y2="${LINE.y + 10}"/>
      ${label(0, LINE.x0, 46, 'start')}${label(1, LINE.x1, 46, 'end')}${dots}</svg>`;
  }
  const pts = cs.map(p => toSvg(n, p).map(v => v.toFixed(1)).join(',')).join(' ');
  const heat = o.heat ? `<image href="${heatmap(n, o.heat)}" x="${SHAPE.cx - SHAPE.r}" y="${SHAPE.cy - SHAPE.r}" width="${2 * SHAPE.r}" height="${2 * SHAPE.r}" preserveAspectRatio="none" clip-path="url(#${clip})"/>` : '';
  const spokes = cs.map(p => { const [x, y] = toSvg(n, p); return `<line class="g-spoke" x1="${SHAPE.cx}" y1="${SHAPE.cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const labels = cs.map((p, i) => {
    const [x, y] = toSvg(n, [p[0] * 1.16, p[1] * 1.16]);
    return label(i, x, y + 3 + (p[1] > 0.3 ? 5 : p[1] < -0.9 ? -2 : 0), p[0] > 0.2 ? 'start' : p[0] < -0.2 ? 'end' : 'middle');
  }).join('');
  return `<svg class="gradient g2 ${o.pick ? 'is-pick' : ''}" viewBox="0 0 300 190"${attrs}>
    <defs><clipPath id="${clip}"><polygon points="${pts}"/></clipPath></defs>
    <polygon class="g-shape" points="${pts}"/>${spokes}${heat}<polygon class="g-outline" points="${pts}"/>
    ${cs.map(p => { const [x, y] = toSvg(n, p); return `<circle class="g-corner" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"/>`; }).join('')}
    ${labels}${dots}</svg>`;
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

// ------------------------------------------------------------------ views
/** The host writes the poll in the game area. */
/** While writing « Choix définis »: the choice whose "+" menu is open, whose room stickers are shown, a note (a file
 *  that isn't an image…). */
export interface ComposeUi { menu?: number | null; stickers?: number | null; library?: Sticker[]; note?: string }

export function composeHtml(d: PollDraft, o: ComposeUi = {}): string {
  const kinds = (Object.keys(POLL_KINDS) as PollKind[]).map(k =>
    `<button class="seg ${d.kind === k ? 'on' : ''}" data-action="poll-kind" data-v="${k}" type="button">${POLL_KINDS[k].name}</button>`).join('');
  const what = d.kind === 'gradient' ? 'Propositions' : 'Choix';
  const withPics = d.kind === 'choices';
  const menu = (i: number) => `<div class="plus-menu choice-menu" role="menu">
      <button type="button" role="menuitem" data-action="choice-file" data-i="${i}">${icon.file}Image</button>
      <button type="button" role="menuitem" data-action="choice-gif" data-i="${i}">${icon.gif}GIF</button>
      <button type="button" role="menuitem" data-action="choice-sticker" data-i="${i}">${icon.sticker}Sticker</button>
      <button type="button" role="menuitem" data-action="choice-emoji" data-i="${i}">${icon.smile}Emoji</button></div>`;
  const stickers = (i: number) => {
    const lib = o.library ?? [];
    return `<li class="choice-stickers">${lib.length
      ? `<ul class="sticker-grid">${lib.map(s => `<li><button class="sticker-item" type="button" data-action="choice-sticker-pick" data-i="${i}" data-id="${s.id}" title="Mettre ce sticker"><img src="${esc(s.src)}" width="${s.w}" height="${s.h}" alt="Sticker"></button></li>`).join('')}</ul>`
      : '<p class="alert" role="alert">Aucun sticker dans ce salon pour l\'instant : ajoutes-en depuis le chat (+ → Fichier → Sticker).</p>'}
      <button class="btn ghost sm" type="button" data-action="choice-sticker-close">Fermer</button></li>`;
  };
  const row = (c: string, i: number) => {
    const pic = withPics ? picOf(d, i) : null;
    return `<li class="choice-row" ${withPics ? `data-choice-drop="${i}"` : ''}>
      ${pic ? `<span class="choice-thumb">${picHtml(pic, 'choice-img')}<button type="button" class="thumb-del" data-action="choice-pic-remove" data-i="${i}" title="Retirer l'image" aria-label="Retirer l'image">${icon.close}</button></span>`
    : withPics ? `<button type="button" class="choice-thumb empty" data-action="choice-plus" data-i="${i}" title="Ajouter une image (facultatif)" aria-label="Ajouter une image">${icon.file}</button>` : ''}
      <input data-poll="choice" data-i="${i}" value="${esc(c)}" maxlength="40" placeholder="${what === 'Choix' ? 'Choix' : 'Proposition'} ${i + 1}" autocomplete="off">
      ${withPics ? `<span class="plus-wrap choice-plus"><button class="icon-btn sm" type="button" data-action="choice-plus" data-i="${i}" title="Image, GIF, sticker ou emoji" aria-label="Image, GIF, sticker ou emoji" aria-haspopup="menu" aria-expanded="${o.menu === i}">${icon.plus}</button>${o.menu === i ? menu(i) : ''}</span>` : ''}
      ${d.choices.length > MIN_CHOICES ? `<button class="icon-btn sm" type="button" data-action="poll-remove" data-i="${i}" title="Retirer" aria-label="Retirer">${icon.close}</button>` : ''}
      <span class="drop-hint" aria-hidden="true">Dépose l'image</span></li>${o.stickers === i ? stickers(i) : ''}`;
  };
  const list = d.kind === 'free' ? '' : `<div class="field"><span>${what}</span><ol class="poll-inputs">${d.choices.map(row).join('')}</ol>
    ${d.choices.length < MAX_CHOICES ? `<button class="btn ghost sm" type="button" data-action="poll-add">+ Ajouter ${d.kind === 'gradient' ? 'une proposition' : 'un choix'}</button>` : ''}
    ${withPics ? '<p class="note">Une image par choix si tu veux (pas obligatoire) : + (image, GIF, sticker, emoji) ou glisse une image sur la ligne.</p>' : ''}
    ${o.note ? `<p class="alert" role="alert">${esc(o.note)}</p>` : ''}</div>`;
  const preview = d.kind === 'gradient' ? `<div class="poll-preview">${gradientSvg(d.choices, {})}
    <p class="note">${d.choices.length === 2 ? 'Curseur entre les deux propositions.' : `Forme à ${d.choices.length} coins (2D).`}</p></div>` : '';
  return `<div class="poll-compose">
    <label class="field"><span>Question</span><input data-poll="question" value="${esc(d.question)}" maxlength="120" placeholder="Ta question" autocomplete="off"></label>
    <div class="field"><span>Type de réponse</span><span class="seg-group">${kinds}</span><p class="note">${POLL_KINDS[d.kind].help}</p></div>
    ${list}${preview}</div>`;
}

/** What a respondent sees while the poll is open: their answer, editable until validated (`can`). */
export function answerHtml(poll: Poll, o: { mine?: PollAnswer; pick: PollAnswer | null; free: string; can: boolean; color: string; custom?: CustomEmoji[] }): string {
  const sel = o.mine ?? o.pick;
  if (poll.kind === 'choices') {
    return `<div class="poll-options">${poll.choices.map((c, i) => {
      const pic = picOf(poll, i);
      return `<button class="poll-option ${sel === i ? 'on' : ''} ${pic ? 'has-pic' : ''}" data-action="poll-choose" data-i="${i}" ${o.can ? '' : 'disabled'}>
        ${pic ? `<span class="option-pic">${picHtml(pic, 'choice-img')}</span>` : ''}<span class="option-text"><span class="radio"></span><span>${choiceLabel(c, i, o.custom ?? [])}</span></span></button>`;
    }).join('')}</div>`;
  }
  if (poll.kind === 'free') {
    if (o.can) return `<input class="poll-free" data-poll="free" value="${esc(o.free)}" maxlength="60" placeholder="Ta réponse" autocomplete="off">`;
    return o.mine !== undefined ? `<p class="poll-mine">Ta réponse : « ${esc(o.mine as string)} »</p>` : '<p class="hint">Chacun écrit sa réponse.</p>';
  }
  const dots: Dot[] = sel !== null && sel !== undefined ? [{ at: sel as Point, color: o.color, kind: o.mine !== undefined ? 'mine' : 'pending' }] : [];
  return gradientSvg(poll.choices, { pick: o.can, dots });
}

export interface Who { name: (id: string) => string; color: (id: string) => string }

/** Results, in the poll's format. Not secret: hovering a result shows who gave it (data-names). */
export function resultsHtml(poll: Poll, out: Outcome, who: Who, secret: boolean, custom: CustomEmoji[] = []): string {
  const total = Object.keys(poll.answers).length;
  const names = (ids: string[]) => (secret || !ids.length ? '' : ` data-names="${esc(ids.map(who.name).join(', '))}"`);
  const crown = (r: Ranked) => (r.key === out.winner ? `<span class="crown" title="Numéro 1">${icon.crown}</span>` : '');
  let body: string;
  if (poll.kind === 'choices') {
    const anyPic = poll.choices.some((_, i) => picOf(poll, i));
    body = `<ol class="poll-bars">${out.ranked.map(r => {
      const pct = total ? Math.round((100 * r.value) / total) : 0;
      const pic = picOf(poll, +r.key);
      const slot = pic ? `<span class="bar-pic">${picHtml(pic, 'choice-img')}</span>` : anyPic ? '<span class="bar-pic empty"></span>' : '';   // aligned
      return `<li class="bar-row ${r.key === out.winner ? 'win' : ''}"${names(r.ids)}><span class="bar-label">${slot}${crown(r)}${choiceLabel(r.label, +r.key, custom)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span><span class="bar-count">${pct} % · ${r.value}</span></li>`;
    }).join('')}</ol>`;
  } else if (poll.kind === 'free') {
    body = `<ul class="poll-cards">${out.ranked.map(r => `<li class="answer-card ${r.key === out.winner ? 'win' : ''}"${names(r.ids)}>${crown(r)}${esc(r.label)}
      ${r.value > 1 ? `<span class="mult" title="${r.value} joueurs">×${r.value}</span>` : ''}</li>`).join('')}</ul>`;
  } else {
    const entries = Object.entries(poll.answers) as [string, Point][];
    const dots: Dot[] = entries.map(([id, at]) => ({ at, color: secret ? 'var(--muted)' : who.color(id), kind: 'player', names: secret ? undefined : who.name(id) }));
    body = `<div class="poll-heat">${gradientSvg(poll.choices, { dots, heat: entries.map(([, p]) => p) })}</div>
      <ol class="poll-temps">${out.ranked.map(r => `<li class="temp ${r.key === out.winner ? 'win' : ''}">
        <span class="temp-badge" style="--t:${heatColor(out.ranked[0].value ? r.value / Math.max(...out.ranked.map(x => x.value)) : 0)}">${r.value}°</span>${crown(r)}<span>${esc(r.label)}</span></li>`).join('')}</ol>`;
  }
  const edge = out.hostEdge ? '<p class="host-edge">Avantage hôte</p>' : out.tie ? '<p class="host-edge">Égalité</p>' : '';
  return `<div class="poll-results"><p class="note">${total} réponse${total > 1 ? 's' : ''}</p>${body}</div>${edge}`;
}
