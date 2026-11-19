// The chat (openspec: chat-activity, data-retention): messages and system lines, replies (the quote, a click goes to
// it, hovering shows it), reactions (the bar under a hovered message, my 4 last ones, « + » for the picker, a
// double click for my quick reaction), links, emoji :codes:, the start of what is kept (30 days).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MemberView, MessageView, Quote } from '@slopesque/shared';
import { esc } from '../lib/html';
import { DEFAULT_REACTIONS, emojiHtml, expandCodes, loadCodes, suggest, SuggestList, useRecent, withCustom, type EmojiPop } from '../lib/emoji';
import { linkify, findLinks, previewOf, previewHtml } from '../lib/links';
import { request } from '../net';
import { useStore } from '../store';
import { Html, Icon, Who } from './common';

const QUICK = '\u{1F44D}\u{FE0F}';

/** A message in short, for a quote (one line, cut by CSS). */
function quoteHtml(q: { text: string; kind: string }) {
  if (q.kind === 'image' || q.kind === 'media') return '📷 Image';
  if (q.kind === 'sticker') return 'Sticker';
  if (q.kind === 'gif') return 'GIF';
  return withCustom(esc(q.text), []);
}

export function Chat({ pop }: { pop: EmojiPop | null }) {
  const room = useStore(s => s.room)!, account = useStore(s => s.account)!, device = useStore(s => s.device);
  const setDevice = useStore(s => s.setDevice), note = useStore(s => s.note), set = useStore(s => s.set);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [reacting, setReacting] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
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
    return () => box.removeEventListener('mouseover', over);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function react(id: number, emoji: string) {
    setDevice({ recent: useRecent(device.recent.length ? device.recent : DEFAULT_REACTIONS, emoji) });
    const r = await request('chat:react', { id, emoji });
    if (!r.ok) set({ note: r.error });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    suggestRef.current?.hide();
    await loadCodes();
    const r = await request('chat:send', { text: expandCodes(text, []), replyTo: replyTo?.id ?? null });
    if (!r.ok) { set({ note: r.error }); return; }
    setDraft(''); setReplyTo(null); set({ note: '' });
    inputRef.current?.focus();
  }

  function complete(code: string) {
    const input = inputRef.current!, at = input.selectionStart ?? draft.length;
    const before = draft.slice(0, at).replace(/:([a-z0-9_+-]*)$/, `:${code}: `);
    setDraft(before + draft.slice(at));
    suggestRef.current?.hide();
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(before.length, before.length); });
  }

  function onType(v: string) {
    setDraft(v);
    const m = v.slice(0, inputRef.current?.selectionStart ?? v.length).match(/(?:^|\s):([a-z0-9_+-]{2,})$/);
    if (m) { const items = suggest(m[1]!, []); if (items.length) { suggestRef.current?.show(items, inputRef.current!); return; } }
    suggestRef.current?.hide();
  }

  function onKey(e: React.KeyboardEvent) {
    const s = suggestRef.current;
    if (s?.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); s.move(e.key === 'ArrowDown' ? 1 : -1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const c = s.current(); if (c) complete(c.code); return; }
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
      <span className="reply-who">{who(q.from)}</span><Html className="reply-quote" html={quoteHtml(q)} /></button>;

  const textHtml = (m: MessageView) => {
    const html = linkify(m.text, t => withCustom(esc(t), []));
    const first = findLinks(m.text)[0], p = first ? previewOf(first.href) : null;
    return p ? html + previewHtml(p, m.id, playing === m.id) : html;
  };

  return <div className="chat-box" ref={boxRef}
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
      {room.chat.messages.map(m => m.from === null || m.kind === 'system'
        ? <li key={m.id} className="msg sys" data-msg={m.id}><Html html={withCustom(esc(m.text), [])} /></li>
        : <li key={m.id} className={`msg${m.reply ? ' is-reply' : ''}${reacting === m.id ? ' is-reacting' : ''}`} data-msg={m.id}>
          {m.reply && replyRef(m.reply)}
          <div className="msg-body">{who(m.from)} <Html html={textHtml(m)} /></div>
          <div className="react-bar" role="toolbar" aria-label="Réagir au message">
            {recent.map(e => <button key={e} type="button" onClick={() => void react(m.id, e)} title={`Réagir ${e}`} aria-label={`Réagir ${e}`}><Html html={emojiHtml(e, [])} /></button>)}
            <button type="button" className="react-more" title="Autre emoji" aria-label="Autre emoji" onClick={ev => {
              setReacting(m.id);
              void pop?.open(ev.currentTarget, e => void react(m.id, e), { onClose: () => setReacting(null) });
            }}><Icon name="plus" /></button>
            <button type="button" className="react-reply" title="Répondre" aria-label="Répondre" onClick={() => { setReplyTo(m); inputRef.current?.focus(); }}><Icon name="reply" /></button></div>
          {Object.keys(m.reactions).length > 0 && <div className="reactions">{Object.entries(m.reactions).map(([e, ids]) => {
            const names = ids.map(id => (id === account.id ? 'Toi' : members.get(id)?.name ?? '?')).join(', ');
            return <button key={e} className={`reaction ${ids.includes(account.id) ? 'mine' : ''}`} type="button" onClick={() => void react(m.id, e)} data-names={names}
              title={names} aria-pressed={ids.includes(account.id)} aria-label={`${e} : ${ids.length} réaction${ids.length > 1 ? 's' : ''}`}><Html html={emojiHtml(e, [])} />{ids.length > 1 && <b>{ids.length}</b>}</button>;
          })}</div>}
        </li>)}
    </ul>
    {note && <p className="chat-note">{note}</p>}
    {replyTo && <div className="reply-bar"><Icon name="reply" /><span className="reply-who">Réponse à {who(replyTo.from)}</span><Html className="reply-quote" html={quoteHtml(replyTo)} />
      <button className="icon-btn sm" type="button" onClick={() => setReplyTo(null)} title="Ne plus répondre" aria-label="Ne plus répondre"><Icon name="close" /></button></div>}
    <form className="chat-form" data-form="chat" onSubmit={send}>
      <input ref={inputRef} name="text" placeholder={replyTo ? 'Ta réponse…' : 'Écrire un message…'} autoComplete="off" maxLength={500} value={draft}
        onChange={e => onType(e.target.value)} onKeyDown={onKey} onBlur={() => suggestRef.current?.hide()} />
      <button className="icon-btn" title="Envoyer" aria-label="Envoyer"><Icon name="send" /></button>
      <div className="plus-wrap"><button className="icon-btn" type="button" title="Emoji" aria-label="Emoji"
        onClick={ev => void pop?.open(ev.currentTarget, e => { setDraft(d => d + e); inputRef.current?.focus(); }, { keepOpen: true })}><Icon name="smile" /></button></div>
    </form>
  </div>;
}

/** The players (Chat activity: the left drawer), the host first; the host can hand over the role. */
export function People({ onGiveHost }: { onGiveHost: (m: MemberView) => void }) {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const list = [...room.members].sort((a, b) => Number(b.id === room.hostId) - Number(a.id === room.hostId) || a.joinedAt - b.joinedAt);
  return <><ol className="people">{list.map(p => <li key={p.id} className={`person ${p.id === me ? 'is-me' : ''}`}>
    <span className={`avatar sm${p.photo ? ' has-photo' : ''}`} style={{ '--c': `hsl(${p.hue} 58% 50%)` } as React.CSSProperties}>{p.photo ? <img src={p.photo} alt="" /> : p.name.slice(0, 1).toUpperCase()}</span>
    <span className="person-name">{p.name}{p.id === me && <> <i>(toi)</i></>}<PresenceIcon m={p} host={p.id === room.hostId} /></span>
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
