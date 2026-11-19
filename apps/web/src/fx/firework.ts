// /effet firework: the area goes dark, a rocket leaves each bottom corner with its trail of light towards the middle,
// and bursts; each burst draws its shape and its colours at random (a peony, a ring, two rings, a willow, a heart, a
// palm, a star, a crackle), so no two fireworks are alike.
import { pick, rand, wait, type FxLayer } from './layer';
import type { Particle, Sky } from './sky';

const PALETTES = [
  ['#ffd166', '#fff3c4'],                          // gold
  ['#ff4d6d', '#ffd166'],                          // fire
  ['#7ad7ff', '#ffffff'],                          // ice
  ['#c77dff', '#ff70a6'],                          // violet
  ['#38f28b', '#d4ff70'],                          // emerald
  ['#ff7b54', '#ffb26b', '#ffe66d'],               // sunset
  ['#ff4d4d', '#ffffff', '#4d7dff'],               // three colours
  ['#ff4d6d', '#ffd166', '#38f28b', '#4dc9ff', '#c77dff'],   // rainbow
  ['#9bf6ff', '#a0c4ff', '#bdb2ff'],               // pastel
];
type Burst = (sky: Sky, x: number, y: number, colors: string[], r: number) => void;
const spark = (x: number, y: number, vx: number, vy: number, color: string, more: Partial<Particle> = {}): Particle =>
  ({ x, y, vx, vy, life: rand(1.2, 1.8), size: rand(1.6, 2.4), color, drag: 1.6, g: 70, ...more });

// r: the burst's radius for this area (px/s at the start)
const BURSTS: Record<string, Burst> = {
  peony: (s, x, y, c, r) => { for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, v = r * rand(0.45, 1); s.add(spark(x, y, Math.cos(a) * v, Math.sin(a) * v, pick(c))); } },
  ring: (s, x, y, c, r) => {
    const tilt = rand(0.45, 1), turn = Math.random() * Math.PI;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a) * tilt;
      s.add(spark(x, y, (ux * Math.cos(turn) - uy * Math.sin(turn)) * r, (ux * Math.sin(turn) + uy * Math.cos(turn)) * r, c[0]!, { drag: 1.9 }));
    }
  },
  double: (s, x, y, c, r) => {
    for (const [k, color] of [[1, c[0]!], [0.55, c[1] ?? '#ffffff']] as const) {
      for (let i = 0; i < 52; i++) { const a = (i / 52) * Math.PI * 2 + k; s.add(spark(x, y, Math.cos(a) * r * k, Math.sin(a) * r * k, color, { drag: 1.9 })); }
    }
  },
  willow: (s, x, y, _c, r) => {
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, v = r * rand(0.35, 0.7);
      s.add(spark(x, y, Math.cos(a) * v, Math.sin(a) * v, pick(['#ffd166', '#ffb703', '#fff3c4']), { life: rand(2.2, 2.9), drag: 2.4, g: 120, size: rand(1.3, 1.9) }));
    }
  },
  heart: (s, x, y, c, r) => {
    for (let i = 0; i < 80; i++) {
      const t = (i / 80) * Math.PI * 2, hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      s.add(spark(x, y, (hx / 17) * r, (hy / 17) * r, c[i % c.length]!, { drag: 2, g: 40 }));
    }
  },
  palm: (s, x, y, c, r) => {
    const arms = 7, turn = Math.random();
    for (let i = 0; i < arms; i++) for (let k = 0; k < 7; k++) {
      const a = turn + (i / arms) * Math.PI * 2 + rand(-0.04, 0.04), v = r * (0.5 + k * 0.08);
      s.add(spark(x, y, Math.cos(a) * v, Math.sin(a) * v, c[0]!, { size: 2.6 - k * 0.15, g: 110, life: rand(1.5, 2) }));
    }
  },
  star: (s, x, y, c, r) => {
    const pts = 5, turn = -Math.PI / 2;
    for (let i = 0; i < 90; i++) {
      const t = i / 90, seg = Math.floor(t * pts * 2), f = t * pts * 2 - seg;
      const a1 = turn + (seg / (pts * 2)) * Math.PI * 2, a2 = turn + ((seg + 1) / (pts * 2)) * Math.PI * 2;
      const r1 = seg % 2 ? 0.45 : 1, r2 = seg % 2 ? 1 : 0.45;
      const vx = (Math.cos(a1) * r1 * (1 - f) + Math.cos(a2) * r2 * f) * r, vy = (Math.sin(a1) * r1 * (1 - f) + Math.sin(a2) * r2 * f) * r;
      s.add(spark(x, y, vx, vy, c[i % c.length]!, { drag: 2, g: 45 }));
    }
  },
  crackle: (s, x, y, c, r) => {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, v = r * rand(0.4, 0.9);
      s.add(spark(x, y, Math.cos(a) * v, Math.sin(a) * v, pick(c), {
        flicker: true, life: rand(0.9, 1.3),
        die: (p, sky) => { for (let k = 0; k < 3; k++) { const b = Math.random() * Math.PI * 2; sky.add(spark(p.x, p.y, Math.cos(b) * 40, Math.sin(b) * 40, '#fff6d5', { life: rand(0.25, 0.45), size: 1.2, flicker: true, g: 20 })); } },
      }));
    }
  },
};

/** A rocket from (x0, y0) to its burst at (x1, y1): its trail of light on the way. */
function rocket(sky: Sky, x0: number, y0: number, x1: number, y1: number, r: number) {
  const T = rand(0.85, 1.05), wob = rand(0, Math.PI * 2);
  let t = 0;
  sky.add({
    x: x0, y: y0, vx: 0, vy: 0, life: T + 1, size: 2, color: '#fff',
    tick: (p, dt, s) => {
      t = Math.min(1, t + dt / T);
      const e = 1 - (1 - t) ** 3;   // slows down near the top
      const px = p.x, py = p.y;
      p.x = x0 + (x1 - x0) * e + Math.sin(t * 9 + wob) * 2;
      p.y = y0 + (y1 - y0) * e;
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - px, p.y - py) / 3));   // a continuous trail, whatever the frame rate
      for (let k = 0; k < steps; k++) {
        const f = (k + 1) / steps;
        s.add({ x: px + (p.x - px) * f + rand(-0.8, 0.8), y: py + (p.y - py) * f, vx: rand(-8, 8), vy: rand(8, 30), life: rand(0.3, 0.6), size: rand(0.9, 1.5), color: pick(['#fff3c4', '#ffd166', '#ffb347']), drag: 3, g: 30 });
      }
      s.glow(p.x, p.y, 2.6, '#fffbe8');   // its head
      if (t < 1) return true;
      s.add({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.16, size: Math.min(14, r / 18), color: '#ffe9b0' });   // a short flash
      BURSTS[pick(Object.keys(BURSTS))]!(s, p.x, p.y, pick(PALETTES), r);
      return false;
    },
  });
}

export async function firework(layer: FxLayer) {
  layer.sync();
  layer.dim(true);
  const sky = layer.sky(), w = layer.width, h = layer.height, r = Math.max(110, Math.min(w, h) * 0.42);
  await wait(380);
  rocket(sky, w * 0.02, h, rand(0.32, 0.48) * w, rand(0.22, 0.4) * h, r);
  await wait(rand(180, 320));
  rocket(sky, w * 0.98, h, rand(0.52, 0.68) * w, rand(0.22, 0.4) * h, r);
  await wait(3200);
  layer.dim(false);
}
