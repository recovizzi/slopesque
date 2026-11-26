// The ranking (left drawer, in a game with points: the Demi-disque, the cards): the podium, then everyone with his
// score in this game (scoreKey); the host can hand over his role from it.
import type { CSSProperties } from 'react';
import { hueColor } from '@slopesque/engines';
import { scoreKey, type MemberView } from '@slopesque/shared';
import { useStore } from '../../app/store';
import { Avatar, Dot, Icon, IconButton } from '../../design';
import { PresenceIcon } from '../chat/Chat';

export function Ranking({ onGiveHost }: { onGiveHost: (m: MemberView) => void }) {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const key = scoreKey(room.activity) ?? 'disk',
    pts = (p: MemberView) => p.scores[key] ?? 0; // this game's ranking
  const ranked = [...room.members].sort((a, b) => pts(b) - pts(a));
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean) as MemberView[];
  return (
    <>
      <div className="podium">
        {podium.map(p => {
          const rank = ranked.indexOf(p) + 1;
          return (
            <div key={p.id} className={`step step-${rank}`}>
              <Avatar name={p.name} hue={p.hue} photo={p.photo} />
              <span className="step-name">{p.name}</span>
              <span className="step-score">{pts(p)}</span>
              <div className="step-block" style={{ '--c': hueColor(p.hue) } as CSSProperties}>
                {rank}
              </div>
            </div>
          );
        })}
      </div>
      <ol className="ranking">
        {ranked.map((p, i) => {
          const host = p.id === room.hostId;
          return (
            <li key={p.id} className={`rank-row ${p.id === me ? 'is-me' : ''}`}>
              <span className="rank-n">{i + 1}</span>
              <Dot color={hueColor(p.hue)} />
              <span className="rank-name">
                {p.name}
                <PresenceIcon m={p} host={host} />
                {host && (
                  <>
                    {' '}
                    <span className="crown" title="Hôte">
                      <Icon name="crown" />
                    </span>
                  </>
                )}
                {!p.playing && !host && (
                  <>
                    {' '}
                    <i>(spectateur)</i>
                  </>
                )}
              </span>
              <span className="rank-score">{pts(p)}</span>
              {room.hostId === me && p.id !== me && (
                <IconButton
                  icon="crown"
                  size="sm"
                  label="Donner le rôle d'hôte"
                  title={`Donner le rôle d'hôte à ${p.name}`}
                  onClick={() => onGiveHost(p)}
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
