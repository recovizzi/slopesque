// The Sondage on the stage (openspec: poll-activity): the host writes the poll, the candidates answer it within the
// answer time (the host may too: their answer breaks a tie for number 1), then everyone sees the results. The server
// keeps the answers (hidden while open) and closes the poll; the panel shows and sends intents.
import { useEffect, useState, type DragEvent } from 'react';
import { Poll, hueColor } from '@slopesque/engines';
import type { MemberView, PollAnswer as Answer, PollView } from '@slopesque/shared';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Note, Timer, useNow } from '../../design';
import type { EmojiPop } from '../../lib/emoji';
import { emptyDraft, fmtLeft, publishBody } from './model';
import { PollActions, type Role } from './PollActions';
import { PollAnswer } from './PollAnswer';
import { PollCompose } from './PollCompose';
import { PollResults } from './PollResults';

export function PollStage({ pop }: { pop: EmojiPop | null }) {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const pv = room.poll,
    members = new Map(room.members.map(m => [m.id, m]));
  const host = room.hostId ? members.get(room.hostId) : undefined;
  const role: Role = room.hostId === me ? 'host' : members.get(me)?.playing ? 'candidate' : 'spectator';
  const [draft, setDraft] = useState(() => emptyDraft()),
    [note, setNote] = useState('');
  const [pick, setPick] = useState<Answer | null>(null),
    [free, setFree] = useState('');
  useEffect(() => {
    setPick(null);
    setFree('');
  }, [pv.phase, pv.round]);

  const say = (r: { ok: true } | { ok: false; error: string }) => setNote(r.ok ? '' : r.error);
  const answer = pv.poll?.kind === 'free' ? free.trim() : pick;
  const validate = async () => {
    if (answer !== null && answer !== '') say(await request('poll:answer', { answer }));
  };

  let view = null;
  if (pv.phase === 'writing')
    view =
      role === 'host' ? (
        <PollCompose draft={draft} onDraft={setDraft} note={note} onNote={setNote} pop={pop} />
      ) : (
        <p className="poll-wait">Le sondage arrive…</p>
      );
  else if (pv.poll && pv.phase === 'open')
    view = (
      <PollAnswer
        poll={pv.poll}
        mine={pv.mine ?? undefined}
        pick={pick}
        free={free}
        can={role !== 'spectator' && pv.mine === null}
        color={hueColor(members.get(me)?.hue ?? 222)}
        custom={room.emoji}
        onPick={setPick}
        onFree={setFree}
        onSubmit={() => void validate()}
      />
    );
  else if (pv.poll && pv.outcome) {
    const name = (id: string) => (id === me ? 'Toi' : (members.get(id)?.name ?? '?')),
      color = (id: string) => hueColor(members.get(id)?.hue ?? 0);
    view = (
      <PollResults
        poll={pv.poll}
        answers={pv.answers ?? {}}
        outcome={pv.outcome}
        who={{ name, color }}
        secret={pv.secret}
        custom={room.emoji}
      />
    );
  }

  // a file dropped outside a choice's row is refused (the browser would open it in the panel)
  const refuse = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
  };
  return (
    <div className="stage-grid">
      <PollHead pv={pv} host={host} />
      <div className="disk-area" onDragOver={refuse} onDrop={e => e.preventDefault()}>
        <div className="poll-box">{view}</div>
      </div>
      <div className="stage-actions">
        <PollActions
          pv={pv}
          role={role}
          host={host}
          players={room.members.filter(p => p.playing && p.id !== room.hostId)}
          canPublish={Poll.ready(draft)}
          canValidate={answer !== null && answer !== ''}
          onPublish={async () => say(await request('poll:publish', publishBody(draft)))}
          onValidate={validate}
          onNext={() => {
            setDraft(emptyDraft(draft.kind));
            void request('poll:next');
          }}
        />
        {note && pv.phase !== 'writing' && <Note tone="alert">{note}</Note>}
      </div>
    </div>
  );
}

/** The question (« Sondage » while it is written), its kind and host, and the answer time left while it is open. */
function PollHead({ pv, host }: { pv: PollView; host: MemberView | undefined }) {
  const skew = useStore(s => s.clockSkew),
    deadline = pv.phase === 'open' ? pv.deadline : null;
  const now = useNow(500, !!deadline);
  const shown = pv.phase !== 'writing' ? pv.poll : null;
  const left = deadline ? Math.max(0, deadline - (now + skew)) : 0;
  return (
    <div className="stage-head">
      <div>
        <h1 className="topic">{shown ? shown.question : 'Sondage'}</h1>
        <p className="sub">
          {`Sondage ${pv.round}${shown ? ` · ${Poll.POLL_KINDS[shown.kind].name}` : ''} · hôte ${host?.name ?? '—'}`}
        </p>
      </div>
      {deadline && (
        <Timer ratio={left / (pv.seconds * 1000)} urgent={left < 10_000}>
          {fmtLeft(left)}
        </Timer>
      )}
    </div>
  );
}
