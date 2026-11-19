// The effects on a player's photo: hit (a fist knocks it out), tomato (thrown in an arc, it bursts and leaves a stain
// that runs), hammer (it falls on the photo and flattens it, which springs back). Big in the middle of the area, or small
// on the player's place at a card table, following it. Everything in proportion to the photo's size (S).
import { make, rand, wait, type FxLayer, type Who } from './layer';

type Spot = ReturnType<FxLayer['spot']>;
const play = (el: Element, frames: Keyframe[], o: KeyframeAnimationOptions) => el.animate(frames, { fill: 'forwards', ...o }).finished.catch(() => undefined);
const glyph = (box: HTMLElement, text: string, size: number, cls = '') => { const g = make(`fx-glyph ${cls}`, text, box); g.style.fontSize = `${size}px`; return g; };

/** In the middle: the photo arrives (in a card game's place it is already there). */
async function arrive(s: Spot) {
  if (s.seat) return;
  await play(s.face, [{ transform: 'scale(0) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1.12) rotate(3deg)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
}
/** The box shakes: an impact. */
const shake = (s: Spot, amp: number, ms = 260) => play(s.box, Array.from({ length: 7 }, (_, i) => ({ transform: i === 6 ? 'none' : `translate(${rand(-amp, amp)}px, ${rand(-amp, amp)}px)` })), { duration: ms, easing: 'linear', fill: 'none' });
/** Comic spikes where it hits. */
function spikes(s: Spot, x: number, y: number, size: number, color = '#ffd166') {
  const pts = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 0.42 : 1; return `${50 + Math.cos(a) * 50 * r},${50 + Math.sin(a) * 50 * r}`; }).join(' ');
  const el = make('fx-spikes', `<svg viewBox="0 0 100 100"><polygon points="${pts}" fill="${color}" stroke="#ff7b00" stroke-width="3" stroke-linejoin="round"/></svg>`, s.box);
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, left: `calc(50% + ${x - size / 2}px)`, top: `calc(50% + ${y - size / 2}px)` });
  void play(el, [{ transform: 'scale(.2) rotate(0deg)', opacity: 1 }, { transform: 'scale(1.15) rotate(25deg)', opacity: 1, offset: 0.4 }, { transform: 'scale(1.3) rotate(35deg)', opacity: 0 }], { duration: 420, easing: 'ease-out' }).then(() => el.remove());
}
/** Little things thrown out of a point (stars, drops, dust). */
function debris(s: Spot, x: number, y: number, n: number, html: string | ((i: number) => string), dist: number, ms: number, opts: { up?: number; grow?: number; spread?: [number, number] } = {}) {
  const [a0, a1] = opts.spread ?? [0, Math.PI * 2];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + Math.random() * 0.8)) / n, d = dist * rand(0.6, 1.1);
    const el = make('fx-bit', typeof html === 'string' ? html : html(i), s.box);
    Object.assign(el.style, { left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` });
    void play(el, [{ transform: 'translate(-50%, -50%) scale(.6)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + (opts.up ?? 0)}px)) scale(${opts.grow ?? 1})`, opacity: 0 }],
    { duration: ms * rand(0.8, 1.15), easing: 'cubic-bezier(.15,.7,.35,1)' }).then(() => el.remove());
  }
}

export async function hit(layer: FxLayer, w: Who) {
  const s = layer.spot(w), S = s.size, P = s.seat ? Math.max(S * 2.2, 40) : S;   // the props: at a table, big enough to be seen
  await arrive(s);
  const room = Math.min(P * 1.9, layer.width / 2 - P * 0.45);   // it starts inside the area
  const fist = glyph(s.box, '🤜', P * 0.82, 'fist'), from = -room;
  await play(fist, [
    { transform: `translate(${from}px, ${P * 0.08}px) rotate(-18deg) scale(.6)`, opacity: 0 },
    { transform: `translate(${from + P * 0.3}px, ${P * 0.04}px) rotate(-6deg) scale(1)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${from - P * 0.05}px, 0) rotate(-16deg) scale(.95)`, opacity: 1, offset: 0.62 },   // it winds up
    { transform: `translate(${-P * 0.66}px, 0) rotate(4deg) scale(1.12)`, opacity: 1 },                       // and strikes
  ], { duration: 560, easing: 'cubic-bezier(.55,0,.85,.35)' });
  spikes(s, -P * 0.42, 0, P * 0.9);
  debris(s, -P * 0.3, 0, 4, '<span class="fx-star">✦</span>', P * 0.9, 520, { spread: [-2.4, 2.4] });
  void shake(s, P * 0.06);
  void play(fist, [{ transform: `translate(${-P * 0.66}px, 0) rotate(4deg) scale(1.12)`, opacity: 1 }, { transform: `translate(${-P * 0.45}px, 0) rotate(8deg) scale(1.05)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${-P * 0.75}px, ${P * 0.1}px) rotate(-6deg) scale(.9)`, opacity: 0 }], { duration: 420, easing: 'ease-out' });
  await play(s.face, [   // knocked out
    { transform: 'none', opacity: 1 },
    { transform: `translate(${S * 0.14}px, 0) rotate(12deg) scale(.88, 1.08)`, opacity: 1, offset: 0.12 },
    { transform: `translate(${P * 1.7}px, ${-P * 0.75}px) rotate(420deg) scale(.3)`, opacity: 0 },
  ], { duration: 680, easing: 'cubic-bezier(.3,0,.75,.55)' });
  await wait(260);
  s.done();
}

/** A tomato's stain: an uneven blob, its lighter heart, seeds and drops around (seeded at random each time). */
function stainSvg(id: string) {
  const n = 12, pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = (i % 2 ? rand(30, 37) : rand(38, 47)); return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]; });
  const d = pts.map((p, i) => { const q = pts[(i + 1) % n]!, m = [(p[0]! + q[0]!) / 2, (p[1]! + q[1]!) / 2]; return `${i ? '' : `M${(pts[n - 1]![0]! + p[0]!) / 2},${(pts[n - 1]![1]! + p[1]!) / 2}`} Q${p[0]},${p[1]} ${m[0]},${m[1]}`; }).join(' ');
  const drops = Array.from({ length: 9 }, () => { const a = rand(0, Math.PI * 2), r = rand(46, 58); return `<circle cx="${50 + Math.cos(a) * r}" cy="${50 + Math.sin(a) * r}" r="${rand(1.6, 4.2)}" fill="#d62828"/>`; }).join('');
  const seeds = Array.from({ length: 7 }, () => `<ellipse cx="${rand(36, 64)}" cy="${rand(36, 64)}" rx="2.2" ry="1.3" transform="rotate(${rand(0, 180)})" fill="#ffe8a3" opacity=".85"/>`).join('');
  return `<svg viewBox="-10 -10 120 120"><defs><radialGradient id="${id}" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ff6b5b"/><stop offset=".55" stop-color="#e63322"/><stop offset="1" stop-color="#a4161a"/></radialGradient></defs>
    ${drops}<path d="${d} Z" fill="url(#${id})"/><ellipse cx="42" cy="38" rx="11" ry="6" fill="#ff9e8f" opacity=".55"/>${seeds}</svg>`;
}

export async function tomato(layer: FxLayer, w: Who) {
  const s = layer.spot(w), S = s.size, P = s.seat ? Math.max(S * 2.2, 40) : S;   // the props: at a table, big enough to be seen
  await arrive(s);
  const t = glyph(s.box, '🍅', P * 0.7, 'tomato');
  const p0 = [P * 2.1, P * 1.6], c = [P * 1.25, -P * 1.5], p1 = [0, -P * 0.04];
  const at = (u: number) => [(1 - u) ** 2 * p0[0]! + 2 * (1 - u) * u * c[0]! + u * u * p1[0]!, (1 - u) ** 2 * p0[1]! + 2 * (1 - u) * u * c[1]! + u * u * p1[1]!];
  await play(t, Array.from({ length: 13 }, (_, i) => { const u = i / 12, [x, y] = at(u); return { transform: `translate(${x}px, ${y}px) rotate(${u * 620}deg) scale(${0.55 + u * 0.5})`, opacity: i ? 1 : 0 }; }),
    { duration: 640, easing: 'cubic-bezier(.35,.1,.65,.95)' });
  void play(t, [{ transform: `translate(0, ${-P * 0.04}px) scale(1.05)` }, { transform: `translate(0, 0) scale(1.7, .35)`, opacity: 0 }], { duration: 120, easing: 'ease-out' });
  const stain = make('fx-stain', stainSvg(`tg${Math.random().toString(36).slice(2, 8)}`), s.box);
  stain.style.setProperty('--r', `${rand(-40, 40)}deg`);
  const D = s.seat ? P * 0.62 : S;   // the stain's size (a table's photo is small: the stain overflows it a little)
  Object.assign(stain.style, { width: `${D * 1.15}px`, height: `${D * 1.15}px` });
  void play(stain, [{ transform: 'translate(-50%, -50%) rotate(var(--r)) scale(.15)' }, { transform: 'translate(-50%, -50%) rotate(var(--r)) scale(1.14)', offset: 0.6 }, { transform: 'translate(-50%, -50%) rotate(var(--r)) scale(1)' }],
    { duration: 230, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
  debris(s, 0, 0, 12, () => `<span class="fx-drop" style="--d:${rand(0.05, 0.11) * S}px"></span>`, P * 1.05, 560, { up: P * 0.25 });
  void shake(s, P * 0.035, 200);
  void play(s.face, [{ transform: 'scale(1)' }, { transform: 'scale(1.06, .9)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out', fill: 'none' });
  for (const [x, len, delay] of [[-0.18, 0.42, 120], [0.12, 0.6, 0], [0.3, 0.32, 260]] as const) {   // it runs
    const drip = make('fx-drip', '', s.box);
    Object.assign(drip.style, { left: `calc(50% + ${x * D}px)`, top: `calc(50% + ${D * 0.22}px)`, width: `${Math.max(2, D * 0.075)}px`, height: `${D * len}px` });
    void play(drip, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1300, delay, easing: 'cubic-bezier(.5,0,.8,.6)' });
  }
  await wait(1500);
  await play(s.box, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-in' });
  s.done();
}

const HAMMER = `<svg viewBox="0 0 100 140"><defs>
  <linearGradient id="fxw" x1="0" x2="1"><stop offset="0" stop-color="#c47a3a"/><stop offset=".5" stop-color="#e09a55"/><stop offset="1" stop-color="#8b4b1f"/></linearGradient>
  <linearGradient id="fxs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3f6"/><stop offset=".45" stop-color="#aebcc4"/><stop offset="1" stop-color="#5f7480"/></linearGradient></defs>
  <rect x="43" y="38" width="14" height="100" rx="6" fill="url(#fxw)" stroke="#5e3112" stroke-width="2"/>
  <rect x="41" y="112" width="18" height="26" rx="6" fill="#3a3a44"/>
  <rect x="8" y="6" width="84" height="38" rx="8" fill="url(#fxs)" stroke="#40525c" stroke-width="3"/>
  <rect x="8" y="6" width="14" height="38" rx="6" fill="#7d909a" opacity=".6"/><rect x="40" y="6" width="20" height="38" fill="#40525c" opacity=".25"/></svg>`;

export async function hammer(layer: FxLayer, w: Who) {
  const s = layer.spot(w), S = s.size, P = s.seat ? Math.max(S * 2.2, 40) : S;   // the props: at a table, big enough to be seen
  await arrive(s);
  // the handle's end (its pivot) stands right of the photo; at its strike the head falls on the photo's top
  const px = P * 0.95, py = P * 0.25, L = Math.hypot(px, py + S * 0.5) / 0.814, W = (L * 100) / 140;   // the head's centre is 81 % up the handle
  const h = make('fx-hammer', HAMMER, s.box);
  Object.assign(h.style, { width: `${W}px`, height: `${L}px`, left: `calc(50% + ${px - W / 2}px)`, top: `calc(50% + ${py - L}px)` });
  const hit = `rotate(${Math.atan2(-px, py + S * 0.5) * (180 / Math.PI)}deg)`;
  await play(h, [{ transform: `translateY(${-P * 0.4}px) rotate(8deg)`, opacity: 0 }, { transform: 'rotate(4deg)', opacity: 1, offset: 0.35 }, { transform: 'rotate(20deg)', opacity: 1 }],
    { duration: 520, easing: 'cubic-bezier(.25,.7,.35,1)' });                                    // it rises, winds up
  await play(h, [{ transform: 'rotate(20deg)' }, { transform: hit }], { duration: 140, easing: 'cubic-bezier(.7,0,1,.6)' });   // and falls
  void play(s.face, [{ transform: 'none' }, { transform: 'scale(1.42, .26)' }], { duration: 90, easing: 'ease-out' });       // flattened
  void shake(s, P * 0.07, 280);
  spikes(s, 0, -P * 0.12, P * 0.75, '#fff3c4');
  for (const side of [-1, 1]) debris(s, side * P * 0.55, P * 0.42, 4, '<span class="fx-dust"></span>', P * 0.5, 600, { spread: side < 0 ? [2.6, 3.9] : [-0.75, 0.55], grow: 1.8, up: -P * 0.1 });
  void play(h, [{ transform: hit, opacity: 1 }, { transform: `${hit} rotate(14deg)`, opacity: 1, offset: 0.45 }, { transform: `${hit} rotate(10deg) translateY(${-P * 0.2}px)`, opacity: 0 }],
    { duration: 520, easing: 'ease-out' });
  const dizzy = glyph(s.box, '💫', P * 0.4, 'dizzy');
  void play(dizzy, [{ transform: `translate(0, ${-P * 0.05}px) rotate(0) scale(.4)`, opacity: 0 }, { transform: `translate(0, ${-P * 0.3}px) rotate(200deg) scale(1)`, opacity: 1, offset: 0.3 },
    { transform: `translate(0, ${-P * 0.32}px) rotate(560deg) scale(1)`, opacity: 1, offset: 0.8 }, { transform: `translate(0, ${-P * 0.4}px) rotate(700deg) scale(.6)`, opacity: 0 }], { duration: 1100, delay: 120 });
  await play(s.face, [{ transform: 'scale(1.42, .26)' }, { transform: 'scale(1.38, .3)', offset: 0.25 }, { transform: 'scale(1.42, .26)', offset: 0.5 }, { transform: 'scale(1.42, .26)' }], { duration: 800 });
  await play(s.face, [{ transform: 'scale(1.42, .26)' }, { transform: 'scale(.82, 1.24)', offset: 0.35 }, { transform: 'scale(1.08, .93)', offset: 0.62 }, { transform: 'scale(.98, 1.02)', offset: 0.82 }, { transform: 'scale(1)' }],
    { duration: 560, easing: 'ease-out' });   // it springs back
  await wait(250);
  if (!s.seat) await play(s.box, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
  s.done();
}
