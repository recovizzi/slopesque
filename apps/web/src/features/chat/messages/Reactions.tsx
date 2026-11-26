// Reactions (openspec: chat-activity, Réactions): the bar under a hovered message — my 4 last reactions, « + » for the
// picker, « Répondre » — and the reactions given, each with its count and who (hovered: the names, hover.ts).
import type { CSSProperties, Ref } from 'react';
import type { MemberView } from '@slopesque/shared';
import { cls, Icon, RichText } from '../../../design';
import type { CustomEmoji } from '../../../lib/emoji';
import { reactionLabel, reactionNames } from '../model';

/** An emoji of a reaction: unicode, or `:name:` of the room's custom emoji (its picture). */
const Emoji = ({ e, custom }: { e: string; custom: CustomEmoji[] }) => (
  <span>
    <RichText text={e} custom={custom} links={false} />
  </span>
);

interface BarProps {
  recent: string[];
  custom: CustomEmoji[];
  /** Where it floats under the message (from the pointer, Message.tsx). */
  left: number | null;
  onReact: (e: string) => void;
  onMore: (anchor: Element) => void;
  onReply: () => void;
  ref?: Ref<HTMLDivElement>;
}

export function ReactBar({ recent, custom, left, onReact, onMore, onReply, ref }: BarProps) {
  return (
    <div
      ref={ref}
      className="react-bar"
      role="toolbar"
      aria-label="Réagir au message"
      style={left === null ? undefined : ({ left } as CSSProperties)}
    >
      {recent.map(e => (
        <button key={e} type="button" onClick={() => onReact(e)} title={`Réagir ${e}`} aria-label={`Réagir ${e}`}>
          <Emoji e={e} custom={custom} />
        </button>
      ))}
      <button
        type="button"
        className="react-more"
        title="Autre emoji"
        aria-label="Autre emoji"
        onClick={ev => onMore(ev.currentTarget)}
      >
        <Icon name="plus" />
      </button>
      <button type="button" className="react-reply" title="Répondre" aria-label="Répondre" onClick={onReply}>
        <Icon name="reply" />
      </button>
    </div>
  );
}

export function Reactions(p: {
  reactions: Record<string, string[]>;
  members: Map<string, MemberView>;
  me: string;
  custom: CustomEmoji[];
  onReact: (e: string) => void;
}) {
  const list = Object.entries(p.reactions);
  if (!list.length) return null;
  return (
    <div className="reactions">
      {list.map(([e, ids]) => {
        const mine = ids.includes(p.me);
        return (
          <button
            key={e}
            className={cls('reaction', mine && 'mine')}
            type="button"
            onClick={() => p.onReact(e)}
            data-names={reactionNames(ids, p.members, p.me)}
            aria-pressed={mine}
            aria-label={reactionLabel(e, ids.length)}
          >
            <Emoji e={e} custom={p.custom} />
            {ids.length > 1 && <b>{ids.length}</b>}
          </button>
        );
      })}
    </div>
  );
}
