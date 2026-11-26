// The emoji picker of the panel: emoji-picker-element (a web component, patched in patches/) — the whole Unicode list
// grouped by category like the system pickers, French names and search, the frequently used ones, the room's custom
// emoji in « Personnalisé ». One element for the whole panel, made on first use and kept (its database, its frequent
// emoji), in one floating window (`.emoji-pop`, created here, outside React: the element must live on between two
// openings). It opens next to a button (above it when there is room); a new opening replaces the current one. React
// opens it with <EmojiPicker> (EmojiPicker.tsx).
import type { Picker } from 'emoji-picker-element';
import fr from 'emoji-picker-element/i18n/fr';
import dataSource from '../../../emoji-fr.json?url';
import type { CustomEmoji } from '../../../lib/emoji';
import { onDismiss, placeFloating } from '../floating';

export interface PickerOpening {
  anchor: Element;
  onPick: (e: string) => void;
  /** Several emoji in a row (the field): a pick doesn't close it. */
  keepOpen?: boolean;
  /** Closed: by a pick, a click outside, Escape, a resize, or another opening. */
  onClose?: () => void;
}

let win: HTMLElement | null = null,
  picker: Picker | null = null,
  current: PickerOpening | null = null,
  undo: (() => void) | null = null;
let custom: CustomEmoji[] = [],
  customKey = '',
  dark = false;

function windowEl() {
  if (!win) {
    win = document.createElement('div');
    win.className = 'emoji-pop';
    win.hidden = true;
    document.body.append(win);
  }
  return win;
}

async function load(el: HTMLElement) {
  if (picker) return picker;
  const { Picker } = await import('emoji-picker-element');
  if (picker) return picker;
  picker = new Picker({ locale: 'fr', dataSource, i18n: fr });
  picker.addEventListener('emoji-click', e => {
    const o = current,
      d = e.detail;
    o?.onPick(d.unicode ?? `:${d.name}:`);
    if (o && !o.keepOpen) closePicker(o);
  });
  el.append(picker);
  applyCustom();
  applyTheme();
  return picker;
}

/** Opens the window next to `o.anchor` (the current opening closed first). */
export async function openPicker(o: PickerOpening) {
  closePicker();
  current = o;
  const el = windowEl(),
    p = await load(el);
  if (current !== o) return; // closed, or opened elsewhere, while it was loading
  el.hidden = false;
  const { w } = placeFloating(el, o.anchor);
  p.style.setProperty('--num-columns', String(Math.max(6, Math.floor((w - 16) / 40))));
  undo = onDismiss(
    () => el,
    () => o.anchor,
    () => closePicker(o),
  );
  requestAnimationFrame(() => p.shadowRoot?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()); // type to search
}

/** Closes the window (only when it is `o`'s, if given); its `onClose` is called unless `silent` (its owner is going). */
export function closePicker(o?: PickerOpening, silent = false) {
  if (!current || (o && current !== o)) return;
  const done = current;
  current = null;
  undo?.();
  undo = null;
  if (win) win.hidden = true;
  if (!silent) done.onClose?.();
}

export const pickerOpening = () => current;

/** The room's custom emoji, in « Personnalisé ». */
export function setPickerCustom(list: CustomEmoji[]) {
  const key = list.map(c => `${c.name} ${c.url}`).join(',');
  if (key === customKey) return;
  customKey = key;
  custom = list;
  applyCustom();
}
function applyCustom() {
  if (picker) picker.customEmoji = custom.map(c => ({ name: c.name, shortcodes: [c.name], url: c.url }));
}

/** The theme of the panel (its colours: features/chat/emoji.css). */
export function setPickerTheme(isDark: boolean) {
  dark = isDark;
  applyTheme();
}
function applyTheme() {
  picker?.classList.toggle('dark', dark);
  picker?.classList.toggle('light', !dark);
}
