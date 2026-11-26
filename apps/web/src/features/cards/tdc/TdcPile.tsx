// The middle of the Trou du cul's table: the last plays, each slightly turned, the last on top (the trick just taken
// stays, dimmed, until the next play) — a play keeps its place in the page: the one below slides back — then the
// round's results: each player's role and points (a robot's seat: none), and the next round.
import type { CSSProperties } from 'react';
import { Tdc as T } from '@slopesque/engines';
import { Button, cls, Dot, Note } from '../../../design';
import type { WhoOf } from '../model';
import { RoleBadge, SeatLabel } from '../SeatPill';
import { shownPlays, tilt } from './model';
import { TdcCard } from './TdcCard';

const { ROLES } = T;

export function TdcPlays({ t }: { t: T.Tdc }) {
  const { closed, plays } = shownPlays(t);
  return plays.map((p, k) => (
    <div
      key={p.cards[0]!.id}
      className={cls('play', k === plays.length - 1 && 'is-last', closed && 'is-closed')}
      style={{ '--t': `${tilt(p.cards)}deg` } as CSSProperties}
    >
      {p.cards.map(cd => (
        <span key={cd.id} className="pcard on-table" data-card={cd.id}>
          <TdcCard card={cd} />
        </span>
      ))}
    </div>
  ));
}

export function TdcResults({ t, host, paid, onDeal }: { t: T.Tdc; host: boolean; paid: WhoOf; onDeal: () => void }) {
  return (
    <div className="cg-results">
      <h3>{`Manche ${t.round}`}</h3>
      <ol>
        {t.out.map(id => {
          const r = t.roles[id]!,
            p = paid(id);
          return (
            <li key={id} className={p.bot ? 'is-bot' : undefined} style={{ '--c': p.color } as CSSProperties}>
              <Dot color={p.color} />
              <SeatLabel p={p} className="res-name" />
              <RoleBadge role={r}>{ROLES[r].name}</RoleBadge>
              <span className="pts" title={p.bot ? 'Un robot : pas de points' : undefined}>
                {p.bot ? '—' : `+${ROLES[r].points}`}
              </span>
            </li>
          );
        })}
      </ol>
      {host ? (
        <Button data-action="cards-deal" onClick={onDeal}>
          Nouvelle manche
        </Button>
      ) : (
        <Note>L'hôte lance la manche suivante.</Note>
      )}
    </div>
  );
}
