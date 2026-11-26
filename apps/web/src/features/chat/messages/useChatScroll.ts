// The chat's scrolling (openspec: chat-activity, Chargement du chat): it opens at its bottom and follows the last
// message when it was there (or when I just wrote); shown again, resized or a picture loaded, it stays at its bottom.
// Higher up, a button brings it back down, with the number of messages arrived since; at its top, the older messages
// are asked for (the place kept).
import { useEffect, useLayoutEffect, useRef, useState, type RefObject, type UIEvent, type WheelEvent } from 'react';
import { request } from '../../../app/net';
import { useStore } from '../../../app/store';
import { freshCount, nearBottom, nearTop } from '../model';

const SETTLE = 700; // ms after the button: what grew meanwhile (a picture loaded), at the very bottom in the end

export function useChatScroll(listRef: RefObject<HTMLUListElement | null>) {
  const chat = useStore(s => s.room!.chat),
    scope = useStore(s => s.room!.scope),
    me = useStore(s => s.account!.id);
  const atBottom = useRef(true),
    lastSeen = useRef(0),
    goingDown = useRef(0); // the button was clicked: on its way down
  const [away, setAway] = useState(false),
    [unread, setUnread] = useState(0),
    [loadingMore, setLoadingMore] = useState(false);
  const count = chat.messages.length,
    last = chat.messages.at(-1);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && (atBottom.current || last?.from === me)) el.scrollTop = el.scrollHeight;
    else if (last && lastSeen.current && last.id > lastSeen.current) {
      const fresh = freshCount(chat.messages, lastSeen.current, scope);
      setUnread(n => n + fresh);
    }
    if (last) lastSeen.current = last.id;
  }, [count, last?.id, me]); // a new message (not each change of one)

  useEffect(() => {
    const el = listRef.current!;
    const stay = () => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    };
    const ro = new ResizeObserver(stay);
    ro.observe(el);
    el.addEventListener('load', stay, true);
    return () => {
      ro.disconnect();
      el.removeEventListener('load', stay, true);
    };
  }, [listRef]);

  function toBottom(smooth = false) {
    const el = listRef.current;
    if (!el) return;
    atBottom.current = true;
    setAway(false);
    setUnread(0);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    clearTimeout(goingDown.current);
    goingDown.current = window.setTimeout(() => {
      goingDown.current = 0;
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    }, SETTLE);
  }

  /** The page before the first message shown, the place in the list kept. */
  async function more() {
    const first = chat.messages[0];
    if (!first || loadingMore || !chat.hasMore) return;
    setLoadingMore(true);
    const el = listRef.current!,
      h = el.scrollHeight;
    const r = await request('chat:history', { before: first.id });
    if (r.ok) {
      useStore.getState().prependPage(r.value);
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - h;
      });
    }
    setLoadingMore(false);
  }

  function onScroll(e: UIEvent<HTMLElement>) {
    const el = e.currentTarget;
    if (nearTop(el)) void more();
    if (goingDown.current) return; // on its way down (the button): not « away »
    atBottom.current = nearBottom(el);
    setAway(!atBottom.current);
    if (atBottom.current) setUnread(0);
  }

  function onWheel(e: WheelEvent) {
    if (e.deltaY < 0 && goingDown.current) {
      clearTimeout(goingDown.current); // scrolled up on the way down: the reader takes over
      goingDown.current = 0;
    }
  }

  return { away, unread, loadingMore, hasMore: chat.hasMore, start: chat.start, toBottom, more, onScroll, onWheel };
}
