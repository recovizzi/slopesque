// The shell's behaviours (App.tsx): the theme, the classes on <body> that the CSS lays the panel out with, Escape,
// the chat opened on a vote that starts outside the Chat activity.
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { RoomState } from '@slopesque/shared';
import { EmojiPop } from '../lib/emoji';
import type { Device } from '../lib/device';

/** The emoji window (one for the panel, in `host`), in the device's theme — the page's too. */
export function useEmojiPop(host: RefObject<HTMLDivElement | null>, theme: Device['theme']) {
  const [pop, setPop] = useState<EmojiPop | null>(null);
  useEffect(() => {
    if (host.current && !pop) setPop(new EmojiPop(host.current));
  }, [host, pop]);
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    pop?.setTheme(dark);
  }, [theme, dark, pop]);
  return pop;
}

/** The classes on <body>: the activity (its stage), the drawers open, a room that can't be entered, the first launch. */
export function useBodyClasses(o: {
  activity?: string;
  room: boolean;
  left: boolean;
  right: boolean;
  blocked: boolean;
  first: boolean;
}) {
  useEffect(() => {
    const b = document.body.classList;
    b.toggle('activity-chat', !o.room || o.activity === 'chat');
    b.toggle('activity-poll', o.activity === 'poll');
    b.toggle('activity-wheel', o.activity === 'wheel');
    b.toggle('activity-cards', o.activity === 'cards');
    b.toggle('activity-web', o.activity === 'lowtide');
    b.toggle('left-open', o.left);
    b.toggle('right-open', o.right);
    b.toggle('room-blocked', o.blocked);
    b.toggle('is-welcome', o.first);
  }, [o.activity, o.room, o.left, o.right, o.blocked, o.first]);
}

/** Escape, when no window above handled it: the code window, else the settings, else the panel itself (embedded). */
export function useShellEscape(
  steps: { codeModal: boolean; closeCode: () => void; right: boolean; closeRight: () => void },
  embed: boolean,
) {
  const { codeModal, closeCode, right, closeRight } = steps;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (codeModal) closeCode();
      else if (right) closeRight();
      else if (embed) parent.postMessage({ scd: 'close' }, '*');
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [codeModal, right]);
}

/** A vote starts outside the Chat activity: the chat opens on it (the left drawer). */
export function useVoteOpensChat(room: RoomState | null, activity: string, openChat: () => void) {
  const open =
    room?.chat.messages.findLast(m => m.kind === 'vote' && !(m.data?.vote as { result?: string } | undefined)?.result)
      ?.id ?? 0;
  const seen = useRef(0);
  useEffect(() => {
    if (!open || open === seen.current) return;
    seen.current = open;
    if (activity !== 'chat') openChat();
  }, [open, activity]);
}
