// The particles of the effects: one engine for all of them (fireworks, confetti…), two canvases in the layer — light
// that leaves trails (added colours, fading a little each frame) and flat things (confetti) — and one animation loop,
// stopped as soon as nothing moves. Positions in CSS pixels of the layer; times in seconds.

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  age?: number; life: number;
  size: number; color: string;
  drag?: number;                       // per second (the speed × e^(−drag·dt))
  g?: number;                          // gravity, px/s²
  flicker?: boolean;                   // a crackling spark
  flat?: { w: number; h: number; rot: number; vr: number; flip: number; vflip: number; shape: 'rect' | 'circle' | 'ribbon' };
  /** A particle that drives itself (a rocket): false when it is over. */
  tick?: (p: Particle, dt: number, sky: Sky) => boolean;
  /** At the end of its life (a crackle). */
  die?: (p: Particle, sky: Sky) => void;
}

export class Sky {
  private readonly light = document.createElement('canvas');
  private readonly flat = document.createElement('canvas');
  private readonly lc = this.light.getContext('2d')!;
  private readonly fc = this.flat.getContext('2d')!;
  private parts: Particle[] = [];
  private running = false;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = Math.min(2, devicePixelRatio || 1);

  constructor(host: HTMLElement) {
    for (const c of [this.light, this.flat]) { c.className = 'fx-sky'; host.append(c); }
  }

  get width() { return this.w; }
  get height() { return this.h; }

  resize(w: number, h: number) {
    if (Math.round(w) === this.w && Math.round(h) === this.h) return;
    this.w = Math.round(w); this.h = Math.round(h);
    for (const c of [this.light, this.flat]) { c.width = this.w * this.dpr; c.height = this.h * this.dpr; }
    for (const x of [this.lc, this.fc]) x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  add(p: Particle) {
    p.age = 0;
    this.parts.push(p);
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(t => this.frame(t)); }
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { lc, fc } = this;
    // the light fades a little (its trails), the flat things are drawn again
    lc.globalCompositeOperation = 'destination-out';
    lc.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.8, dt * 60)})`;
    lc.fillRect(0, 0, this.w, this.h);
    lc.globalCompositeOperation = 'lighter';
    fc.clearRect(0, 0, this.w, this.h);
    const alive: Particle[] = [], list = this.parts;
    this.parts = [];   // what is added during this frame (a burst) waits for the next one
    for (const p of list) {
      p.age! += dt;
      if (p.tick) { if (p.tick(p, dt, this)) alive.push(p); continue; }
      if (p.age! >= p.life) { p.die?.(p, this); continue; }
      const k = Math.exp(-(p.drag ?? 0) * dt);
      p.vx *= k; p.vy = p.vy * k + (p.g ?? 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const left = 1 - p.age! / p.life;
      if (p.flat) this.drawFlat(p, dt, left);
      else this.drawLight(p, left);
      alive.push(p);
    }
    this.parts = alive.concat(this.parts);
    if (this.parts.length) requestAnimationFrame(t => this.frame(t));
    else { this.running = false; setTimeout(() => { if (!this.running) { lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, this.w, this.h); } }, 400); }
  }

  /** A point of light drawn now (a rocket's head). */
  glow(x: number, y: number, size: number, color: string) { this.drawLight({ x, y, vx: 0, vy: 0, life: 1, size, color }, 1); }

  private drawLight(p: Particle, left: number) {
    const a = Math.min(1, left * 1.6) * (p.flicker ? 0.35 + Math.random() * 0.65 : 1);
    const { lc } = this;
    lc.globalAlpha = a * 0.28;
    lc.fillStyle = p.color;
    lc.beginPath(); lc.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2); lc.fill();   // its glow
    lc.globalAlpha = a;
    lc.beginPath(); lc.arc(p.x, p.y, p.size, 0, Math.PI * 2); lc.fill();
    lc.globalAlpha = 1;
  }

  private drawFlat(p: Particle, dt: number, left: number) {
    const f = p.flat!, { fc } = this;
    f.rot += f.vr * dt; f.flip += f.vflip * dt;
    fc.save();
    fc.globalAlpha = Math.min(1, left * 5);   // fades in its last fifth
    fc.translate(p.x, p.y);
    fc.rotate(f.rot);
    fc.scale(1, Math.cos(f.flip));            // turning over in the air
    fc.fillStyle = fc.strokeStyle = p.color;
    if (f.shape === 'circle') { fc.beginPath(); fc.arc(0, 0, f.w / 2, 0, Math.PI * 2); fc.fill(); }
    else if (f.shape === 'ribbon') { fc.lineWidth = f.h / 2; fc.lineCap = 'round'; fc.beginPath(); fc.moveTo(-f.w, 0); fc.quadraticCurveTo(0, -f.w * 0.9, f.w, 0); fc.stroke(); }
    else fc.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    fc.restore();
  }
}
