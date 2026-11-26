// The chat's rules of display, without React or DOM (model.test.ts): which lines are shown and what each is, when the
// list counts as « at its bottom » (followed) or « at its top » (older messages asked for), what the button back to
// the bottom, a reaction and a quote say.
import type { MemberView, MessageView } from '@slopesque/shared';

/** Under this distance (px) from an end of the list: at its bottom, or at its top. */
export const EDGE = 40;
interface Scroll {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}
export const nearBottom = (el: Scroll) => el.scrollHeight - el.scrollTop - el.clientHeight < EDGE;
export const nearTop = (el: Pick<Scroll, 'scrollTop'>) => el.scrollTop < EDGE;

/** A game's system line is shown only during that activity's session (RoomState.scope). */
export const inScope = (m: MessageView, scope: string | null | undefined) => !m.scope || m.scope === scope;
/** The lines arrived after the message `seen` and shown: what the button back to the bottom counts. */
export const freshCount = (list: MessageView[], seen: number, scope: string | null | undefined) =>
  list.filter(m => m.id > seen && inScope(m, scope)).length;

export type LineKind = 'vote' | 'poll' | 'credit' | 'system' | 'message';
/** What a line of the chat is: a vote, a poll continued here, a change of social credit, a line of the room, or a
 *  player's message. */
export function lineKind(m: MessageView): LineKind {
  if (m.kind === 'vote' && m.data?.vote) return 'vote';
  if (m.kind === 'poll' && m.data?.chatPoll) return 'poll';
  if (m.kind === 'credit' && m.data) return 'credit';
  if (m.from === null || m.kind === 'system') return 'system';
  return 'message';
}

/** The button back to the bottom: its title, and its count (99 at most). */
export const unreadTitle = (n: number) =>
  n ? `${n} nouveau${n > 1 ? 'x' : ''} message${n > 1 ? 's' : ''} : revenir en bas` : 'Revenir en bas du chat';
export const unreadCount = (n: number) => (n > 99 ? '99+' : String(n));

/** Who reacted (the hover tip), « Toi » for me. */
export const reactionNames = (ids: string[], members: Map<string, MemberView>, me: string) =>
  ids.map(id => (id === me ? 'Toi' : (members.get(id)?.name ?? '?'))).join(', ');
export const reactionLabel = (e: string, n: number) => `${e} : ${n} réaction${n > 1 ? 's' : ''}`;

/** A piece of a quote: plain text, a remark in italics, or the player's text (custom emoji shown, no link). */
export type QuotePart = { kind: 'plain' | 'em' | 'text'; text: string };
const plain = (text: string): QuotePart => ({ kind: 'plain', text }),
  said = (text: string): QuotePart => ({ kind: 'text', text });
const PICTURES = ['image', 'media', 'sticker', 'gif'];

/** A message in short, for a quote (one line, cut by CSS): its text, or what its picture was. */
export function quoteParts(q: { text: string; kind: string; expired?: boolean }): QuotePart[] {
  const tail = q.text ? [plain(' · '), said(q.text)] : [];
  if (q.expired) return [plain('📷 '), { kind: 'em', text: 'Image expirée' }, ...tail]; // a week old: deleted
  if (q.kind === 'image' || q.kind === 'media') return q.text ? [plain('📷 '), said(q.text)] : [plain('📷 Image')];
  if (q.kind === 'sticker' || q.kind === 'gif') return [plain(q.kind === 'gif' ? 'GIF' : 'Sticker'), ...tail];
  return [said(q.text)];
}
/** The quoted message whole (the bubble over a reply's quote): a picture's message as in a quote, a text as is. */
export const fullQuoteParts = (q: { text: string; kind: string; expired?: boolean }) =>
  PICTURES.includes(q.kind) ? quoteParts(q) : [said(q.text)];

/** A file's size, in French units. */
export const fmtSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;

/** A CSS `url()` of an address (a preview's picture): quoted, its quotes and backslashes escaped. */
export const cssUrl = (s: string) =>
  `url("${s.replace(/["\\\n\r]/g, c => `\\${c === '\n' ? 'a ' : c === '\r' ? 'd ' : c}`)}")`;
