// Player colours: one hue each (0..359) at a fixed, matte saturation / lightness, readable on both themes.
// The default hues are spread around the wheel; players can then pick any hue on the rainbow slider.
export const DEFAULT_HUES = [222, 4, 145, 26, 275, 176, 322, 48];
export const MIN_HUE_GAP = 12;   // two players closer than this would look alike

export const hueColor = (h: number) => `hsl(${Math.round(h)} 58% 50%)`;

export function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** The first default hue far enough from the taken ones, else the hue farthest from all of them. */
export function defaultHue(taken: number[]): number {
  const free = (h: number) => taken.every(t => hueDistance(h, t) >= MIN_HUE_GAP);
  const preset = DEFAULT_HUES.find(free);
  if (preset !== undefined) return preset;
  let best = 0, bestGap = -1;
  for (let h = 0; h < 360; h++) {
    const gap = Math.min(...taken.map(t => hueDistance(h, t)));
    if (gap > bestGap) { best = h; bestGap = gap; }
  }
  return best;
}

/** CSS gradient of the whole rainbow at the players' saturation / lightness (the slider's track). */
export const RAINBOW = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => hueColor(i * 30)).join(', ')})`;
