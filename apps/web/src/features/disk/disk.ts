// Provisional: what the Roulette's string view (features/wheel/wheel.ts) still takes from the old imperative disk —
// an SVG element maker and the coordinates' format. Deleted when the Roulette is a component (task 3.1); the disk
// itself is model.ts, DiskBoard.tsx and AmphiBoard.tsx.
export { f } from './model';

const NS = 'http://www.w3.org/2000/svg';
export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}
