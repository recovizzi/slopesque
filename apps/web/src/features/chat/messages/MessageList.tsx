// The chat's lines (openspec: chat-activity, data-retention): from the start of what is kept (30 days) or a button for
// the older ones, then each line — a player's message, a line of the room, a vote, a poll continued here, a change of
// social credit — and the button back to the bottom. Hovering a reply's quote shows it whole; a click goes to it.
import { useRef, useState } from 'react';
import type { ChatPollView, MessageView } from '@slopesque/shared';
import type { Vote } from '@slopesque/engines';
import { useStore } from '../../../app/store';
import { Button, Icon, RichText } from '../../../design';
import { DEFAULT_REACTIONS, THUMBS_UP, type CustomEmoji } from '../../../lib/emoji';
import { CreditCard } from '../../credit/Credit';
import { PollCard } from '../../poll/PollCard';
import { VoteCard } from '../../vote/Vote';
import { react } from '../actions';
import { EmojiPicker } from '../emoji/EmojiPicker';
import { inScope, lineKind, unreadCount, unreadTitle } from '../model';
import { Message } from './Message';
import { QuotePop } from './Reply';
import { useChatScroll } from './useChatScroll';

const NONE: never[] = [];

export function MessageList({ custom, onReply }: { custom: CustomEmoji[]; onReply: (m: MessageView) => void }) {
  const room = useStore(s => s.room)!,
    account = useStore(s => s.account)!,
    recentUsed = useStore(s => s.device.recent);
  const favorites = account.gifFavorites ?? NONE;
  const listRef = useRef<HTMLUListElement>(null);
  const scroll = useChatScroll(listRef);
  const [playing, setPlaying] = useState<number | null>(null); // the message whose link's video plays
  const [reacting, setReacting] = useState<{ id: number; anchor: Element } | null>(null); // the picker, for a message
  const [quote, setQuote] = useState<{ id: number; at: DOMRect } | null>(null);
  const members = new Map(room.members.map(m => [m.id, m])),
    me = account.id;
  const recent = recentUsed.length ? recentUsed : DEFAULT_REACTIONS;

  /** To a message quoted: in the middle of the list, flashed. */
  function jump(id: number) {
    const el = listRef.current?.querySelector<HTMLElement>(`:scope > [data-msg="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('is-flash');
    void el.offsetWidth; // the animation again
    el.classList.add('is-flash');
  }

  function line(m: MessageView) {
    switch (lineKind(m)) {
      case 'vote':
        return <VoteCard key={m.id} id={m.id} v={m.data!.vote as Vote} members={members} me={me} />;
      case 'poll':
        return <PollCard key={m.id} id={m.id} cp={m.data!.chatPoll as ChatPollView} members={members} me={me} />;
      case 'credit':
        return (
          <li key={m.id} className="msg credit" data-msg={m.id}>
            <CreditCard data={m.data as { by: string; to: string; delta: number }} members={members} me={me} />
          </li>
        );
      case 'system':
        return (
          <li key={m.id} className="msg sys" data-msg={m.id}>
            <span>
              <RichText text={m.text} custom={custom} links={false} />
            </span>
          </li>
        );
      default:
        return (
          <Message
            key={m.id}
            m={m}
            members={members}
            me={me}
            custom={custom}
            recent={recent}
            quick={account.quick || THUMBS_UP}
            favorite={!!m.media?.gif && favorites.some(f => f.id === m.media!.gif!.id)}
            reacting={reacting?.id === m.id}
            playing={playing === m.id}
            onPlay={() => setPlaying(m.id)}
            onReact={e => void react(m.id, e)}
            onMore={anchor => setReacting({ id: m.id, anchor })}
            onReply={() => onReply(m)}
            onJump={jump}
            onQuote={setQuote}
          />
        );
    }
  }

  return (
    <>
      <ul className="chat" ref={listRef} data-chat onScroll={scroll.onScroll} onWheel={scroll.onWheel}>
        {scroll.hasMore ? (
          <li className="msg sys chat-start">
            {scroll.loadingMore ? (
              'Chargement…'
            ) : (
              <Button variant="ghost" size="sm" onClick={() => void scroll.more()}>
                Messages plus anciens
              </Button>
            )}
          </li>
        ) : (
          scroll.start && (
            <li className="msg sys chat-start">
              {scroll.start === 'begin'
                ? 'Début de la conversation'
                : 'Les messages de plus de 30 jours ont été supprimés'}
            </li>
          )
        )}
        {room.chat.messages.filter(m => inScope(m, room.scope)).map(line)}
      </ul>
      {scroll.away && (
        <div className="to-bottom-anchor">
          <button
            className={`to-bottom ${scroll.unread ? 'has-new' : ''}`}
            type="button"
            onClick={() => scroll.toBottom(true)}
            title={unreadTitle(scroll.unread)}
            aria-label="Revenir en bas du chat"
          >
            <Icon name="down" />
            {scroll.unread > 0 && <b>{unreadCount(scroll.unread)}</b>}
          </button>
        </div>
      )}
      {reacting && (
        <EmojiPicker
          anchor={reacting.anchor}
          onPick={e => void react(reacting.id, e)}
          onClose={() => setReacting(null)}
        />
      )}
      {quote && <QuotePop id={quote.id} at={quote.at} custom={custom} />}
    </>
  );
}
