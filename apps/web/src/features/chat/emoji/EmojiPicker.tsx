// The emoji picker, as a component: while it is rendered, the panel's picker window (picker.ts) is open next to
// `anchor`; it renders nothing itself (the web component lives in its own window). `onClose` when the window closes
// by itself (a pick unless `keepOpen`, a click outside, Escape, a resize, another opening): the owner stops rendering it.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { closePicker, openPicker, type PickerOpening } from './picker';

export interface EmojiPickerProps {
  anchor: Element;
  onPick: (emoji: string) => void;
  onClose: () => void;
  keepOpen?: boolean;
}

export function EmojiPicker({ anchor, onPick, onClose, keepOpen = false }: EmojiPickerProps) {
  const latest = useRef({ onPick, onClose });
  useLayoutEffect(() => {
    latest.current = { onPick, onClose };
  });
  useEffect(() => {
    const o: PickerOpening = {
      anchor,
      keepOpen,
      onPick: e => latest.current.onPick(e),
      onClose: () => latest.current.onClose(),
    };
    void openPicker(o);
    return () => closePicker(o, true);
  }, [anchor, keepOpen]);
  return null;
}
