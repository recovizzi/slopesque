// The boards (DiskBoard, AmphiBoard) under the pointer: screen coordinates turned into the viewBox's.

/** The SVG coordinates under a pointer, or null while the board isn't laid out. */
export function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}
