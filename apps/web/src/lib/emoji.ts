// Emoji without DOM: the `:code:` of every emoji (src/emoji-fr.json, made by scripts/shortcodes.mjs: `:rire:` 😂,
// `:yes:` 👍…) and their suggestions, the chat's commands in the same list, the custom emoji of a room (`:name:` in a
// message, shown as their picture by <RichText>) and the recent reactions of a player. The picker (the web component)
// and the suggestions' list are the chat's: features/chat/emoji/, features/chat/composer/Suggestions.tsx.
// See openspec/changes/define-game-concept/specs/chat-activity/spec.md.
import dataSource from '../emoji-fr.json?url';

/** An emoji added to the game by a player, for everyone (kept with the game, purged with it). */
export interface CustomEmoji {
  name: string;
  url: string;
  by: string;
}

export const THUMBS_UP = '\u{1F44D}\u{FE0F}'; // as in the picker's data (with VS16), so both give the same reaction
export const DEFAULT_REACTIONS = [THUMBS_UP, '😂', '😢', '😡']; // thumbs up, laughing, tear, anger
export const RECENT_REACTIONS = 4;
/** A reaction used goes first; the oldest drops out of the four. */
export const pushRecent = (list: string[], e: string) => [e, ...list.filter(x => x !== e)].slice(0, RECENT_REACTIONS);

export const NAME = /^[a-z0-9_]{2,24}$/;

/** A name for a custom emoji from a file name: lower case, no accents, `_` between words, free in the game. */
export function suggestName(file: string, taken: string[]) {
  const base =
    file
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'emoji';
  const name = base.length < 2 ? `${base}_e` : base;
  if (!taken.includes(name)) return name;
  for (let i = 2; ; i++) if (!taken.includes(`${name}_${i}`)) return `${name}_${i}`;
}

// ------------------------------------------------------------------ :codes:
interface Code {
  code: string;
  emoji: string;
}
const codes: Code[] = [];
const byCode = new Map<string, string>(),
  firstCode = new Map<string, string>();
let loading: Promise<void> | null = null;

/** The codes of every emoji (the picker's data file, fetched once). */
export function loadCodes() {
  loading ??= fetch(dataSource)
    .then(r => r.json())
    .then((data: { emoji: string; shortcodes?: string[] }[]) => {
      for (const e of data)
        for (const code of e.shortcodes ?? []) {
          codes.push({ code, emoji: e.emoji });
          byCode.set(code, e.emoji);
          if (!firstCode.has(e.emoji)) firstCode.set(e.emoji, code);
        }
    })
    .catch(() => {
      loading = null;
    });
  return loading;
}

/** The main `:code:` of an emoji (`rire` for 😂), or of a custom one. */
export const codeOf = (e: string) => (e.startsWith(':') ? e.slice(1, -1) : (firstCode.get(e) ?? ''));

const CODE = /:([a-z0-9_+-]{1,40}):/g;
/** A message as sent: every `:code:` of a standard emoji becomes the emoji; the game's custom `:name:` stay (shown as
 *  their image), as does an unknown code. */
export function expandCodes(text: string, custom: CustomEmoji[]) {
  const mine = new Set(custom.map(c => c.name));
  return text.replace(CODE, (m, c: string) => (mine.has(c) ? m : (byCode.get(c) ?? m)));
}

/** A line of the suggestions above the field: an emoji (`emoji`, or a custom one's `url`), a chat command (`cmd`:
 *  what it does), or one of its arguments (`arg`; `fill`: the message once chosen). */
export interface Suggestion {
  code: string;
  emoji?: string;
  url?: string;
  cmd?: string;
  fill?: string;
  arg?: boolean;
}
/** The chat's commands (typed `/` at the start of a message). */
export const COMMANDS: Suggestion[] = [
  { code: 'activity', cmd: "changer d'activité (/activity cartes tarot ; vote si tu n'es pas l'hôte)" },
  { code: 'hote', cmd: "devenir l'hôte (vote ; direct s'il est absent depuis 5 min)" },
  { code: 'credit-social', cmd: 'donner ou retirer du crédit social à un joueur (/credit-social Léa +100)' },
  { code: 'kick', cmd: 'faire quitter la table au joueur qui ne joue plus depuis 30 s (vote)' },
  { code: 'effet', cmd: 'un effet chez tous : firework, confetti, hit, tomato, hammer, screamer' },
];
/** Emoji whose code starts with (then contains) what is typed after ":", the game's first; one line per emoji. */
export function suggest(q: string, custom: CustomEmoji[], limit = 6): Suggestion[] {
  const out: Suggestion[] = [],
    seen = new Set<string>();
  const push = (s: Suggestion, key: string) => {
    if (!seen.has(key) && out.length < limit) {
      seen.add(key);
      out.push(s);
    }
  };
  for (const c of custom) if (c.name.startsWith(q)) push({ code: c.name, url: c.url }, `:${c.name}:`);
  const exact = byCode.get(q);
  if (exact) push({ code: q, emoji: exact }, exact);
  const starts = codes.filter(c => c.code.startsWith(q)).sort((a, b) => a.code.length - b.code.length);
  for (const c of starts) push({ code: c.code, emoji: c.emoji }, c.emoji);
  for (const c of codes) if (out.length < limit && c.code.includes(q)) push({ code: c.code, emoji: c.emoji }, c.emoji);
  return out;
}

// ------------------------------------------------------------------ transition (deleted in task 4.1)
/** @deprecated The picker opened from code, for app/App.tsx (task 3.6) and features/poll (task 3.1): the chat
 *  renders <EmojiPicker> (features/chat/emoji/EmojiPicker.tsx). */
export { EmojiPop } from '../features/chat/emoji/emoji-pop';
/** @deprecated For features/poll, which hands it to GifPop: the windows place themselves (not used any more). */
export { placeFloating } from '../features/chat/floating';
