// What the chat's field sends (openspec: chat-activity): a message (its `:codes:` as emoji, the message it answers,
// the picture waiting with it), or a command — /activity, /hote, /credit-social, /kick, /effet — that is not a message
// to everyone: what fails is said to me only (the store's note).
import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react';
import type { MessageView } from '@slopesque/shared';
import { request, upload } from '../../../app/net';
import { useStore } from '../../../app/store';
import { expandCodes, loadCodes, type CustomEmoji } from '../../../lib/emoji';
import { parseActivity, parseCredit, parseEffect } from '../../../lib/commands';
import { lightImage } from '../../../lib/light-image';
import { chooseActivity } from '../actions';
import { parseCommand, screamEmoji } from '../commands';
import type { Attachments } from './useAttachments';

/** A window opened by a command: /activity (on a kind, or the kinds), /credit-social (for a player, or the list). */
export type ChatModal = { kind: 'activity'; at: string | null } | { kind: 'credit'; to?: string } | null;

export interface SendDeps {
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  replyTo: MessageView | null;
  setReplyTo: (m: MessageView | null) => void;
  files: Attachments;
  custom: CustomEmoji[];
  inputRef: RefObject<HTMLInputElement | null>;
  hideSuggestions: () => void;
  onModal: (m: ChatModal) => void;
}

export function useSend(d: SendDeps) {
  const note = (text: string) => useStore.getState().set({ note: text });
  const fail = (r: { ok: boolean; error?: string }) => !r.ok && note(r.error ?? '');

  async function command(text: string) {
    const { name, word, arg } = parseCommand(text);
    const room = useStore.getState().room!,
      me = useStore.getState().account!.id;
    d.setDraft('');
    note('');
    if (name === 'activity') {
      if (!arg) return d.onModal({ kind: 'activity', at: null });
      const a = parseActivity(arg);
      if (!a)
        note(
          `Activité inconnue : « ${arg} ». Par exemple : /activity chat, /activity sondage, /activity cartes tarot, ` +
            '/activity demi-disque amphitheatre.',
        );
      else if ('kind' in a) d.onModal({ kind: 'activity', at: a.kind });
      else await chooseActivity(a.choice);
    } else if (name === 'credit') {
      if (!arg) return d.onModal({ kind: 'credit' });
      const c = parseCredit(
        arg,
        room.members.filter(m => m.id !== me),
      );
      if (!c.to)
        return note(
          `Joueur inconnu : « ${c.name} ». Par exemple : /credit-social ${room.members.find(m => m.id !== me)?.name ?? 'Léa'} +100.`,
        );
      if (c.delta === null || c.delta === 0) return d.onModal({ kind: 'credit', to: c.to.id });
      fail(await request('credit:give', { to: c.to.id, delta: c.delta }));
    } else if (name === 'effect') {
      if (!arg)
        return note(
          'Effets : /effet firework, /effet confetti (ou confetti Léa), /effet hit Léa, /effet tomato Léa, ' +
            '/effet hammer Léa, /effet screamer.',
        );
      const e = parseEffect(arg, room.members);
      if ('error' in e) return note(e.error);
      if (e.kind === 'screamer') return scream(screamEmoji(arg));
      fail(await request('effect:play', { kind: e.kind, target: e.target?.id ?? null }));
    } else if (name === 'host') {
      const r = await request('host:ask');
      note(!r.ok ? r.error : r.value === 'already' ? "Tu es déjà l'hôte." : '');
    } else if (name === 'kick') fail(await request('kick:ask', arg ? { name: arg } : {}));
    else note(`Commande inconnue : /${word}. Commandes : /activity, /hote, /kick, /credit-social, /effet.`);
  }

  /** /effet screamer: the picture waiting above the field (an image goes once, made light, never stored), or an emoji. */
  async function scream(emoji: string | null) {
    const a = d.files.attach;
    let pic: { kind: 'image' | 'sticker' | 'gif' | 'emoji'; value: string } | null = null;
    if (a?.kind === 'image') {
      d.files.setSending(true);
      const data = await lightImage(a.file);
      d.files.setSending(false);
      if (!data) return note('Cette image ne peut pas partir en screamer.');
      pic = { kind: 'image', value: data };
    } else if (a?.kind === 'sticker') pic = { kind: 'sticker', value: a.id };
    else if (a?.kind === 'gif') pic = { kind: 'gif', value: a.gif.url };
    else if (emoji) pic = { kind: 'emoji', value: emoji };
    if (!pic)
      return note(
        "Ajoute d'abord une image (+ → Fichier, Sticker ou GIF) : elle partira en screamer. Ou /effet screamer 😱.",
      );
    const r = await request('effect:play', { kind: 'screamer', pic });
    if (!r.ok) return note(r.error);
    d.files.dropAttach();
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = d.draft.trim(),
      a = d.files.attach;
    if ((!text && !a) || d.files.sending) return;
    d.hideSuggestions();
    if (text.startsWith('/')) {
      await command(text);
      d.inputRef.current?.focus();
      return;
    }
    await loadCodes();
    if (useStore.getState().conn !== 'ok')
      return note('Reconnexion en cours : ton message partira quand le salon sera de retour.');
    const body = { text: expandCodes(text, d.custom), replyTo: d.replyTo?.id ?? null };
    let r: { ok: boolean; error?: string };
    if (!a) r = await request('chat:send', body);
    else {
      // the picture, with the text written (or alone)
      d.files.setSending(true);
      if (a.kind === 'image') {
        const up = await upload('chat', a.file);
        r = up.ok ? await request('chat:media', { mediaId: up.value.id, ...body }) : up;
      } else if (a.kind === 'sticker') r = await request('sticker:send', { id: a.id, ...body });
      else r = await request('chat:gif', { gif: a.gif, ...body });
      d.files.setSending(false);
    }
    if (!r.ok) return note(r.error ?? '');
    d.setDraft('');
    d.setReplyTo(null);
    d.files.dropAttach();
    note('');
    d.inputRef.current?.focus();
  }

  return { send, command };
}
