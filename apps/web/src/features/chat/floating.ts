// A floating window of the chat (the emoji picker, the GIF window) next to the button that opened it (where: lib/floating.ts
// floatingBox), closed by a pointer down outside it and its button, Escape (on the document: before the windows and
// the drawers behind, which listen on `window`) or a resize of the panel.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { floatingBox } from '../../lib/floating';

/** Places `el` next to `anchor` (fixed position); its size, for what it holds. */
export function placeFloating(el: HTMLElement, anchor: Element, maxW = 352, maxH = 380) {
  const b = floatingBox(anchor.getBoundingClientRect(), { width: innerWidth, height: innerHeight }, maxW, maxH);
  Object.assign(el.style, { width: `${b.width}px`, height: `${b.height}px`, top: `${b.top}px`, left: `${b.left}px` });
  return { w: b.width, h: b.height };
}

/** Escape, a pointer down outside `el` and `anchor`, a resize: `onClose`. */
export function onDismiss(el: () => Element | null, anchor: () => Element | null, onClose: () => void) {
  const down = (e: PointerEvent) => {
    const path = e.composedPath(),
      a = anchor();
    if (!path.includes(el()!) && !(a && path.includes(a))) onClose();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    onClose();
  };
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('keydown', key);
  addEventListener('resize', onClose);
  return () => {
    document.removeEventListener('pointerdown', down, true);
    document.removeEventListener('keydown', key);
    removeEventListener('resize', onClose);
  };
}

/** A React window (`ref`) placed next to `anchor` while it is shown, and dismissed as above. */
export function useFloating(
  ref: RefObject<HTMLElement | null>,
  anchor: Element,
  onClose: () => void,
  maxW: number,
  maxH: number,
) {
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  useLayoutEffect(() => {
    placeFloating(ref.current!, anchor, maxW, maxH);
  }, [ref, anchor, maxW, maxH]);
  useEffect(
    () =>
      onDismiss(
        () => ref.current,
        () => anchor,
        () => close.current(),
      ),
    [ref, anchor],
  );
}
