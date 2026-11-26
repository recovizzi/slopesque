// A vote in the chat (openspec: chat-activity, Votes dans le chat): what is proposed, the time left, the count, Oui
// (green) / Non (red) for the players connected at its start; over: its result.
import type { CSSProperties } from 'react';
import { needed, type Vote } from '@slopesque/engines';
import type { MemberView } from '@slopesque/shared';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, cls, Icon, Note, useNow, Who } from '../../design';
import { fmtLeft, voteCount } from './model';

const RESULT = {
  yes: 'Accepté',
  no: 'Refusé',
  cancelled: 'Annulé (le serveur a redémarré)',
} as const;

export function VoteCard({
  id,
  v,
  members,
  me,
}: {
  id: number;
  v: Vote;
  members: Map<string, MemberView>;
  me: string;
}) {
  const skew = useStore(s => s.clockSkew),
    set = useStore(s => s.set);
  const now = useNow(1000, !v.result);
  const need = needed(v),
    n = v.yes.length + v.no.length,
    mine = v.yes.includes(me) ? 'yes' : v.no.includes(me) ? 'no' : null;
  const by = members.get(v.by);
  const cast = async (yes: boolean) => {
    const r = await request('vote:cast', { id, yes });
    if (!r.ok) set({ note: r.error });
  };
  const share = (k: number) => ({ '--n': k / Math.max(1, v.voters.length) }) as CSSProperties;
  return (
    <li className={`msg vote ${v.result ? `is-over is-${v.result}` : 'is-open'}`} data-msg={id}>
      <div className="vote-card">
        <div className="vote-head">
          <Icon name="vote" />
          <span className="vote-q">
            {by ? <Who name={v.by === me ? 'Toi' : by.name} hue={by.hue} /> : '?'} {v.label}
          </span>
          {!v.result && (
            <span className="vote-left" title="Temps restant">
              {fmtLeft(v.ends - (now + skew))}
            </span>
          )}
        </div>
        <div className="vote-bar" aria-hidden="true">
          <span className="vb-yes" style={share(v.yes.length)} />
          <span className="vb-no" style={share(v.no.length)} />
        </div>
        <p className="vote-count">{voteCount(v.yes.length, v.no.length, need, v.voters.length)}</p>
        {v.result ? (
          <p className={cls('vote-result', v.result === 'yes' ? 'ok' : 'ko')}>
            {v.result === 'quorum' ? `Pas assez de votes : ${n} sur ${need}` : RESULT[v.result]}
          </p>
        ) : v.voters.includes(me) ? (
          <div className="vote-actions">
            <Button
              className={cls('vote-yes', mine === 'yes' && 'on')}
              aria-pressed={mine === 'yes'}
              onClick={() => void cast(true)}
            >
              Oui
            </Button>
            <Button
              className={cls('vote-no', mine === 'no' && 'on')}
              aria-pressed={mine === 'no'}
              onClick={() => void cast(false)}
            >
              Non
            </Button>
          </div>
        ) : (
          <Note>
            {v.target === me ? 'Ce vote te concerne : tu ne votes pas.' : 'Absent à son lancement : tu ne votes pas.'}
          </Note>
        )}
      </div>
    </li>
  );
}
