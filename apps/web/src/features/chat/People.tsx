// The players (the left drawer of the activities without points and of the Chat activity), the host first: their
// photo, presence, social credit (in the Chat activity) and role; the host can hand over the role.
import { useEffect, useState } from 'react';
import type { MemberView } from '@slopesque/shared';
import { useStore } from '../../app/store';
import { Avatar, cls, Icon, IconButton, Note } from '../../design';
import { CreditBadge } from '../credit/Credit';

export function People({ onGiveHost }: { onGiveHost: (m: MemberView) => void }) {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const list = [...room.members].sort(
    (a, b) => Number(b.id === room.hostId) - Number(a.id === room.hostId) || a.joinedAt - b.joinedAt,
  );
  return (
    <>
      <ol className="people">
        {list.map(p => (
          <li key={p.id} className={cls('person', p.id === me && 'is-me')}>
            <Avatar name={p.name} hue={p.hue} photo={p.photo} />
            <span className="person-name">
              {p.name}
              {p.id === me && (
                <>
                  {' '}
                  <i>(toi)</i>
                </>
              )}
              <PresenceIcon m={p} host={p.id === room.hostId} />
            </span>
            {room.activity.activity === 'chat' && <CreditBadge v={p.credit} />}
            <span className="role">
              {p.id === room.hostId ? (
                <>
                  <span className="crown">
                    <Icon name="crown" />
                  </span>
                  hôte
                </>
              ) : p.playing ? (
                'joueur'
              ) : (
                'membre'
              )}
            </span>
            {room.hostId === me && p.id !== me && (
              <IconButton
                icon="crown"
                label="Donner le rôle d'hôte"
                title={`Donner le rôle d'hôte à ${p.name}`}
                size="sm"
                onClick={() => onGiveHost(p)}
              />
            )}
          </li>
        ))}
      </ol>
      <Note className="people-note">
        Pas de classement dans cette activité : les scores sont gardés tels quels jusqu'à une réinitialisation de la
        partie (onglet Partie).
      </Note>
    </>
  );
}

/** Away (the window or the extension closed): a moon, with the minutes; 5 min or more, the moon and its z. */
export function PresenceIcon({ m, host }: { m: MemberView; host: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (m.presence === 'here') return;
    const t = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, [m.presence]);
  if (m.presence === 'here' || m.awaySince === null) return null;
  const mins = Math.max(1, Math.floor((Date.now() - m.awaySince) / 60_000)),
    gone = mins >= 5;
  return (
    <>
      {' '}
      <span
        className={`presence ${gone ? 'gone' : 'away'}`}
        title={`Absence : ${mins} min${gone && host ? " · /hote donne le rôle d'hôte sans vote" : ''}`}
      >
        <Icon name={gone ? 'gone' : 'away'} />
      </span>
    </>
  );
}
