// The semicircular disk: an outlined half disk, open at the bottom. A position is a value from 0 (left end) to
// 100 (right end): the angle of a ray from the centre, 0 → 180°. Clicking inside picks the ray under the pointer.
// See openspec/changes/define-game-concept/specs/semicircle-disk/spec.md.

export type RayKind = 'target' | 'player' | 'mine' | 'ghost';
export interface Ray {
  id: string;
  value: number;      // 0..100
  color: string;
  kind: RayKind;
  label?: string;
}

const NS = 'http://www.w3.org/2000/svg';
const W = 240, H = 130, R = 108;
export const CX = 120, CY = 120;   // viewBox 240 × 130 (shared with amphi.ts); centre at the middle of the base
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Point at `value` (0 left … 100 right) on a circle of radius `r`. */
export function point(value: number, r = R): [number, number] {
  const phi = Math.PI * (1 - value / 100);   // angle from the positive x axis
  return [CX + r * Math.cos(phi), CY - r * Math.sin(phi)];
}

/** Value under an SVG point, or null when it's outside the half disk (a little slack on the edges). */
export function valueAt(x: number, y: number): number | null {
  const dx = x - CX, dy = CY - y;
  if (dy < -6 || Math.hypot(dx, dy) > R + 6) return null;
  const phi = Math.atan2(Math.max(dy, 0), dx);   // 0 (right) … π (left)
  return Math.round(clamp((1 - phi / Math.PI) * 100, 0, 100) * 10) / 10;
}

export const f = (n: number) => n.toFixed(2);

/** Wedge (sector) between two values: the target ray, drawn as thick as its tolerance. */
function wedge(from: number, to: number, r = R) {
  const [x1, y1] = point(clamp(from, 0, 100), r), [x2, y2] = point(clamp(to, 0, 100), r);
  return `M${CX} ${CY} L${f(x1)} ${f(y1)} A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)} Z`;
}

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export interface DiskOptions {
  /** tolerance of the target ray, in value units (± around it): its drawn thickness and the "perfect" zone */
  tolerance: number;
  onPick?: (value: number) => void;
}

export class Disk {
  readonly svg: SVGSVGElement;
  private rays: SVGGElement;
  private ghost: SVGGElement;
  private interactive = false;
  private current: number | null = null;   // keyboard position

  constructor(host: HTMLElement, private opts: DiskOptions) {
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'disk board', role: 'slider', 'aria-valuemin': 0, 'aria-valuemax': 100,
      'aria-label': 'Position sur le demi-disque' }) as SVGSVGElement;
    const outline = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY} Z`;
    this.svg.append(el('path', { d: outline, class: 'disk-fill' }));
    // graduations: every 10, the middle one longer
    const ticks = el('g', { class: 'disk-ticks' });
    for (let v = 10; v < 100; v += 10) {
      const [x1, y1] = point(v, R - (v === 50 ? 10 : 5)), [x2, y2] = point(v, R);
      ticks.append(el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) }));
    }
    this.svg.append(ticks);
    this.rays = el('g', { class: 'disk-rays' });
    this.ghost = el('g', { class: 'disk-ghost' });
    this.svg.append(this.rays, this.ghost, el('path', { d: outline, class: 'disk-outline' }), el('circle', { cx: CX, cy: CY, r: 3.5, class: 'disk-hub' }));
    host.append(this.svg);
    this.wire();
  }

  private toSvg(e: PointerEvent): number | null {
    const m = this.svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return valueAt(p.x, p.y);
  }

  private wire() {
    this.svg.addEventListener('pointermove', e => {
      if (!this.interactive) return;
      const v = this.toSvg(e);
      this.svg.classList.toggle('is-over', v !== null);
      this.drawGhost(v);
    });
    this.svg.addEventListener('pointerleave', () => this.drawGhost(null));
    this.svg.addEventListener('click', e => {
      if (!this.interactive) return;
      const v = this.toSvg(e as PointerEvent);
      if (v !== null) this.pick(v);
    });
    // keyboard: ← → move by 1 (Shift: 5), Home / End, Enter confirms the position shown
    this.svg.addEventListener('keydown', e => {
      if (!this.interactive) return;
      const step = e.shiftKey ? 5 : 1;
      let v = this.current ?? 50;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= step;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += step;
      else if (e.key === 'Home') v = 0;
      else if (e.key === 'End') v = 100;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(v); return; }
      else return;
      e.preventDefault();
      this.current = clamp(v, 0, 100);
      this.drawGhost(this.current);
    });
  }

  private pick(v: number) {
    this.current = v;
    this.drawGhost(null);
    this.opts.onPick?.(v);
  }

  setInteractive(on: boolean) {
    this.interactive = on;
    this.svg.classList.toggle('is-interactive', on);
    if (on) this.svg.setAttribute('tabindex', '0'); else { this.svg.removeAttribute('tabindex'); this.drawGhost(null); }
  }

  private drawGhost(v: number | null) {
    this.ghost.replaceChildren();
    if (v === null) return;
    const [x, y] = point(v);
    this.ghost.append(el('line', { x1: CX, y1: CY, x2: f(x), y2: f(y) }));
  }

  /** Draws the rays: the target as a wedge (its tolerance), the players' as lines ending with a dot. */
  setRays(rays: Ray[]) {
    this.rays.replaceChildren();
    const mine = rays.find(r => r.kind === 'mine');
    if (mine) { this.current = mine.value; this.svg.setAttribute('aria-valuenow', String(mine.value)); }
    for (const ray of rays.filter(r => r.kind === 'target')) {
      const g = el('g', { class: 'ray ray-target', style: `--c:${ray.color}` });
      g.append(el('path', { d: wedge(ray.value - this.opts.tolerance, ray.value + this.opts.tolerance) }));
      const [x, y] = point(ray.value);
      g.append(el('line', { x1: CX, y1: CY, x2: f(x), y2: f(y) }));
      this.rays.append(g);
    }
    // mine last: on top of the others
    const order = (r: Ray) => (r.kind === 'mine' ? 1 : 0);
    for (const ray of rays.filter(r => r.kind !== 'target').sort((a, b) => order(a) - order(b))) {
      const [x, y] = point(ray.value), [lx, ly] = point(ray.value, R - 9);
      const g = el('g', { class: `ray ray-${ray.kind}`, style: `--c:${ray.color}` });
      g.append(el('line', { x1: CX, y1: CY, x2: f(lx), y2: f(ly) }), el('circle', { cx: f(x), cy: f(y), r: ray.kind === 'mine' ? 5 : 4 }));
      if (ray.label) { const t = el('title', {}); t.textContent = ray.label; g.append(t); }
      this.rays.append(g);
    }
  }
}
