// The chat (openspec: chat-activity, data-retention): messages and system lines, replies (the quote, a click goes to
// it, hovering shows it), reactions (the bar under a hovered message, my 4 last ones, « + » for the picker, a
// double click for my quick reaction), links, emoji :codes:, the start of what is kept (30 days).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GifRef, MediaView, MemberView, MessageView, Quote, StickerView } from '@slopesque/shared';
import { esc } from '../lib/html';
import { COMMANDS, DEFAULT_REACTIONS, emojiHtml, expandCodes, loadCodes, NAME, placeFloating, suggest, suggestName, SuggestList, useRecent, withCustom, type CustomEmoji, type EmojiPop, type Suggestion } from '../lib/emoji';
import { GifPop, useGif } from '../lib/gif';
import { localGif } from '../lib/gif-cache';
import { wireQuotes } from './hover';
import { argSuggestions, isComplete, parseActivity, parseCredit, parseEffect } from '../lib/commands';
import { lightImage } from '../lib/light-image';
import { linkify, previewHtml, type Preview } from '../lib/links';
import { request, ServerGifs, toggleGifFavorite, upload } from '../net';
import { useStore } from '../store';
import { Avatar, colorOf, Html, Icon, Who } from './common';
import { ActivityPicker } from './ActivityPicker';
import { CreditBadge, CreditCard, CreditModal } from './Credit';
import { VoteCard } from './Vote';
import type { Vote } from '@slopesque/engines';
import type { ActivityChoice } from '@slopesque/shared';

const QUICK = '\u{1F44D}\u{FE0F}';

/** A message in short, for a quote (one line, cut by CSS). */
function quoteHtml(q: { text: string; kind: string }, custom: CustomEmoji[]) {
  if ((q.kind === 'image' || q.kind === 'media') && q.text) return `📷 ${withCustom(esc(q.text), custom)}`;   // a picture with its text
  if (q.kind === 'image' || q.kind === 'media') return '📷 Image';
  if (q.kind === 'sticker' || q.kind === 'gif') return `${q.kind === 'gif' ? 'GIF' : 'Sticker'}${q.text ? ` · ${withCustom(esc(q.text), custom)}` : ''}`;
  return withCustom(esc(q.text), custom);
}

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
interface Picked { file: File; url: string; w: number; h: number; error: string }
/** A picture waiting above the field: an image not sent yet (sent with the message), a sticker of the room, a GIF. */
type Attach = { kind: 'image'; file: File; url: string; w: number; h: number } | { kind: 'sticker'; id: string; src: string; w: number; h: number } | { kind: 'gif'; gif: GifRef };
async function pick(file: File): Promise<Picked> {
  const url = URL.createObjectURL(file);
  if (!file.type.startsWith('image/')) return { file, url, w: 0, h: 0, error: 'Ce fichier n\'est pas une image : seules les images peuvent être envoyées (en sticker, en image ou en emoji).' };
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { return { file, url, w: 0, h: 0, error: 'Cette image ne peut pas être lue.' }; }
  return { file, url, w: img.naturalWidth, h: img.naturalHeight, error: '' };
}

/** A picture in a message: gone (a chat image after a week, a sticker removed), or the picture; a GIF has a star. */
function MediaBox({ m, favorite, onStar }: { m: MediaView; favorite: boolean; onStar: (g: GifRef) => void }) {
  const [kept, setKept] = useState<string | null>(null);   // a GIF: loaded once from its provider, kept on this device
  useEffect(() => { let on = true; if (m.kind === 'gif' && m.src) void localGif(m.src).then(u => { if (on) setKept(u); }); return () => { on = false; }; }, [m.kind, m.src]);
  if (!m.src) return <span className="msg-expired"><Icon name="imageOff" /><span>{m.kind === 'sticker' ? 'Sticker plus disponible' : 'Image plus disponible'}
    <small>{m.kind === 'sticker' ? 'Il a été retiré de la bibliothèque du salon.' : 'Les images du chat sont gardées une semaine.'}</small></span></span>;
  const style = { '--w': m.w, '--h': m.h } as React.CSSProperties;
  const img = <img className={`msg-${m.kind}`} src={kept ?? m.src} width={m.w} height={m.h} style={style} alt={{ sticker: 'Sticker', image: 'Image', gif: 'GIF' }[m.kind]} loading="lazy" draggable={false} />;
  if (m.kind !== 'gif' || !m.gif) return img;
  return <span className="msg-gif-box" style={style}>{img}<span className="gif-badge" aria-hidden="true">GIF</span>
    <button type="button" className={`gif-fav msg-gif-fav ${favorite ? 'on' : ''}`} onClick={() => onStar(m.gif!)} title={favorite ? 'Retirer de mes GIF favoris' : 'Ajouter à mes GIF favoris'} aria-pressed={favorite}><Icon name="star" /></button></span>;
}

export function Chat({ pop }: { pop: EmojiPop | null }) {
  const room = useStore(s => s.room)!, account = useStore(s => s.account)!, device = useStore(s => s.device);
  const setDevice = useStore(s => s.setDevice), note = useStore(s => s.note), set = useStore(s => s.set);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [reacting, setReacting] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<{ kind: 'activity'; at: string | null } | { kind: 'credit'; to?: string } | null>(null);
  const [attach, setAttach] = useState<Attach | null>(null), [sending, setSending] = useState(false);   // the picture waiting above the field
  const [showStickers, setShowStickers] = useState(false);
  const [picked, setPicked] = useState<Picked | 'loading' | null>(null);
  const [naming, setNaming] = useState<string | null>(null), [nameError, setNameError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null), gifRef = useRef<GifPop | null>(null), plusRef = useRef<HTMLButtonElement>(null);
  const custom: CustomEmoji[] = room.emoji.map(e => ({ name: e.name, url: e.url, by: e.by ?? '' }));
  const favorites = account.gifFavorites ?? [];
  const listRef = useRef<HTMLUListElement>(null), inputRef = useRef<HTMLInputElement>(null), boxRef = useRef<HTMLDivElement>(null);
  const suggestRef = useRef<SuggestList | null>(null);
  const members = new Map(room.members.map(m => [m.id, m]));
  const who = (id: string | null) => { const m = id ? members.get(id) : null; return m ? <Who name={id === account.id ? 'Toi' : m.name} hue={m.hue} /> : null; };
  const recent = device.recent.length ? device.recent : DEFAULT_REACTIONS;

  // the chat opens at its bottom and follows the last message when it was there (or when I just wrote); higher up, a
  // button brings it back down (with the number of messages arrived since)
  const atBottom = useRef(true), lastSeen = useRef(0);
  const [away, setAway] = useState(false), [unread, setUnread] = useState(0);
  const count = room.chat.messages.length, last = room.chat.messages.at(-1);
  const toBottom = (smooth = false) => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && (atBottom.current || last?.from === account.id)) el.scrollTop = el.scrollHeight;
    else if (last && lastSeen.current && last.id > lastSeen.current) { const fresh = room.chat.messages.filter(m => m.id > lastSeen.current && (!m.scope || m.scope === room.scope)).length; setUnread(n => n + fresh); }
    if (last) lastSeen.current = last.id;
  }, [count, last?.id, account.id]);
  useEffect(() => {   // shown (a drawer opening), resized, a picture loaded: still at the bottom if it was
    const el = listRef.current!;
    const stay = () => { if (atBottom.current) el.scrollTop = el.scrollHeight; };
    const ro = new ResizeObserver(stay);
    ro.observe(el);
    el.addEventListener('load', stay, true);
    return () => { ro.disconnect(); el.removeEventListener('load', stay, true); };
  }, []);

  useEffect(() => {   // a reply's quote hovered: the message quoted, whole (or what the reply kept of it)
    return wireQuotes(boxRef.current!, id => {
      const st = useStore.getState(), list = st.room?.chat.messages ?? [], m = list.find(x => x.id === id);
      const q = m ?? list.find(x => x.reply?.id === id)?.reply;
      if (!q || ('gone' in q && q.gone)) return '<div class="msg-body"><i>Ce message n\'existe plus.</i></div>';
      const p = q.from ? st.room?.members.find(x => x.id === q.from) : null;
      const who = p ? `<b style="color:${colorOf(p.hue)}">${esc(q.from === st.account?.id ? 'Toi' : p.name)}</b> ` : '';
      const media = m?.media;
      const body = media ? (media.src ? `<img src="${esc(media.src)}" width="${media.w}" height="${media.h}" alt="">` : '<i>Image plus disponible</i>')
        : q.kind === 'media' || q.kind === 'image' || q.kind === 'sticker' || q.kind === 'gif' ? quoteHtml(q, custom) : withCustom(esc(q.text), custom);
      return `<div class="msg-body">${who}${body}</div>`;
    });
  }, [custom]);

  useEffect(() => {
    void loadCodes();
    const box = boxRef.current!;
    suggestRef.current = new SuggestList(box, s => complete(s));
    // the reaction bar goes under the message where the pointer came in
    const over = (e: MouseEvent) => {
      const body = (e.target as Element).closest?.('.msg-body'), from = e.relatedTarget instanceof Node ? e.relatedTarget : null;
      if (!body || (from && body.contains(from))) return;
      const li = body.parentElement!, bar = li.querySelector<HTMLElement>('.react-bar');
      if (!bar || li.classList.contains('is-reacting') || (from && bar.contains(from))) return;
      const r = li.getBoundingClientRect(), w = bar.offsetWidth;
      bar.style.left = `${Math.round(Math.max(0, Math.min(r.width - w, e.clientX - r.left - w / 2)))}px`;
    };
    box.addEventListener('mouseover', over);
    // the GIF window: recent ones on this device, favourites with my account
    gifRef.current = new GifPop(box, new ServerGifs(), {
      recent: () => useStore.getState().device.gifRecent,
      favorites: () => useStore.getState().account?.gifFavorites ?? [],
      toggleFavorite: g => toggleFavorite(g),
    }, (el, anchor) => { placeFloating(el, anchor, 380, 460); });
    return () => { box.removeEventListener('mouseover', over); gifRef.current?.el.remove(); };
  }, []);

  useEffect(() => { pop?.setCustom(custom); });
  useEffect(() => { if (!note) return; const t = setTimeout(() => set({ note: '' }), 8000); return () => clearTimeout(t); }, [note, set]);   // a note goes after 8 s

  const toggleFavorite = toggleGifFavorite;

  /** A picture chosen (+ → Fichier, Sticker, GIF): it waits above the field, to go with a text or alone (or as a screamer). */
  function attachIt(a: Attach) {
    setAttach(old => { if (old?.kind === 'image' && old.url !== (a.kind === 'image' ? a.url : '')) URL.revokeObjectURL(old.url); return a; });
    setShowStickers(false); set({ note: '' });
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  const dropAttach = () => setAttach(old => { if (old?.kind === 'image') URL.revokeObjectURL(old.url); return null; });
  const chooseGif = (g: GifRef) => { setDevice({ gifRecent: useGif(useStore.getState().device.gifRecent, g) }); attachIt({ kind: 'gif', gif: g }); };

  async function choose(file: File) {
    setMenu(false); setShowStickers(false); setNaming(null); set({ note: '' });
    setPicked('loading');
    setPicked(await pick(file));
  }

  /** The file chosen becomes an image, a sticker (kept in the room's library) or a custom emoji of the room. */
  async function use(as: 'image' | 'sticker' | 'emoji') {
    if (!picked || picked === 'loading' || picked.error) return;
    if (as === 'emoji' && (!naming || !NAME.test(naming))) { setNameError('De 2 à 24 caractères : minuscules sans accent, chiffres et _.'); return; }
    if (as === 'emoji' && custom.some(c => c.name === naming)) { setNameError(`:${naming}: existe déjà dans le salon.`); return; }
    const p = picked;
    if (as === 'image') { setPicked(null); setNaming(null); attachIt({ kind: 'image', file: p.file, url: p.url, w: p.w, h: p.h }); return; }   // sent with the message
    setPicked('loading');
    const up = await upload(as, p.file);
    if (!up.ok) { setPicked({ ...p, error: up.error }); return; }
    if (as === 'sticker') {
      const r = await request('sticker:add', { mediaId: up.value.id, send: false });
      if (!r.ok) { setPicked({ ...p, error: r.error }); return; }
      URL.revokeObjectURL(p.url);
      setPicked(null);
      attachIt({ kind: 'sticker', id: r.value.id, src: r.value.src, w: r.value.w, h: r.value.h });
      return;
    }
    const r = await request('emoji:add', { name: naming, mediaId: up.value.id });
    if (!r.ok) { setPicked({ ...p, error: r.error }); return; }
    URL.revokeObjectURL(p.url);
    setPicked(null); setNaming(null);
  }

  async function react(id: number, emoji: string) {
    setDevice({ recent: useRecent(device.recent.length ? device.recent : DEFAULT_REACTIONS, emoji) });
    const r = await request('chat:react', { id, emoji });
    if (!r.ok) set({ note: r.error });
  }

  /** /activity, /hote, /credit-social, /kick: a command, not a message to everyone; what fails is said to me only. */
  async function command(text: string) {
    const [word = '', ...rest] = text.slice(1).trim().split(/\s+/), arg = rest.join(' ');
    const cmd = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    setDraft(''); set({ note: '' });
    if (cmd === 'activity' || cmd === 'activite') {
      if (!arg) { setModal({ kind: 'activity', at: null }); return; }
      const a = parseActivity(arg);
      if (!a) set({ note: `Activité inconnue : « ${arg} ». Par exemple : /activity chat, /activity sondage, /activity cartes tarot, /activity demi-disque amphitheatre.` });
      else if ('kind' in a) setModal({ kind: 'activity', at: a.kind });
      else await pickActivity(a.choice);
    } else if (cmd === 'credit-social' || cmd === 'credit' || cmd === 'creditsocial' || cmd === 'credit-score') {
      if (!arg) { setModal({ kind: 'credit' }); return; }
      const c = parseCredit(arg, room.members.filter(m => m.id !== account.id));
      if (!c.to) { set({ note: `Joueur inconnu : « ${c.name} ». Par exemple : /credit-social ${room.members.find(m => m.id !== account.id)?.name ?? 'Léa'} +100.` }); return; }
      if (c.delta === null || c.delta === 0) { setModal({ kind: 'credit', to: c.to.id }); return; }
      const r = await request('credit:give', { to: c.to.id, delta: c.delta });
      if (!r.ok) set({ note: r.error });
    } else if (cmd === 'effet' || cmd === 'effect' || cmd === 'effets') {
      if (!arg) { set({ note: 'Effets : /effet firework, /effet confetti (ou confetti Léa), /effet hit Léa, /effet tomato Léa, /effet hammer Léa, /effet screamer.' }); return; }
      const e = parseEffect(arg, room.members);
      if ('error' in e) { set({ note: e.error }); return; }
      if (e.kind === 'screamer') { await scream(arg.trim().split(/\s+/).slice(1).join(' ')); return; }
      const r = await request('effect:play', { kind: e.kind, target: e.target?.id ?? null });
      if (!r.ok) set({ note: r.error });
    } else if (cmd === 'hote' || cmd === 'host') {
      const r = await request('host:ask');
      set({ note: !r.ok ? r.error : r.value === 'already' ? 'Tu es déjà l\'hôte.' : '' });
    } else if (cmd === 'kick') {
      const r = await request('kick:ask', arg ? { name: arg } : {});
      if (!r.ok) set({ note: r.error });
    } else set({ note: `Commande inconnue : /${word}. Commandes : /activity, /hote, /kick, /credit-social, /effet.` });
  }

  async function pickActivity(c: ActivityChoice) {
    setModal(null);
    const r = await request('activity:choose', { choice: c });
    if (!r.ok) set({ note: r.error });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && !attach) || sending) return;
    suggestRef.current?.hide();
    if (text.startsWith('/')) { await command(text); inputRef.current?.focus(); return; }
    await loadCodes();
    if (useStore.getState().conn !== 'ok') { set({ note: 'Reconnexion en cours : ton message partira quand le salon sera de retour.' }); return; }
    const body = { text: expandCodes(text, custom), replyTo: replyTo?.id ?? null };
    let r: { ok: boolean; error?: string };
    if (!attach) r = await request('chat:send', body);
    else {   // the picture, with the text written (or alone)
      setSending(true);
      if (attach.kind === 'image') { const up = await upload('chat', attach.file); r = up.ok ? await request('chat:media', { mediaId: up.value.id, ...body }) : up; }
      else if (attach.kind === 'sticker') r = await request('sticker:send', { id: attach.id, ...body });
      else r = await request('chat:gif', { gif: attach.gif, ...body });
      setSending(false);
    }
    if (!r.ok) { set({ note: r.error ?? '' }); return; }
    setDraft(''); setReplyTo(null); dropAttach(); set({ note: '' });
    inputRef.current?.focus();
  }

  /** /effet screamer: the picture waiting above the field (an image goes once, made light, never stored), or an emoji. */
  async function scream(arg: string) {
    const emoji = arg.trim();
    let pic: { kind: 'image' | 'sticker' | 'gif' | 'emoji'; value: string } | null = null;
    if (attach?.kind === 'image') {
      setSending(true);
      const data = await lightImage(attach.file);
      setSending(false);
      if (!data) { set({ note: 'Cette image ne peut pas partir en screamer.' }); return; }
      pic = { kind: 'image', value: data };
    } else if (attach?.kind === 'sticker') pic = { kind: 'sticker', value: attach.id };
    else if (attach?.kind === 'gif') pic = { kind: 'gif', value: attach.gif.url };
    else if (emoji && !/[\p{L}\p{N}]/u.test(emoji.replace(/^:[a-z0-9_]+:$/, ''))) pic = { kind: 'emoji', value: emoji };
    if (!pic) { set({ note: 'Ajoute d\'abord une image (+ → Fichier, Sticker ou GIF) : elle partira en screamer. Ou /effet screamer 😱.' }); return; }
    const r = await request('effect:play', { kind: 'screamer', pic });
    if (!r.ok) { set({ note: r.error }); return; }
    dropAttach();
  }

  /** An emoji from the window: at the caret (replacing the selection), the caret after it. */
  function insertAtCaret(e: string) {
    const input = inputRef.current!, v = input.value, a = input.selectionStart ?? v.length, b = input.selectionEnd ?? a;
    const next = v.slice(0, a) + e + v.slice(b);
    setDraft(next);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(a + e.length, a + e.length); });
  }

  // the + menu, the stickers and a file being sent: closed by Escape (one at a time) or a click elsewhere (the menu)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (menu) setMenu(false);
      else if (picked) { setPicked(null); setNaming(null); }
      else if (showStickers) setShowStickers(false);
      else if (attach && document.activeElement === inputRef.current) dropAttach();
      else return;
      e.preventDefault();
    };
    const click = (e: PointerEvent) => { if (menu && !(e.target as Element).closest?.('.plus-wrap')) setMenu(false); };
    addEventListener('keydown', key);
    addEventListener('pointerdown', click);
    return () => { removeEventListener('keydown', key); removeEventListener('pointerdown', click); };
  }, [menu, picked, showStickers, attach]);

  function complete(s: Suggestion) {
    const input = inputRef.current!, at = input.selectionStart ?? draft.length, code = s.code;
    if (s.fill !== undefined) {   // an argument: the message so far, then what can follow it
      if (s.fill === draft) { suggestRef.current?.hide(); void command(draft); return; }
      onType(s.fill); requestAnimationFrame(() => { input.focus(); input.setSelectionRange(s.fill!.length, s.fill!.length); }); return;
    }
    if (draft.startsWith('/')) { onType(`/${code} `); requestAnimationFrame(() => input.focus()); return; }
    const before = draft.slice(0, at).replace(/:([a-z0-9_+-]*)$/, `:${code}: `);
    setDraft(before + draft.slice(at));
    suggestRef.current?.hide();
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(before.length, before.length); });
  }

  function onType(v: string) {
    setDraft(v);
    const args = argSuggestions(v, useStore.getState().room?.members ?? [], account.id);
    if (args) { if (args.length) suggestRef.current?.show(args, inputRef.current!); else suggestRef.current?.hide(); return; }
    const c = v.match(/^\/([a-z-]*)$/i);
    if (c) { const items = COMMANDS.filter(x => x.code.startsWith(c[1]!.toLowerCase())); if (items.length) { suggestRef.current?.show(items, inputRef.current!); return; } }
    const m = v.slice(0, inputRef.current?.selectionStart ?? v.length).match(/(?:^|\s):([a-z0-9_+-]{2,})$/);
    if (m) { const items = suggest(m[1]!, custom); if (items.length) { suggestRef.current?.show(items, inputRef.current!); return; } }
    suggestRef.current?.hide();
  }

  function onKey(e: React.KeyboardEvent) {
    const s = suggestRef.current;
    if (s?.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); s.move(e.key === 'ArrowDown' ? 1 : -1); return; }
      const cur = s.current();
      if (e.key === 'Enter' && cur?.cmd !== undefined && !cur.arg && draft.trim().toLowerCase() === `/${cur.code}`) { s.hide(); return; }   // a command written out: sent
      if (e.key === 'Enter' && cur?.arg && (cur.fill?.trim() === draft.trim() || isComplete(draft, room.members, account.id))) { s.hide(); return; }   // its arguments written out: sent
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (cur) complete(cur); return; }
      if (e.key === 'Escape') { e.stopPropagation(); s.hide(); return; }
    }
    if (e.key === 'Escape' && replyTo) { e.stopPropagation(); setReplyTo(null); }
  }

  async function more() {
    const first = room.chat.messages[0];
    if (!first || loadingMore || !room.chat.hasMore) return;
    setLoadingMore(true);
    const el = listRef.current!, h = el.scrollHeight;
    const r = await request('chat:history', { before: first.id });
    if (r.ok) { useStore.getState().prependPage(r.value); requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - h; }); }
    setLoadingMore(false);
  }

  function jump(id: number) {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
  }

  const replyRef = (q: Quote) => q.gone
    ? <span className="reply-ref is-gone">{Icon({ name: 'replied' })}<span className="reply-quote"><i>Message de plus de 30 jours, supprimé</i></span></span>
    : <button type="button" className="reply-ref" data-msg={q.id} onClick={() => jump(q.id)} title="Aller au message cité">{Icon({ name: 'replied' })}
      <span className="reply-who">{who(q.from)}</span><Html className="reply-quote" html={quoteHtml(q, custom)} /></button>;

  const textHtml = (m: MessageView) => {
    const html = linkify(m.text, t => withCustom(esc(t), custom));
    return m.preview ? html + previewHtml({ ...m.preview, image: m.preview.image ?? undefined, embed: m.preview.embed ?? undefined } as Preview, m.id, playing === m.id) : html;
  };

  return <div className="chat-box" ref={boxRef} data-dropzone
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); boxRef.current?.classList.add('is-drop'); } }}
    onDragLeave={e => { if (!boxRef.current?.contains(e.relatedTarget as Node)) boxRef.current?.classList.remove('is-drop'); }}
    onDrop={e => { e.preventDefault(); boxRef.current?.classList.remove('is-drop'); const f = e.dataTransfer.files[0]; if (f) void choose(f); }}
    onClick={e => { const play = (e.target as Element).closest<HTMLElement>('[data-action="link-play"]'); if (play) setPlaying(+play.dataset.msg!); }}
    onDoubleClick={e => {
      const t = e.target as Element;
      if (t.closest('a, button, input')) return;
      const li = t.closest('.msg-body')?.closest<HTMLElement>('[data-msg]');
      if (li) void react(+li.dataset.msg!, account.quick || QUICK);
    }}
    onMouseDown={e => { if (e.detail > 1 && (e.target as Element).closest('.msg-body')) e.preventDefault(); }}>
    <ul className="chat" ref={listRef} data-chat onScroll={e => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; setAway(!atBottom.current); if (atBottom.current) setUnread(0); if (el.scrollTop < 40) void more(); }}>
      {room.chat.hasMore ? <li className="msg sys chat-start">{loadingMore ? 'Chargement…' : <button className="btn ghost sm" type="button" onClick={more}>Messages plus anciens</button>}</li>
        : room.chat.start && <li className="msg sys chat-start">{room.chat.start === 'begin' ? 'Début de la conversation' : 'Les messages de plus de 30 jours ont été supprimés'}</li>}
      {room.chat.messages.filter(m => !m.scope || m.scope === room.scope).map(m => m.kind === 'vote' && m.data?.vote ? <VoteCard key={m.id} id={m.id} v={m.data.vote as Vote} members={members} me={account.id} />
        : m.kind === 'credit' && m.data ? <li key={m.id} className="msg credit" data-msg={m.id}><CreditCard data={m.data as { by: string; to: string; delta: number }} members={members} me={account.id} /></li>
        : m.from === null || m.kind === 'system'
        ? <li key={m.id} className="msg sys" data-msg={m.id}><Html html={withCustom(esc(m.text), custom)} /></li>
        : <li key={m.id} className={`msg${m.media ? ' has-media' : ''}${m.reply ? ' is-reply' : ''}${reacting === m.id ? ' is-reacting' : ''}`} data-msg={m.id}>
          {m.reply && replyRef(m.reply)}
          <div className="msg-body">{who(m.from)} {m.media ? <><MediaBox m={m.media} favorite={!!m.media.gif && favorites.some(f => f.id === m.media!.gif!.id)} onStar={toggleFavorite} />{m.text && <Html className="msg-caption" html={textHtml(m)} />}</> : <Html html={textHtml(m)} />}</div>
          <div className="react-bar" role="toolbar" aria-label="Réagir au message">
            {recent.map(e => <button key={e} type="button" onClick={() => void react(m.id, e)} title={`Réagir ${e}`} aria-label={`Réagir ${e}`}><Html html={emojiHtml(e, custom)} /></button>)}
            <button type="button" className="react-more" title="Autre emoji" aria-label="Autre emoji" onClick={ev => {
              setReacting(m.id);
              void pop?.open(ev.currentTarget, e => void react(m.id, e), { onClose: () => setReacting(null) });
            }}><Icon name="plus" /></button>
            <button type="button" className="react-reply" title="Répondre" aria-label="Répondre" onClick={() => { setReplyTo(m); inputRef.current?.focus(); }}><Icon name="reply" /></button></div>
          {Object.keys(m.reactions).length > 0 && <div className="reactions">{Object.entries(m.reactions).map(([e, ids]) => {
            const names = ids.map(id => (id === account.id ? 'Toi' : members.get(id)?.name ?? '?')).join(', ');
            return <button key={e} className={`reaction ${ids.includes(account.id) ? 'mine' : ''}`} type="button" onClick={() => void react(m.id, e)} data-names={names}
              aria-pressed={ids.includes(account.id)} aria-label={`${e} : ${ids.length} réaction${ids.length > 1 ? 's' : ''}`}><Html html={emojiHtml(e, custom)} />{ids.length > 1 && <b>{ids.length}</b>}</button>;
          })}</div>}
        </li>)}
    </ul>
    {away && <div className="to-bottom-anchor"><button className={`to-bottom ${unread ? 'has-new' : ''}`} type="button" onClick={() => { toBottom(true); setUnread(0); }}
      title={unread ? `${unread} nouveau${unread > 1 ? 'x' : ''} message${unread > 1 ? 's' : ''} : revenir en bas` : 'Revenir en bas du chat'} aria-label="Revenir en bas du chat">
      <Icon name="down" />{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}</button></div>}
    {picked ? <UploadPanel p={picked} naming={naming} nameError={nameError} onCancel={() => { setPicked(null); setNaming(null); }} onUse={use}
        onNaming={v => { setNaming(v); setNameError(''); }} onEmoji={() => { if (picked !== 'loading') { setNaming(suggestName(picked.file.name, custom.map(c => c.name))); setNameError(''); } }} />
      : showStickers && <StickerPanel onClose={() => setShowStickers(false)} onPick={st => attachIt({ kind: 'sticker', id: st.id, src: st.src, w: st.w, h: st.h })} />}
    {note && <p className="chat-note">{note}</p>}
    {attach && <div className={`attach-bar ${sending ? 'is-sending' : ''}`}>
      <span className="attach-thumb"><img src={attach.kind === 'gif' ? attach.gif.url : attach.kind === 'image' ? attach.url : attach.src} alt="" draggable={false} /></span>
      <span className="attach-text"><b>{{ image: 'Image', sticker: 'Sticker', gif: 'GIF' }[attach.kind]}</b><small>{sending ? 'Envoi…' : 'Écris un texte pour l\'accompagner (facultatif), puis Entrée — ou /effet screamer'}</small></span>
      <button className="icon-btn sm" type="button" onClick={dropAttach} title="Retirer" aria-label="Retirer l'image"><Icon name="close" /></button></div>}
    {replyTo && <div className="reply-bar"><Icon name="reply" /><span className="reply-who">Réponse à {who(replyTo.from)}</span><Html className="reply-quote" html={quoteHtml(replyTo, custom)} />
      <button className="icon-btn sm" type="button" onClick={() => setReplyTo(null)} title="Ne plus répondre" aria-label="Ne plus répondre"><Icon name="close" /></button></div>}
    <form className="chat-form" data-form="chat" onSubmit={send}>
      <input ref={inputRef} name="text" placeholder={attach ? 'Un texte avec l\'image (facultatif)…' : replyTo ? 'Ta réponse…' : 'Écrire un message… (/ pour les commandes)'} autoComplete="off" maxLength={500} value={draft}
        onChange={e => onType(e.target.value)} onKeyDown={onKey} onBlur={() => suggestRef.current?.hide()} />
      <button className="icon-btn" title="Envoyer" aria-label="Envoyer"><Icon name="send" /></button>
      <div className="plus-wrap"><button ref={plusRef} className="icon-btn" type="button" title="Fichier, sticker, GIF, emoji" aria-label="Fichier, sticker, GIF, emoji" aria-haspopup="menu" aria-expanded={menu}
        onClick={() => setMenu(!menu)}><Icon name="plus" /></button>
        {menu && <div className="plus-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenu(false); fileRef.current?.click(); }}><Icon name="file" />Fichier</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setPicked(null); setShowStickers(!showStickers); }}><Icon name="sticker" />Sticker</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); gifRef.current?.open(plusRef.current!, chooseGif); }}><Icon name="gif" />GIF</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); void pop?.open(plusRef.current!, insertAtCaret, { keepOpen: true }); }}><Icon name="smile" />Emoji</button></div>}</div>
    </form>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void choose(f); }} />
    <div className="drop-hint" aria-hidden="true"><Icon name="file" />Dépose ton image</div>
    {modal?.kind === 'activity' && <ActivityPicker kind={modal.at} current={room.activity.activity} host={room.hostId === account.id}
      busy={room.chat.messages.some(m => m.kind === 'vote' && !(m.data?.vote as Vote | undefined)?.result)}
      onKind={k => setModal({ kind: 'activity', at: k })} onPick={c => void pickActivity(c)} onClose={() => setModal(null)} />}
    {modal?.kind === 'credit' && <CreditModal members={room.members} me={account.id} initial={modal.to ?? null} onClose={() => setModal(null)} />}
  </div>;
}

/** A file chosen or dropped: its preview, then Sticker, Image or Emoji (with its name). */
function UploadPanel({ p, naming, nameError, onCancel, onUse, onNaming, onEmoji }: { p: Picked | 'loading'; naming: string | null; nameError: string;
  onCancel: () => void; onUse: (as: 'image' | 'sticker' | 'emoji') => void; onNaming: (v: string | null) => void; onEmoji: () => void }) {
  if (p === 'loading') return <div className="chat-panel upload"><p className="note">Envoi…</p></div>;
  const head = <div className="panel-head"><b title={p.file.name}>{p.file.name}</b><small>{fmtSize(p.file.size)}{p.w ? ` · ${p.w} × ${p.h}` : ''}</small>
    <button className="icon-btn sm" type="button" onClick={onCancel} title="Annuler" aria-label="Annuler"><Icon name="close" /></button></div>;
  if (p.error) return <div className="chat-panel upload">{head}<p className="alert" role="alert">{p.error}</p></div>;
  return <div className="chat-panel upload">{head}<div className={`upload-preview ${naming !== null ? 'is-emoji' : ''}`}><img src={p.url} alt="Aperçu" /></div>
    {naming !== null ? <form className="emoji-name" onSubmit={e => { e.preventDefault(); onUse('emoji'); }}>
      <label className="field"><span>Nom de l'emoji (s'écrit :nom: dans un message)</span>
        <input name="emojiName" value={naming} onChange={e => onNaming(e.target.value)} maxLength={24} autoComplete="off" spellCheck={false} autoFocus /></label>
      {nameError ? <p className="alert" role="alert">{nameError}</p> : <p className="note">Minuscules, chiffres et _ ; tous les joueurs du salon pourront l'utiliser.</p>}
      <div className="row"><button className="btn ghost sm" type="button" onClick={() => onNaming(null)}>Retour</button><button className="btn sm">Ajouter aux emoji</button></div></form>
      : <div className="upload-choice">
        <button className="choice" type="button" onClick={() => onUse('sticker')}><b>Sticker</b><small>petit format, gardé dans les stickers du salon ; puis il attend d'être envoyé</small></button>
        <button className="choice" type="button" onClick={() => onUse('image')}><b>Image</b><small>grand format, avec un texte si tu veux (gardée une semaine) ; le serveur la compresse</small></button>
        <button className="choice" type="button" onClick={onEmoji}><b>Emoji</b><small>ajouté aux emoji du salon, pour tous</small></button></div>}</div>;
}

/** The room's sticker library: a click puts one above the field (to send with a text or alone), its cross removes it. */
function StickerPanel({ onClose, onPick }: { onClose: () => void; onPick: (st: StickerView) => void }) {
  const list = useStore(s => s.room?.stickers ?? []);
  const head = <div className="panel-head"><b>Stickers du salon</b><button className="icon-btn sm" type="button" onClick={onClose} title="Fermer" aria-label="Fermer"><Icon name="close" /></button></div>;
  if (!list.length) return <div className="chat-panel stickers">{head}<p className="alert" role="alert">Aucun sticker pour l'instant. Ajoute une image en sticker : + → Fichier, ou glisse-la dans le chat.</p></div>;
  return <div className="chat-panel stickers">{head}<ul className="sticker-grid">{list.map(st => <li key={st.id}>
    <button className="sticker-item" type="button" title="Choisir (il attend au-dessus du champ)" onClick={() => onPick(st)}>
      <img src={st.src} width={st.w} height={st.h} alt="Sticker" /></button>
    <button className="sticker-del" type="button" title="Retirer des stickers du salon" aria-label="Retirer" onClick={() => void request('sticker:remove', { id: st.id })}><Icon name="close" /></button></li>)}</ul></div>;
}

/** The players (Chat activity: the left drawer), the host first; the host can hand over the role. */
export function People({ onGiveHost }: { onGiveHost: (m: MemberView) => void }) {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const list = [...room.members].sort((a, b) => Number(b.id === room.hostId) - Number(a.id === room.hostId) || a.joinedAt - b.joinedAt);
  return <><ol className="people">{list.map(p => <li key={p.id} className={`person ${p.id === me ? 'is-me' : ''}`}>
    <Avatar name={p.name} hue={p.hue} photo={p.photo} />
    <span className="person-name">{p.name}{p.id === me && <> <i>(toi)</i></>}<PresenceIcon m={p} host={p.id === room.hostId} /></span>
    {room.activity.activity === 'chat' && <CreditBadge v={p.credit} />}
    <span className="role">{p.id === room.hostId ? <><span className="crown"><Icon name="crown" /></span>hôte</> : p.playing ? 'joueur' : 'membre'}</span>
    {room.hostId === me && p.id !== me && <button className="icon-btn sm" type="button" onClick={() => onGiveHost(p)} title={`Donner le rôle d'hôte à ${p.name}`} aria-label="Donner le rôle d'hôte"><Icon name="crown" /></button>}
  </li>)}</ol>
    <p className="note people-note">Pas de classement dans cette activité : les scores sont gardés tels quels jusqu'à une réinitialisation de la partie (onglet Partie).</p></>;
}

export function PresenceIcon({ m, host }: { m: MemberView; host: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { if (m.presence === 'here') return; const t = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(t); }, [m.presence]);
  if (m.presence === 'here' || m.awaySince === null) return null;
  const mins = Math.max(1, Math.floor((Date.now() - m.awaySince) / 60_000)), gone = mins >= 5;
  return <> <span className={`presence ${gone ? 'gone' : 'away'}`} title={`Absence : ${mins} min${gone && host ? ' · /hote donne le rôle d\'hôte sans vote' : ''}`}>
    <Icon name={gone ? 'gone' : 'away'} /></span></>;
}
