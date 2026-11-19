// The effects' layer (openspec: chat-activity, Effets visuels): fixed over the game area (.stage: the game, or the chat
// in the Chat activity), under the windows, following the area's place and size. What every effect shares: the dark
// background (counted: three fireworks keep it dark, no blinking), the particles' sky (one canvas, one loop), a spot on a
// player's photo (his place at the table when he is there, else the middle of the area, big).
import { hueColor } from '@slopesque/engines';
import { Sky } from './sky';

export interface Who { id: string; name: string; hue: number; photo: string | null }
/** Where a player's photo is on the page now (his place at a card table), or null. */
export type FindAvatar = (user: string) => HTMLElement | null;

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
/** An element of the layer: a class, some HTML (trusted: built here), absolutely placed. */
export function make(cls: string, html = '', parent?: HTMLElement) {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  parent?.append(el);
  return el;
}
const escAttr = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
/** A player's round: his photo, or his first letter on his colour. */
export const avatarHtml = (w: Who) => (w.photo ? `<img src="${escAttr(w.photo)}" alt="" draggable="false">` : escAttr(w.name.slice(0, 1).toUpperCase()));
export const colorOf = (hue: number) => hueColor(hue);

export class FxLayer {
  readonly el = make('fx-layer');
  private readonly shade = make('fx-dim', '', this.el);
  private dims = 0;
  private sky_: Sky | null = null;

  constructor(private readonly findAvatar: FindAvatar) {
    this.el.setAttribute('aria-hidden', 'true');
    document.body.append(this.el);
    addEventListener('resize', () => this.sync());
  }

  /** Over the game area, now (called at each effect's start and on every frame while one follows a place). */
  sync() {
    const stage = document.querySelector<HTMLElement>('.stage');
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    Object.assign(this.el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    this.sky_?.resize(r.width, r.height);
  }
  get width() { return this.el.clientWidth; }
  get height() { return this.el.clientHeight; }

  /** The dark background: on while at least one effect wants it. */
  dim(on: boolean) {
    this.dims = Math.max(0, this.dims + (on ? 1 : -1));
    this.shade.classList.toggle('on', this.dims > 0);
  }

  sky() {
    if (!this.sky_) { this.sky_ = new Sky(this.el); this.sync(); }
    return this.sky_;
  }

  /** A spot for an effect on a player's photo: on his place at the table (small, following it), or in the middle of
   *  the area (big). `done()` takes it away and shows his place again. */
  spot(w: Who) {
    this.sync();
    const real = this.findAvatar(w.id);
    const seat = !!real, size = seat ? real!.getBoundingClientRect().width : Math.round(Math.max(76, Math.min(150, Math.min(this.width, this.height) * 0.3)));
    const el = make(`fx-spot ${seat ? 'on-seat' : 'in-middle'}`, '', this.el);
    el.style.setProperty('--s', `${size}px`);
    const box = make('fx-box', '', el);         // what shakes (the effect and the photo), inside what follows
    const face = make('fx-face', '', box);
    const avatar = make('fx-avatar', avatarHtml(w), face);
    avatar.style.setProperty('--c', colorOf(w.hue));
    // his place is looked for again on every frame: the table may be drawn again meanwhile (a new element)
    let x = this.width / 2, y = this.height / 2, now: HTMLElement | null = real;
    const seatId = real?.closest('[data-seat]')?.getAttribute('data-seat');
    const hide = seatId ? document.createElement('style') : null;   // his place hidden, even drawn again: the copy takes the blows
    if (hide) { hide.textContent = `.cg-seat[data-seat="${CSS.escape(seatId!)}"] .avatar { visibility: hidden; }`; document.head.append(hide); }
    const place = () => {
      if (seat) {
        now = this.findAvatar(w.id) ?? (now?.isConnected ? now : null);
        if (now) {
          const r = now.getBoundingClientRect(), l = this.el.getBoundingClientRect();
          x = r.left - l.left + r.width / 2; y = r.top - l.top + r.height / 2;
        }
      }
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    place();
    let alive = true;
    const loop = () => { if (!alive) return; this.sync(); place(); requestAnimationFrame(loop); };   // the window moves: it follows
    requestAnimationFrame(loop);
    return {
      el, box, face, avatar, size, seat,
      done: () => {
        alive = false;
        el.remove();
        hide?.remove();
        const back = seat ? this.findAvatar(w.id) ?? now : null;
        if (back) {
          if (!reduced()) back.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.18)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
        }
      },
    };
  }
}
