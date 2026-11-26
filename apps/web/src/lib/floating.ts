// Where something that floats goes, from rectangles only (no DOM: tested in floating.test.ts). A window (emoji, GIF)
// next to its button: above it when there is room, else below, else as high as it fits; its right edge on the
// button's, inside the view. A bubble (a hover tip, a quoted message): above what is hovered, or below it near the top.

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}
export interface Size {
  width: number;
  height: number;
}

const MARGIN = 8; // from the edges of the view
const GAP = 6; // between the window and its button

/** A window of at most `maxW` × `maxH` next to `anchor`, inside `view`. */
export function floatingBox(anchor: Omit<Rect, 'width' | 'left'>, view: Size, maxW = 352, maxH = 380) {
  const width = Math.min(maxW, view.width - 2 * MARGIN),
    height = Math.min(maxH, view.height - 2 * MARGIN);
  const top =
    anchor.top - height - GAP >= MARGIN
      ? anchor.top - height - GAP
      : anchor.bottom + GAP + height <= view.height - MARGIN
        ? anchor.bottom + GAP
        : Math.max(MARGIN, view.height - height - MARGIN);
  const left = Math.max(MARGIN, Math.min(view.width - width - MARGIN, anchor.right - width));
  return { top, left, width, height };
}

/** A bubble of `size` above `target` (below it when there is no room above), its left on the target's (or centred
 *  on it), 4 px at least from the sides of the view. */
export function bubbleAt(target: Rect, size: Size, viewWidth: number, centre: boolean) {
  const left = Math.max(
    4,
    Math.min(viewWidth - size.width - 4, centre ? target.left + target.width / 2 - size.width / 2 : target.left),
  );
  const top = target.top - size.height - 6 < 4 ? target.bottom + 6 : target.top - size.height - 6;
  return { left, top };
}
