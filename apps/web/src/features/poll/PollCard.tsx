// A poll continued in the chat (openspec: poll-activity, Sondage continué dans le chat): the activity changed while
// it was open, it goes on in a message — its question, its time left, who answered; answered there (a choice, a text,
// a point of the gradient, with the Sondage's own views); closed, its results in the same message.
import { useState } from 'react';
import { hueColor, Poll } from '@slopesque/engines';
import type { ChatPollView, MemberView, PollAnswer as Answer } from '@slopesque/shared';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Icon, Note, useNow } from '../../design';
import { answers, fmtLeftShort } from './model';
import { PollAnswer } from './PollAnswer';
import { PollResults } from './PollResults';

export function PollCard({
  id,
  cp,
  members,
  me,
}: {
  id: number;
  cp: ChatPollView;
  members: Map<string, MemberView>;
  me: string;
}) {
  const room = useStore(s => s.room)!;
  const [pick, setPick] = useState<Answer | null>(null),
    [free, setFree] = useState(''),
    [note, setNote] = useState('');
  const host = cp.host ? members.get(cp.host) : undefined,
    answered = cp.answered.includes(me);
  const n = cp.closed && cp.answers ? Object.keys(cp.answers).length : cp.answered.length;
  const answer = cp.poll.kind === 'free' ? free.trim() : pick;
  const send = async () => {
    if (answer === null || answer === '') return;
    const r = await request('poll:chat-answer', { id, answer });
    setNote(r.ok ? '' : r.error);
  };
  const end = async () => {
    const r = await request('poll:chat-end', { id });
    setNote(r.ok ? '' : r.error);
  };

  let body;
  if (cp.closed && cp.outcome) {
    const name = (x: string) => (x === me ? 'Toi' : (members.get(x)?.name ?? '?')),
      color = (x: string) => hueColor(members.get(x)?.hue ?? 0);
    body = (
      <PollResults
        poll={cp.poll}
        answers={cp.answers ?? {}}
        outcome={cp.outcome}
        who={{ name, color }}
        secret={cp.secret}
        custom={room.emoji}
      />
    );
  } else if (answered) body = <p className="chat-poll-done">Réponse envoyée ✓ — les résultats s'afficheront ici.</p>;
  else
    body = (
      <PollAnswer
        poll={cp.poll}
        pick={pick}
        free={free}
        can
        color={hueColor(members.get(me)?.hue ?? 222)}
        custom={room.emoji}
        onPick={setPick}
        onFree={setFree}
        onSubmit={() => void send()}
      />
    );

  const by = host ? `, de ${host.id === me ? 'toi' : host.name}` : '';
  return (
    <li className={`msg vote chat-poll ${cp.closed ? 'is-over' : 'is-open'}`} data-msg={id}>
      <div className="vote-card">
        <div className="vote-head">
          <Icon name="vote" />
          <span className="vote-q">
            <b>{`Sondage ${cp.round}`}</b>
            {` · ${cp.poll.question}`}
            <small>{` — ${Poll.POLL_KINDS[cp.poll.kind].name}${by}`}</small>
          </span>
          {!cp.closed && <TimeLeft deadline={cp.deadline} />}
        </div>
        <div className="chat-poll-body">
          <div className="poll-box">{body}</div>
        </div>
        <p className="vote-count">
          {cp.closed
            ? `Terminé · ${answers(n)}${cp.secret ? ' · résultats secrets' : ''}`
            : `${answers(n)} · continue dans le chat depuis un changement d'activité`}
        </p>
        {!cp.closed && (
          <div className="vote-actions">
            {!answered && (
              <Button disabled={answer === null || answer === ''} onClick={() => void send()}>
                Valider ma réponse
              </Button>
            )}
            {(me === cp.host || me === room.hostId) && (
              <Button variant="ghost" onClick={() => void end()}>
                Terminer le sondage
              </Button>
            )}
          </div>
        )}
        {note && <Note>{note}</Note>}
      </div>
    </li>
  );
}

/** The poll's time left, refreshed every second (only this line is drawn again). */
function TimeLeft({ deadline }: { deadline: number }) {
  const skew = useStore(s => s.clockSkew),
    now = useNow(1000);
  return (
    <span className="vote-left" title="Temps restant">
      {fmtLeftShort(deadline - (now + skew))}
    </span>
  );
}
