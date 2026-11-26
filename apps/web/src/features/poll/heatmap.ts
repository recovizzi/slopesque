// The heatmap as a picture for the gradient's <image>: its pixels (model.ts heatPixels) drawn on a canvas, as a PNG
// data URL, kept per set of answers (a results view drawn again doesn't compute it again).
import { heatPixels, type Point } from './model';

const cache = new Map<string, string>();

export function heatmapUrl(n: number, pts: Point[]): string {
  const key = `${n}|${JSON.stringify(pts)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { w, h, data } = heatPixels(n, pts);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
