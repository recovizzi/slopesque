// /effet confetti: two cannons, on the left and right sides of the area, throw confetti up and in; they turn over in
// the air, slow down, fall and fade. All the colours — or, aimed at a player, the shades of his colour.
import { pick, rand, wait, type FxLayer } from './layer';

const COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4dc9ff', '#c77dff', '#ff9f1c', '#f15bb5', '#ffffff'];
const shades = (hue: number) => Array.from({ length: 6 }, (_, i) => `hsl(${hue + rand(-8, 8)} ${80 + (i % 3) * 7}% ${42 + i * 6}%)`);

export async function confetti(layer: FxLayer, hue: number | null) {
  layer.sync();
  const sky = layer.sky(), w = layer.width, h = layer.height, colors = hue === null ? COLORS : [...shades(hue), '#ffffff'];
  const speed = Math.max(520, Math.hypot(w, h) * 0.95);
  const salvo = (side: -1 | 1, n: number) => {
    const x0 = side < 0 ? -6 : w + 6, y0 = h * rand(0.62, 0.78);
    for (let i = 0; i < n; i++) {
      const v = speed * rand(0.45, 1), angle = -Math.PI / 2 - side * rand(0.35, 1.05);   // up, and in
      sky.add({
        x: x0, y: y0 + rand(-14, 14), vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: rand(2.6, 3.4), size: 0, color: pick(colors), drag: 1.25, g: speed * 0.62,
        flat: { w: rand(6, 11), h: rand(4, 7), rot: rand(0, 6.3), vr: rand(-9, 9), flip: rand(0, 6.3), vflip: rand(6, 14), shape: pick(['rect', 'rect', 'rect', 'circle', 'ribbon'] as const) },
      });
    }
  };
  for (let k = 0; k < 3; k++) {   // three salvos from each side
    salvo(-1, 55); salvo(1, 55);
    await wait(170);
  }
}
