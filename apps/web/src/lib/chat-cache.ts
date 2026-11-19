// The chat kept on this device (openspec: chat-activity, Chargement du chat): the panel is created again on every page
// and every opening, so the room's last messages are kept here and a join only asks for what came after them (with a
// refresh of the last ones). What was loaded is never dropped while the panel lives; the device keeps the 300 last.
import { RETENTION, type ChatPage, type MessageView } from '@slopesque/shared';

const KEEP = 300;
const keyOf = (server: string, room: string, me: string) => `slp-chat:${server}|${room}|${me}`;

/** A page from the server merged into what the device has: `since` (only what follows it is new), a page that overlaps
 *  what we have (the older ones kept), or a page after a gap (it replaces everything). */
export function mergeChat(had: ChatPage | null, page: ChatPage): ChatPage {
  const old = had?.messages ?? [];
  if (page.since != null && had) return { messages: [...old.filter(m => m.id <= page.since!), ...page.messages], hasMore: had.hasMore, start: had.start };
  const first = page.messages[0], last = old.at(-1);
  if (had && first && last && first.id <= last.id) return { messages: [...old.filter(m => m.id < first.id), ...page.messages], hasMore: had.hasMore, start: had.start };
  return { messages: page.messages, hasMore: page.hasMore, start: page.start };
}

export function loadChat(server: string, room: string, me: string): ChatPage | null {
  try {
    const raw = localStorage.getItem(keyOf(server, room, me));
    if (!raw) return null;
    const c = JSON.parse(raw) as ChatPage, limit = Date.now() - RETENTION.messages;
    const messages = c.messages.filter(m => m.at > limit);   // the server deleted these (30 days)
    return messages.length ? { ...c, messages } : null;
  } catch { return null; }
}

export function saveChat(server: string, room: string, me: string, c: ChatPage) {
  const messages: MessageView[] = c.messages.slice(-KEEP);
  try { localStorage.setItem(keyOf(server, room, me), JSON.stringify({ messages, hasMore: c.hasMore || messages.length < c.messages.length, start: messages.length < c.messages.length ? null : c.start })); }
  catch { /* full or refused: the next join loads a page */ }
}
