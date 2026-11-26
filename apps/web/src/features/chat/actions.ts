// What the chat asks the server, outside any component: a reaction (and my recent ones), a sticker removed, an
// activity chosen. What fails is said under the chat (the store's `note`), to me only.
import type { ActivityChoice } from '@slopesque/shared';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { DEFAULT_REACTIONS, pushRecent } from '../../lib/emoji';

const say = (r: { ok: true } | { ok: false; error: string }) => {
  if (!r.ok) useStore.getState().set({ note: r.error });
};

/** A reaction to a message (again: taken back); it goes first in my recent ones. */
export async function react(id: number, emoji: string) {
  const st = useStore.getState(),
    recent = st.device.recent;
  st.setDevice({ recent: pushRecent(recent.length ? recent : DEFAULT_REACTIONS, emoji) });
  say(await request('chat:react', { id, emoji }));
}

export async function removeSticker(id: string) {
  say(await request('sticker:remove', { id }));
}

export async function chooseActivity(choice: ActivityChoice) {
  say(await request('activity:choose', { choice }));
}
