// What a respondent sees while the poll is open, on the stage or in a poll continued in the chat: the choices (with
// their pictures), a field for a free answer, or the gradient to place a point on. Editable until validated (`can`);
// then my answer, as sent.
import type { PollAnswer as Answer, PollView } from '@slopesque/shared';
import { cls, TextInput } from '../../design';
import { ChoiceLabel, ChoicePic, type CustomEmoji } from './ChoiceParts';
import { Gradient, type Dot } from './Gradient';
import { picOf, type Point } from './model';

export type ShownPoll = NonNullable<PollView['poll']>;

export interface PollAnswerProps {
  poll: ShownPoll;
  /** My answer, once sent. */
  mine?: Answer;
  /** What I picked, not sent yet. */
  pick: Answer | null;
  free: string;
  can: boolean;
  /** My colour (my point on the gradient). */
  color: string;
  custom: CustomEmoji;
  onPick: (a: Answer) => void;
  onFree: (text: string) => void;
  /** Enter in the free answer's field. */
  onSubmit: () => void;
}

export function PollAnswer({ poll, mine, pick, free, can, color, custom, onPick, onFree, onSubmit }: PollAnswerProps) {
  const sel = mine ?? pick;
  if (poll.kind === 'choices')
    return (
      <div className="poll-options">
        {poll.choices.map((c, i) => {
          const pic = picOf(poll, i);
          return (
            <button
              key={i}
              type="button"
              className={cls('poll-option', sel === i && 'on', pic && 'has-pic')}
              disabled={!can}
              onClick={() => onPick(i)}
            >
              {pic && (
                <span className="option-pic">
                  <ChoicePic pic={pic} />
                </span>
              )}
              <span className="option-text">
                <span className="radio" />
                <span>
                  <ChoiceLabel text={c} i={i} custom={custom} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  if (poll.kind === 'free') {
    if (can)
      return (
        <TextInput
          className="poll-free"
          data-poll="free"
          value={free}
          maxLength={60}
          placeholder="Ta réponse"
          autoComplete="off"
          onChange={e => onFree(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            onSubmit();
          }}
        />
      );
    return mine !== undefined ? (
      <p className="poll-mine">{`Ta réponse : « ${mine as string} »`}</p>
    ) : (
      <p className="hint">Chacun écrit sa réponse.</p>
    );
  }
  const dots: Dot[] = sel != null ? [{ at: sel as Point, color, kind: mine !== undefined ? 'mine' : 'pending' }] : [];
  return <Gradient choices={poll.choices} dots={dots} onPick={can ? onPick : undefined} />;
}
