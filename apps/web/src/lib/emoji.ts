// Emoji: the picker (emoji-picker-element: the whole Unicode list grouped by category like the system pickers, French
// names and search, frequently used, the game's custom emoji in « Personnalisé », last), the `:code:` of every emoji
// (src/emoji-fr.json, made by scripts/shortcodes.mjs: `:rire:` 😂, `:yes:` 👍…) with their autocomplete, the custom
// emoji of a game (`:name:` in a message, shown as their image) and the recent reactions of a player.
// See openspec/changes/define-game-concept/specs/chat-activity/spec.md.
import type { Picker } from 'emoji-picker-element';
import fr from 'emoji-picker-element/i18n/fr';
import dataSource from '../emoji-fr.json?url';
import { esc } from './html';

/** An emoji added to the game by a player, for everyone (kept with the game, purged with it). */
export interface CustomEmoji { name: string; url: string; by: string }

export const THUMBS_UP = '\u{1F44D}\u{FE0F}';   // as in the picker's data (with VS16), so both give the same reaction
export const DEFAULT_REACTIONS = [THUMBS_UP, '😂', '😢', '😡'];   // thumbs up, laughing, tear, anger
export const RECENT_REACTIONS = 4;
/** A reaction used goes first; the oldest drops out of the four. */
export const useRecent = (list: string[], e: string) => [e, ...list.filter(x => x !== e)].slice(0, RECENT_REACTIONS);

export const NAME = /^[a-z0-9_]{2,24}$/;
const CUSTOM = /:([a-z0-9_]{2,24}):/g;

/** A name for a custom emoji from a file name: lower case, no accents, `_` between words, free in the game. */
export function suggestName(file: string, taken: string[]) {
  const base = (file.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20)) || 'emoji';
  const name = base.length < 2 ? `${base}_e` : base;
  if (!taken.includes(name)) return name;
  for (let i = 2; ; i++) if (!taken.includes(`${name}_${i}`)) return `${name}_${i}`;
}

// ------------------------------------------------------------------ :codes:
interface Code { code: string; emoji: string }
const codes: Code[] = [];
const byCode = new Map<string, string>(), firstCode = new Map<string, string>();
let loading: Promise<void> | null = null;

/** The codes of every emoji (the picker's data file, fetched once). */
export function loadCodes() {
  loading ??= fetch(dataSource).then(r => r.json()).then((data: { emoji: string; shortcodes?: string[] }[]) => {
    for (const e of data) for (const code of e.shortcodes ?? []) {
      codes.push({ code, emoji: e.emoji });
      byCode.set(code, e.emoji);
      if (!firstCode.has(e.emoji)) firstCode.set(e.emoji, code);
    }
  }).catch(() => { loading = null; });
  return loading;
}

/** The main `:code:` of an emoji (`rire` for 😂), or of a custom one. */
export const codeOf = (e: string) => (e.startsWith(':') ? e.slice(1, -1) : firstCode.get(e) ?? '');

const CODE = /:([a-z0-9_+-]{1,40}):/g;
/** A message as sent: every `:code:` of a standard emoji becomes the emoji; the game's custom `:name:` stay (shown as
 *  their image), as does an unknown code. */
export function expandCodes(text: string, custom: CustomEmoji[]) {
  const mine = new Set(custom.map(c => c.name));
  return text.replace(CODE, (m, c: string) => (mine.has(c) ? m : byCode.get(c) ?? m));
}

export interface Suggestion { code: string; emoji?: string; url?: string; cmd?: string; fill?: string; arg?: boolean }   // cmd: a chat command, what it does; arg: one of its arguments (fill: the message once chosen)
/** The chat's commands (typed `/` at the start of a message). */
export const COMMANDS: Suggestion[] = [
  { code: 'activity', cmd: 'changer d\'activité (/activity cartes tarot ; vote si tu n\'es pas l\'hôte)' },
  { code: 'hote', cmd: 'devenir l\'hôte (vote ; direct s\'il est absent depuis 5 min)' },
  { code: 'credit-social', cmd: 'donner ou retirer du crédit social à un joueur (/credit-social Léa +100)' },
  { code: 'kick', cmd: 'faire quitter la table au joueur qui ne joue plus depuis 30 s (vote)' },
  { code: 'effet', cmd: 'un effet chez tous : firework, confetti, hit, tomato, hammer, screamer' },
];
/** Emoji whose code starts with (then contains) what is typed after ":", the game's first; one line per emoji. */
export function suggest(q: string, custom: CustomEmoji[], limit = 6): Suggestion[] {
  const out: Suggestion[] = [], seen = new Set<string>();
  const push = (s: Suggestion, key: string) => { if (!seen.has(key) && out.length < limit) { seen.add(key); out.push(s); } };
  for (const c of custom) if (c.name.startsWith(q)) push({ code: c.name, url: c.url }, `:${c.name}:`);
  const exact = byCode.get(q);
  if (exact) push({ code: q, emoji: exact }, exact);
  const starts = codes.filter(c => c.code.startsWith(q)).sort((a, b) => a.code.length - b.code.length);
  for (const c of starts) push({ code: c.code, emoji: c.emoji }, c.emoji);
  for (const c of codes) if (out.length < limit && c.code.includes(q)) push({ code: c.code, emoji: c.emoji }, c.emoji);
  return out;
}

/** The suggestions above the field, while typing `:co`: ↑ ↓ to choose, Entrée or Tab to write it, Échap to leave. */
export class SuggestList {
  readonly el: HTMLUListElement;
  items: Suggestion[] = [];
  index = 0;

  constructor(host: HTMLElement, private choose: (s: Suggestion) => void) {
    this.el = document.createElement('ul');
    this.el.className = 'emoji-suggest';
    this.el.setAttribute('role', 'listbox');
    this.el.hidden = true;
    host.append(this.el);
    this.el.addEventListener('mousedown', e => {   // keeps the focus in the field
      e.preventDefault();
      const li = (e.target as Element).closest<HTMLElement>('[data-i]');
      if (li) this.choose(this.items[+li.dataset.i!]);
    });
  }

  get isOpen() { return !this.el.hidden; }

  show(items: Suggestion[], field: HTMLElement) {
    if (!items.length) return this.hide();
    if (items.map(i => i.code).join() !== this.items.map(i => i.code).join()) this.index = 0;
    this.items = items;
    this.draw();
    const r = field.getBoundingClientRect();
    Object.assign(this.el.style, { left: `${r.left}px`, width: `${Math.min(r.width, 320)}px`, bottom: `${innerHeight - r.top + 4}px` });
    this.el.hidden = false;
  }

  hide() { this.el.hidden = true; this.items = []; }

  move(d: number) { this.index = (this.index + d + this.items.length) % this.items.length; this.draw(); }

  current() { return this.items[this.index]; }

  private draw() {
    this.el.innerHTML = this.items.map((s, i) => `<li role="option" data-i="${i}" class="${i === this.index ? 'on' : ''}" aria-selected="${i === this.index}">
      ${s.cmd !== undefined ? `<span class="sg-code">${s.arg ? '' : '/'}${esc(s.code)}</span><span class="sg-hint">${esc(s.cmd)}</span>`
        : `<span class="sg-emoji">${s.url ? `<img class="emoji-custom" src="${esc(s.url)}" alt="">` : esc(s.emoji!)}</span><span class="sg-code">:${esc(s.code)}:</span>`}</li>`).join('');
  }
}

const img = (c: CustomEmoji) => `<img class="emoji-custom" src="${esc(c.url)}" alt=":${c.name}:" title=":${c.name}:" draggable="false">`;

/** Escaped text with the game's `:name:` replaced by their image. */
export function withCustom(escaped: string, custom: CustomEmoji[]) {
  if (!custom.length) return escaped;
  const map = new Map(custom.map(c => [c.name, c]));
  return escaped.replace(CUSTOM, (m, n: string) => { const c = map.get(n); return c ? img(c) : m; });
}

/** One emoji (a reaction): unicode, or `:name:` of a custom emoji. */
export const emojiHtml = (e: string, custom: CustomEmoji[]) => withCustom(esc(e), custom);

// ------------------------------------------------------------------ the picker, in a floating window
/** A floating window (emoji, GIF) next to its button: above it when there is room, else below, else as high as it
 *  fits; its right edge on the button's, within the panel. */
export function placeFloating(el: HTMLElement, anchor: Element, maxW = 352, maxH = 380) {
  const r = anchor.getBoundingClientRect(), m = 8;
  const w = Math.min(maxW, innerWidth - 2 * m), h = Math.min(maxH, innerHeight - 2 * m);
  const top = r.top - h - 6 >= m ? r.top - h - 6 : r.bottom + 6 + h <= innerHeight - m ? r.bottom + 6 : Math.max(m, innerHeight - h - m);
  Object.assign(el.style, { width: `${w}px`, height: `${h}px`, top: `${top}px`, left: `${Math.max(m, Math.min(innerWidth - w - m, r.right - w))}px` });
  return { w, h };
}

/** The picker opens next to a button (the chat's "+", a message's reactions), above it when there is room. Loaded on
 *  first use. Closed by a click outside, Échap, or a pick when `keepOpen` is false. */
export class EmojiPop {
  readonly el: HTMLElement;
  private picker: Picker | null = null;
  private onPick: ((e: string) => void) | null = null;
  private onClose: (() => void) | null = null;
  private anchor: Element | null = null;
  private keepOpen = false;
  private custom = '';
  private customList: CustomEmoji[] = [];
  private dark = false;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'emoji-pop';
    this.el.hidden = true;
    host.append(this.el);
    document.addEventListener('pointerdown', e => {
      if (this.el.hidden) return;
      const path = e.composedPath();
      if (!path.includes(this.el) && !(this.anchor && path.includes(this.anchor))) this.close();
    }, true);
    window.addEventListener('resize', () => this.close());
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); } });   // focus may be anywhere
  }

  get isOpen() { return !this.el.hidden; }

  async open(anchor: Element, onPick: (e: string) => void, o: { keepOpen?: boolean; onClose?: () => void } = {}) {
    if (this.isOpen) this.close();
    this.anchor = anchor; this.onPick = onPick; this.onClose = o.onClose ?? null; this.keepOpen = !!o.keepOpen;
    if (!this.picker) {
      const { Picker } = await import('emoji-picker-element');
      this.picker = new Picker({ locale: 'fr', dataSource, i18n: fr });
      this.picker.addEventListener('emoji-click', e => {
        const d = e.detail, pick = d.unicode ?? `:${d.name}:`;
        this.onPick?.(pick);
        if (!this.keepOpen) this.close();
      });
      this.el.append(this.picker);
      this.applyCustom();
      this.applyTheme();
    }
    this.el.hidden = false;
    this.place();
    requestAnimationFrame(() => this.picker?.shadowRoot?.querySelector<HTMLInputElement>('input[type="search"]')?.focus());   // type to search
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    const done = this.onClose;
    this.anchor = this.onPick = this.onClose = null;
    done?.();
  }

  private place() {
    const { w } = placeFloating(this.el, this.anchor!);
    this.picker!.style.setProperty('--num-columns', String(Math.max(6, Math.floor((w - 16) / 40))));
  }

  /** The game's custom emoji, in « Personnalisé ». */
  setCustom(list: CustomEmoji[]) {
    const key = list.map(c => c.name).join(',');
    if (key === this.custom) return;
    this.custom = key; this.customList = list;
    this.applyCustom();
  }

  private applyCustom() {
    if (this.picker) this.picker.customEmoji = this.customList.map(c => ({ name: c.name, shortcodes: [c.name], url: c.url }));
  }

  setTheme(dark: boolean) { this.dark = dark; this.applyTheme(); }
  private applyTheme() {
    this.picker?.classList.toggle('dark', this.dark);
    this.picker?.classList.toggle('light', !this.dark);
  }
}
