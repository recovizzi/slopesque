// Behaviours shared by the windows, menus and popovers of the library.
import { useEffect, type RefObject } from 'react';

/** Calls `onClose` on Escape, unless a window above already handled it (the event is then marked as handled: the
 *  drawer or the panel behind stays open). */
export function useEscape(onClose: () => void, on = true) {
  useEffect(() => {
    if (!on) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose, on]);
}

/** Escape (as useEscape) and a pointer down outside `ref` (which holds the trigger too) call `onClose`. */
export function useDismiss(ref: RefObject<Element | null>, onClose: () => void, on = true) {
  useEscape(onClose, on);
  useEffect(() => {
    if (!on) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !e.composedPath().includes(ref.current)) onClose();
    };
    addEventListener('pointerdown', down);
    return () => removeEventListener('pointerdown', down);
  }, [ref, onClose, on]);
}
