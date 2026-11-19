// /effet screamer: a picture (an image sent once, a sticker, a GIF, an emoji) jumps to the front, in the middle of
// everyone's area, for one second — a punch in, a shake, a cut.
import { make, wait, type FxLayer } from './layer';

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const loaded = (img: HTMLImageElement) => new Promise<void>(r => { if (img.complete) r(); else { img.onload = img.onerror = () => r(); setTimeout(r, 1500); } });

export async function screamer(layer: FxLayer, pic: { kind: 'image' | 'emoji'; src: string }) {
  layer.sync();
  const el = make('fx-screamer', '', layer.el), flash = make('fx-flash', '', el);
  const body = pic.kind === 'emoji' ? make('fx-scream emoji', esc(pic.src), el) : make('fx-scream', `<img src="${esc(pic.src)}" alt="" draggable="false">`, el);
  const img = body.querySelector('img');
  if (img) await loaded(img);   // the second starts when it is there
  const jitter = Array.from({ length: 10 }, (_, i) => ({ transform: `translate(${(i % 2 ? 1 : -1) * (6 - i * 0.5)}px, ${(i % 3 - 1) * 4}px) scale(${1 + 0.02 * (i % 2)})`, offset: 0.16 + i * 0.07 }));
  void flash.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.08 }, { opacity: 0.45, offset: 0.85 }, { opacity: 0 }], { duration: 1150, fill: 'forwards' });
  await body.animate([{ transform: 'scale(.15) rotate(-10deg)', opacity: 0 }, { transform: 'scale(1.14) rotate(3deg)', opacity: 1, offset: 0.1 }, ...jitter,
    { transform: 'scale(1)', opacity: 1, offset: 0.88 }, { transform: 'scale(1.2)', opacity: 0 }], { duration: 1150, easing: 'linear', fill: 'forwards' }).finished.catch(() => undefined);
  el.remove();
}

/** « Animations réduites »: the effect's emoji, still, a moment. */
export async function still(layer: FxLayer, text: string) {
  layer.sync();
  const el = make('fx-still', esc(text), layer.el);
  await el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1400, fill: 'forwards' }).finished.catch(() => undefined);
  await wait(0);
  el.remove();
}
