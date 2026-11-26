// TRANSITION (deleted in task 4.1): the picker opened from code, as before the chat's conversion — app/App.tsx creates
// one (`new EmojiPop(host)`) for Profil's quick reaction and the theme, and hands it to features/poll (a choice's
// emoji). The same window as <EmojiPicker> (picker.ts): one for the whole panel, so `host` is not used.
import { closePicker, openPicker, pickerOpening, setPickerCustom, setPickerTheme, type PickerOpening } from './picker';
import type { CustomEmoji } from '../../../lib/emoji';

/** @deprecated Render <EmojiPicker> (features/chat/emoji/EmojiPicker.tsx) and call setPickerTheme (picker.ts).
 *  Still used by app/App.tsx (task 3.6) and features/poll (a choice's emoji). */
export class EmojiPop {
  private opening: PickerOpening | null = null;

  constructor(_host?: HTMLElement) {}

  get isOpen() {
    return !!this.opening && pickerOpening() === this.opening;
  }

  open(anchor: Element, onPick: (e: string) => void, o: { keepOpen?: boolean; onClose?: () => void } = {}) {
    this.opening = { anchor, onPick, keepOpen: o.keepOpen, onClose: o.onClose };
    return openPicker(this.opening);
  }

  close() {
    if (this.opening) closePicker(this.opening);
  }

  setCustom(list: CustomEmoji[]) {
    setPickerCustom(list);
  }

  setTheme(dark: boolean) {
    setPickerTheme(dark);
  }
}
