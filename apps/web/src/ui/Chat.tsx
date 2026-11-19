// The chat (openspec: chat-activity, data-retention): messages and system lines, replies (the quote, a click goes to
// it, hovering shows it), reactions (the bar under a hovered message, my 4 last ones, « + » for the picker, a
// double click for my quick reaction), links, emoji :codes:, the start of what is kept (30 days).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GifRef, MediaView, MemberView, MessageView, Quote } from '@slopesque/shared';
import { esc } from '../lib/html';
import { COMMANDS, DEFAULT_REACTIONS, emojiHtml, expandCodes, loadCodes, NAME, placeFloating, suggest, suggestName, SuggestList, useRecent, withCustom, type CustomEmoji, type EmojiPop } from '../lib/emoji';
import { GifPop, useGif } from '../lib/gif';
import { linkify, previewHtml, type Preview } from '../lib/links';
import { request, ServerGifs, upload } from '../net';
import { useStore } from '../store';
import { Avatar, Html, Icon, Who } from './common';
import { ActivityPicker } from './ActivityPicker';
import { CreditBadge, CreditCard, CreditModal } from './Credit';
import { VoteCard } from './Vote';
import type { Vote } from '@slopesque/engines';
import type { ActivityChoice } from '@slopesque/shared';

const QUICK = '\u{1F44D}\u{FE0F}';

/** A message in short, for a quote (one line, cut by CSS). */
function quoteHtml(q: { text: string; kind: string }, custom: CustomEmoji[]) {
  if (q.kind === 'image' || q.kind === 'media') return '📷 Image';
  if (q.kind === 'sticker') return 'Sticker';
  if (q.kind === 'gif') return 'GIF';
  return withCustom(esc(q.text), custom);
}

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
interface Picked { file: File; url: string; w: number; h: number; error: string }
async function pick(file: File): Promise<Picked> {
  const url = URL.createObjectURL(file);
  if (!file.type.startsWith('image/')) return { file, url, w: 0, h: 0, error: 'Ce fichier n\'est pas une image : seules les images peuvent être envoyées (en sticker, en image ou en emoji).' };
  if (file.size > 15 * 1024 * 1024) return { file, url, w: 0, h: 0, error: `Image trop lourde (${fmtSize(file.size)}, 15 Mo au plus).` };
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { return { file, url, w: 0, h: 0, error: 'Cette image ne peut pas être lue.' }; }
  return { file, url, w: img.naturalWidth, h: img.naturalHeight, error: '' };
}

/** A picture in a message: gone (a chat image after a week, a sticker removed), or the picture; a GIF has a star. */
function MediaBox({ m, favorite, onStar }: { m: MediaView; favorite: boolean; onStar: (g: GifRef) => void }) {
  if (!m.src) return <span className="msg-expired"><Icon name="imageOff" /><span>{m.kind === 'sticker' ? 'Sticker plus disponible' : 'Image plus disponible'}
    <small>{m.kind === 'sticker' ? 'Il a été retiré de la bibliothèque du salon.' : 'Les images du chat sont gardées une semaine.'}</small></span></span>;
  const style = { '--w': m.w, '--h': m.h } as React.CSSProperties;
  const img = <img className={`msg-${m.kind}`} src={m.src} width={m.w} height={m.h} style={style} alt={{ sticker: 'Sticker', image: 'Image', gif: 'GIF' }[m.kind]} loading="lazy" draggable={false} />;
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
  const [modal, setModal] = useState<{ kind: 'activity'; at: string | null } | { kind: 'credit' } | null>(null);
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

  // the chat follows the last message when it was there (or when I just wrote)
  const atBottom = useRef(true);
  const count = room.chat.messages.length, last = room.chat.messages.at(-1);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && (atBottom.current || last?.from === account.id)) el.scrollTop = el.scrollHeight;
  }, [count, last?.id, account.id]);

  useEffect(() => {
    void loadCodes();
    const box = boxRef.current!;
    suggestRef.current = new SuggestList(box, s => complete(s.code));
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

  function toggleFavorite(g: GifRef) {
    const st = useStore.getState(), acc = st.account!;
    const list = acc.gifFavorites ?? [], on = list.some(x => x.id === g.id);
    const next = on ? list.filter(x => x.id !== g.id) : [g, ...list].slice(0, 500);
    st.set({ account: { ...acc, gifFavorites: next } });
    void request('gif:favorites', { favorites: next });
  }

  async function sendGif(g: GifRef) {
    setDevice({ gifRecent: useGif(useStore.getState().device.gifRecent, g) });
    const r = await request('chat:gif', { gif: g });
    if (!r.ok) set({ note: r.error });
  }

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
    setPicked('loading');
    const up = await upload(as === 'image' ? 'chat' : as, p.file);
    const r = !up.ok ? up : as === 'image' ? await request('chat:media', { mediaId: up.value.id, replyTo: replyTo?.id ?? null })
      : as === 'sticker' ? await request('sticker:add', { mediaId: up.value.id, send: true }) : await request('emoji:add', { name: naming, mediaId: up.value.id });
    if (!r.ok) { setPicked({ ...p, error: r.error }); return; }
    URL.revokeObjectURL(p.url);
    setPicked(null); setNaming(null); setReplyTo(null);
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
    if (cmd === 'activity' || cmd === 'activite') setModal({ kind: 'activity', at: null });
    else if (cmd === 'credit-social' || cmd === 'credit' || cmd === 'creditsocial') setModal({ kind: 'credit' });
    else if (cmd === 'hote' || cmd === 'host') {
      const r = await request('host:ask');
      set({ note: !r.ok ? r.error : r.value === 'already' ? 'Tu es déjà l\'hôte.' : '' });
    } else if (cmd === 'kick') {
      const r = await request('kick:ask', arg ? { name: arg } : {});
      if (!r.ok) set({ note: r.error });
    } else set({ note: `Commande inconnue : /${word}. Commandes : /activity, /hote, /kick, /credit-social.` });
  }

  async function pickActivity(c: ActivityChoice) {
    setModal(null);
    const r = await request('activity:choose', { choice: c });
    if (!r.ok) set({ note: r.error });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    suggestRef.current?.hide();
    if (text.startsWith('/')) { await command(text); inputRef.current?.focus(); return; }
    await loadCodes();
    if (useStore.getState().conn !== 'ok') { set({ note: 'Reconnexion en cours : ton message partira quand le salon sera de retour.' }); return; }
    const r = await request('chat:send', { text: expandCodes(text, custom), replyTo: replyTo?.id ?? null });
    if (!r.ok) { set({ note: r.error }); return; }
    setDraft(''); setReplyTo(null); set({ note: '' });
    inputRef.current?.focus();
  }

  function complete(code: string) {
    const input = inputRef.current!, at = input.selectionStart ?? draft.length;
    if (draft.startsWith('/')) { setDraft(`/${code}`); suggestRef.current?.hide(); requestAnimationFrame(() => input.focus()); return; }
    const before = draft.slice(0, at).replace(/:([a-z0-9_+-]*)$/, `:${code}: `);
    setDraft(before + draft.slice(at));
    suggestRef.current?.hide();
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(before.length, before.length); });
  }

  function onType(v: string) {
    setDraft(v);
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
      if (e.key === 'Enter' && cur?.cmd !== undefined && draft.trim().toLowerCase() === `/${cur.code}`) { s.hide(); return; }   // a command written out: sent
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (cur) complete(cur.code); return; }
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
    : <button type="button" className="reply-ref" onClick={() => jump(q.id)} title="Aller au message cité">{Icon({ name: 'replied' })}
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
    <ul className="chat" ref={listRef} data-chat onScroll={e => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; if (el.scrollTop < 40) void more(); }}>
      {room.chat.hasMore ? <li className="msg sys chat-start">{loadingMore ? 'Chargement…' : <button className="btn ghost sm" type="button" onClick={more}>Messages plus anciens</button>}</li>
        : room.chat.start && <li className="msg sys chat-start">{room.chat.start === 'begin' ? 'Début de la conversation' : 'Les messages de plus de 30 jours ont été supprimés'}</li>}
      {room.chat.messages.map(m => m.kind === 'vote' && m.data?.vote ? <VoteCard key={m.id} id={m.id} v={m.data.vote as Vote} members={members} me={account.id} />
        : m.kind === 'credit' && m.data ? <li key={m.id} className="msg credit" data-msg={m.id}><CreditCard data={m.data as { by: string; to: string; delta: number }} members={members} me={account.id} /></li>
        : m.from === null || m.kind === 'system'
        ? <li key={m.id} className="msg sys" data-msg={m.id}><Html html={withCustom(esc(m.text), custom)} /></li>
        : <li key={m.id} className={`msg${m.media ? ' has-media' : ''}${m.reply ? ' is-reply' : ''}${reacting === m.id ? ' is-reacting' : ''}`} data-msg={m.id}>
          {m.reply && replyRef(m.reply)}
          <div className="msg-body">{who(m.from)} {m.media ? <MediaBox m={m.media} favorite={!!m.media.gif && favorites.some(f => f.id === m.media!.gif!.id)} onStar={toggleFavorite} /> : <Html html={textHtml(m)} />}</div>
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
              title={names} aria-pressed={ids.includes(account.id)} aria-label={`${e} : ${ids.length} réaction${ids.length > 1 ? 's' : ''}`}><Html html={emojiHtml(e, custom)} />{ids.length > 1 && <b>{ids.length}</b>}</button>;
          })}</div>}
        </li>)}
    </ul>
    {picked ? <UploadPanel p={picked} naming={naming} nameError={nameError} onCancel={() => { setPicked(null); setNaming(null); }} onUse={use}
        onNaming={v => { setNaming(v); setNameError(''); }} onEmoji={() => { if (picked !== 'loading') { setNaming(suggestName(picked.file.name, custom.map(c => c.name))); setNameError(''); } }} />
      : showStickers && <StickerPanel onClose={() => setShowStickers(false)} onSent={() => setShowStickers(false)} />}
    {note && <p className="chat-note">{note}</p>}
    {replyTo && <div className="reply-bar"><Icon name="reply" /><span className="reply-who">Réponse à {who(replyTo.from)}</span><Html className="reply-quote" html={quoteHtml(replyTo, custom)} />
      <button className="icon-btn sm" type="button" onClick={() => setReplyTo(null)} title="Ne plus répondre" aria-label="Ne plus répondre"><Icon name="close" /></button></div>}
    <form className="chat-form" data-form="chat" onSubmit={send}>
      <input ref={inputRef} name="text" placeholder={replyTo ? 'Ta réponse…' : 'Écrire un message… (/ pour les commandes)'} autoComplete="off" maxLength={500} value={draft}
        onChange={e => onType(e.target.value)} onKeyDown={onKey} onBlur={() => suggestRef.current?.hide()} />
      <button className="icon-btn" title="Envoyer" aria-label="Envoyer"><Icon name="send" /></button>
      <div className="plus-wrap"><button ref={plusRef} className="icon-btn" type="button" title="Fichier, sticker, GIF, emoji" aria-label="Fichier, sticker, GIF, emoji" aria-haspopup="menu" aria-expanded={menu}
        onClick={() => setMenu(!menu)}><Icon name="plus" /></button>
        {menu && <div className="plus-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenu(false); fileRef.current?.click(); }}><Icon name="file" />Fichier</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setPicked(null); setShowStickers(!showStickers); }}><Icon name="sticker" />Sticker</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); gifRef.current?.open(plusRef.current!, g => void sendGif(g)); }}><Icon name="gif" />GIF</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); void pop?.open(plusRef.current!, e => { setDraft(d => d + e); inputRef.current?.focus(); }, { keepOpen: true }); }}><Icon name="smile" />Emoji</button></div>}</div>
    </form>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void choose(f); }} />
    <div className="drop-hint" aria-hidden="true"><Icon name="file" />Dépose ton image</div>
    {modal?.kind === 'activity' && <ActivityPicker kind={modal.at} current={room.activity.activity} host={room.hostId === account.id}
      busy={room.chat.messages.some(m => m.kind === 'vote' && !(m.data?.vote as Vote | undefined)?.result)}
      onKind={k => setModal({ kind: 'activity', at: k })} onPick={c => void pickActivity(c)} onClose={() => setModal(null)} />}
    {modal?.kind === 'credit' && <CreditModal members={room.members} me={account.id} onClose={() => setModal(null)} />}
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
        <button className="choice" type="button" onClick={() => onUse('sticker')}><b>Sticker</b><small>petit format, gardé dans les stickers du salon</small></button>
        <button className="choice" type="button" onClick={() => onUse('image')}><b>Image</b><small>grand format, envoyée maintenant (gardée une semaine)</small></button>
        <button className="choice" type="button" onClick={onEmoji}><b>Emoji</b><small>ajouté aux emoji du salon, pour tous</small></button></div>}</div>;
}

/** The room's sticker library: a click sends one, its cross removes it from the library. */
function StickerPanel({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const list = useStore(s => s.room?.stickers ?? []), set = useStore(s => s.set);
  const head = <div className="panel-head"><b>Stickers du salon</b><button className="icon-btn sm" type="button" onClick={onClose} title="Fermer" aria-label="Fermer"><Icon name="close" /></button></div>;
  if (!list.length) return <div className="chat-panel stickers">{head}<p className="alert" role="alert">Aucun sticker pour l'instant. Ajoute une image en sticker : + → Fichier, ou glisse-la dans le chat.</p></div>;
  return <div className="chat-panel stickers">{head}<ul className="sticker-grid">{list.map(st => <li key={st.id}>
    <button className="sticker-item" type="button" title="Envoyer" onClick={async () => { const r = await request('sticker:send', { id: st.id }); if (!r.ok) set({ note: r.error }); else onSent(); }}>
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
  </li>)}</ol></>;
}

function PresenceIcon({ m, host }: { m: MemberView; host: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { if (m.presence === 'here') return; const t = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(t); }, [m.presence]);
  if (m.presence === 'here' || m.awaySince === null) return null;
  const mins = Math.max(1, Math.floor((Date.now() - m.awaySince) / 60_000)), gone = mins >= 5;
  return <> <span className={`presence ${gone ? 'gone' : 'away'}`} title={gone ? `Absence : ${mins} min, 5 min ou plus${host ? ' : /hote donne le rôle d\'hôte sans vote' : ''}` : `Absence : ${mins} min (fenêtre ou extension fermée)`}>
    <Icon name={gone ? 'gone' : 'away'} /></span></>;
}
