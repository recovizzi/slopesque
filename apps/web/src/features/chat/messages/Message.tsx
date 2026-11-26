// A player's message: the quote it answers, who and what (its text with links and the room's emoji, a picture and its
// text, a link's preview), the reaction bar that shows under its text while hovered, the reactions given. A double
// click reacts with my quick reaction.
import { useRef, useState, type MouseEvent } from 'react';
import type { MemberView, MessageView } from '@slopesque/shared';
import { toggleGifFavorite } from '../../../app/net';
import { cls, RichText } from '../../../design';
import type { CustomEmoji } from '../../../lib/emoji';
import { LinkPreview } from './LinkPreview';
import { MediaBox } from './MediaBox';
import { ReactBar, Reactions } from './Reactions';
import { Author, ReplyRef, type ReplyRefProps } from './Reply';

export interface MessageProps {
  m: MessageView;
  members: Map<string, MemberView>;
  me: string;
  custom: CustomEmoji[];
  /** My recent reactions (the bar), and my double-click one. */
  recent: string[];
  quick: string;
  /** Its GIF is one of my favourites. */
  favorite: boolean;
  /** The picker is open for it: its bar stays. */
  reacting: boolean;
  /** Its link's video plays. */
  playing: boolean;
  onPlay: () => void;
  onReact: (emoji: string) => void;
  onMore: (anchor: Element) => void;
  onReply: () => void;
  onJump: ReplyRefProps['onJump'];
  onQuote: ReplyRefProps['onHover'];
}

export function Message(p: MessageProps) {
  const { m } = p;
  const li = useRef<HTMLLIElement>(null),
    bar = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<number | null>(null);

  /** The bar goes under the text where the pointer came in (not when it comes back from the bar). */
  function place(e: MouseEvent) {
    const from = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (p.reacting || !li.current || !bar.current || (from && bar.current.contains(from))) return;
    const r = li.current.getBoundingClientRect(),
      w = bar.current.offsetWidth;
    setLeft(Math.round(Math.max(0, Math.min(r.width - w, e.clientX - r.left - w / 2))));
  }

  const text = (
    <>
      <RichText text={m.text} custom={p.custom} />
      {m.preview && <LinkPreview p={m.preview} playing={p.playing} onPlay={p.onPlay} />}
    </>
  );
  return (
    <li
      ref={li}
      className={cls('msg', m.media && 'has-media', m.reply && 'is-reply', p.reacting && 'is-reacting')}
      data-msg={m.id}
    >
      {m.reply && (
        <ReplyRef q={m.reply} members={p.members} me={p.me} custom={p.custom} onJump={p.onJump} onHover={p.onQuote} />
      )}
      <div
        className="msg-body"
        onMouseEnter={place}
        onDoubleClick={e => {
          if (!(e.target as Element).closest('a, button, input')) p.onReact(p.quick);
        }}
        onMouseDown={e => {
          if (e.detail > 1) e.preventDefault(); // a double click reacts: it doesn't select the text
        }}
      >
        <Author id={m.from} members={p.members} me={p.me} />{' '}
        {m.media ? (
          <>
            <MediaBox m={m.media} favorite={p.favorite} onStar={toggleGifFavorite} />
            {m.text && <span className="msg-caption">{text}</span>}
          </>
        ) : (
          <span>{text}</span>
        )}
      </div>
      <ReactBar
        ref={bar}
        recent={p.recent}
        custom={p.custom}
        left={left}
        onReact={p.onReact}
        onMore={p.onMore}
        onReply={p.onReply}
      />
      <Reactions reactions={m.reactions} members={p.members} me={p.me} custom={p.custom} onReact={p.onReact} />
    </li>
  );
}
