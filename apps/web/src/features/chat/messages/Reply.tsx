// Replies (openspec: chat-activity, Réponses): above a reply, the quote of the message it answers (one line, cut by
// CSS; a click goes to it, hovering shows it whole in a bubble above it), or « supprimé » past 30 days.
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MemberView, Quote } from '@slopesque/shared';
import { useStore } from '../../../app/store';
import { Icon, RichText, Who } from '../../../design';
import { bubbleAt } from '../../../lib/floating';
import type { CustomEmoji } from '../../../lib/emoji';
import { fullQuoteParts, quoteParts, type QuotePart } from '../model';

/** A quote's pieces: the player's text with the room's emoji (no link: it is one line), what a picture was. */
export function QuoteText({ parts, custom }: { parts: QuotePart[]; custom: CustomEmoji[] }) {
  return parts.map((p, i) =>
    p.kind === 'em' ? (
      <i key={i}>{p.text}</i>
    ) : p.kind === 'text' ? (
      <RichText key={i} text={p.text} custom={custom} links={false} />
    ) : (
      p.text
    ),
  );
}

/** Who wrote it, in their colour (« Toi » for me), or nothing (the room). */
export function Author({ id, members, me }: { id: string | null; members: Map<string, MemberView>; me: string }) {
  const m = id ? members.get(id) : null;
  return m ? <Who name={id === me ? 'Toi' : m.name} hue={m.hue} /> : null;
}

export interface ReplyRefProps {
  q: Quote;
  members: Map<string, MemberView>;
  me: string;
  custom: CustomEmoji[];
  onJump: (id: number) => void;
  /** Hovered (the quote's place on the screen), or left (null). */
  onHover: (h: { id: number; at: DOMRect } | null) => void;
}

export function ReplyRef({ q, members, me, custom, onJump, onHover }: ReplyRefProps) {
  if (q.gone)
    return (
      <span className="reply-ref is-gone">
        <Icon name="replied" />
        <span className="reply-quote">
          <i>Message de plus de 30 jours, supprimé</i>
        </span>
      </span>
    );
  return (
    <button
      type="button"
      className="reply-ref"
      data-msg={q.id}
      onClick={() => onJump(q.id)}
      title="Aller au message cité"
      onPointerEnter={e => onHover({ id: q.id, at: e.currentTarget.getBoundingClientRect() })}
      onPointerLeave={() => onHover(null)}
    >
      <Icon name="replied" />
      <span className="reply-who">
        <Author id={q.from} members={members} me={me} />
      </span>
      <span className="reply-quote">
        <QuoteText parts={quoteParts(q)} custom={custom} />
      </span>
    </button>
  );
}

/** The message quoted, whole (or what the reply kept of it), in a bubble above its quote. */
export function QuotePop({ id, at, custom }: { id: number; at: DOMRect; custom: CustomEmoji[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const room = useStore(s => s.room),
    me = useStore(s => s.account?.id ?? '');
  useLayoutEffect(() => {
    const el = ref.current!,
      p = bubbleAt(at, { width: el.offsetWidth, height: el.offsetHeight }, innerWidth, false);
    Object.assign(el.style, { left: `${p.left}px`, top: `${p.top}px` });
  });
  const list = room?.chat.messages ?? [],
    m = list.find(x => x.id === id);
  const q = m ?? list.find(x => x.reply?.id === id)?.reply;
  const members = new Map((room?.members ?? []).map(x => [x.id, x]));
  let body;
  if (!q || ('gone' in q && q.gone)) body = <i>Ce message n'existe plus.</i>;
  else {
    const media = m?.media,
      who = q.from && members.has(q.from) ? <Author id={q.from} members={members} me={me} /> : null;
    body = (
      <>
        {who && <>{who} </>}
        {!media ? (
          <QuoteText parts={fullQuoteParts(q)} custom={custom} />
        ) : media.src ? (
          <img src={media.src} width={media.w} height={media.h} alt="" />
        ) : media.kind === 'sticker' ? (
          <i>Sticker plus disponible</i>
        ) : (
          <>
            📷 <i>Image expirée</i>
          </>
        )}
      </>
    );
  }
  return createPortal(
    <div ref={ref} className="quote-pop">
      <div className="msg-body">{body}</div>
    </div>,
    document.body,
  );
}
