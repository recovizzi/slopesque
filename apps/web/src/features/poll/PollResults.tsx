// A poll's results, in its format (openspec: poll-activity, Résultats): bars per choice (with their pictures), the
// free answers as cards (identical ones grouped, ×n), or the gradient's heatmap and each proposition's temperature.
// The number 1 crowned; a tie for it said (or broken by the host's answer). Not secret: hovering a result shows who
// gave it (data-names, read by the hover tip).
import type { CSSProperties } from 'react';
import type { PollAnswer, PollView } from '@slopesque/shared';
import { cls, Note } from '../../design';
import { ChoiceLabel, ChoicePic, Crown, type CustomEmoji } from './ChoiceParts';
import { Gradient, type Dot } from './Gradient';
import { answers as answersText, percent, picOf, tempColor, type Point } from './model';
import type { ShownPoll } from './PollAnswer';

export type Outcome = NonNullable<PollView['outcome']>;
export interface Who {
  name: (id: string) => string;
  color: (id: string) => string;
}
export interface PollResultsProps {
  poll: ShownPoll;
  answers: Record<string, PollAnswer>;
  outcome: Outcome;
  who: Who;
  secret: boolean;
  custom: CustomEmoji;
}

export function PollResults({ poll, answers, outcome, who, secret, custom }: PollResultsProps) {
  const total = Object.keys(answers).length;
  const names = (ids: string[]) => (secret || !ids.length ? undefined : ids.map(who.name).join(', '));
  const won = (key: string) => key === outcome.winner;
  let body;
  if (poll.kind === 'choices') {
    const anyPic = poll.choices.some((_, i) => picOf(poll, i)); // the labels stay aligned
    body = (
      <ol className="poll-bars">
        {outcome.ranked.map(r => {
          const pct = percent(r.value, total),
            pic = picOf(poll, +r.key);
          return (
            <li key={r.key} className={cls('bar-row', won(r.key) && 'win')} data-names={names(r.ids)}>
              <span className="bar-label">
                {pic ? (
                  <span className="bar-pic">
                    <ChoicePic pic={pic} />
                  </span>
                ) : (
                  anyPic && <span className="bar-pic empty" />
                )}
                {won(r.key) && <Crown />}
                <ChoiceLabel text={r.label} i={+r.key} custom={custom} />
              </span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="bar-count">{`${pct} % · ${r.value}`}</span>
            </li>
          );
        })}
      </ol>
    );
  } else if (poll.kind === 'free') {
    body = (
      <ul className="poll-cards">
        {outcome.ranked.map(r => (
          <li key={r.key} className={cls('answer-card', won(r.key) && 'win')} data-names={names(r.ids)}>
            {won(r.key) && <Crown />}
            {r.label}
            {r.value > 1 && (
              <span className="mult" title={`${r.value} joueurs`}>
                {`×${r.value}`}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  } else {
    const entries = Object.entries(answers) as [string, Point][];
    const dots: Dot[] = entries.map(([id, at]) => ({
      at,
      color: secret ? 'var(--muted)' : who.color(id),
      kind: 'player',
      names: secret ? undefined : who.name(id),
    }));
    const values = outcome.ranked.map(r => r.value);
    body = (
      <>
        <div className="poll-heat">
          <Gradient choices={poll.choices} dots={dots} heat={entries.map(([, p]) => p)} />
        </div>
        <ol className="poll-temps">
          {outcome.ranked.map(r => (
            <li key={r.key} className={cls('temp', won(r.key) && 'win')}>
              <span className="temp-badge" style={{ '--t': tempColor(r.value, values) } as CSSProperties}>
                {`${r.value}°`}
              </span>
              {won(r.key) && <Crown />}
              <span>{r.label}</span>
            </li>
          ))}
        </ol>
      </>
    );
  }
  return (
    <>
      <div className="poll-results">
        <Note>{answersText(total)}</Note>
        {body}
      </div>
      {outcome.hostEdge ? (
        <p className="host-edge">Avantage hôte</p>
      ) : (
        outcome.tie && <p className="host-edge">Égalité</p>
      )}
    </>
  );
}
