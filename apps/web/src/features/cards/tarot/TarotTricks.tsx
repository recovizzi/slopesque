// The tricks won at the Tarot: my pile at the bottom right of the table (a card-sized place printed on the felt, then
// the backs and their count; the gathered trick flies to it), and a player's tricks shown over the darkened table
// while his pill or my pile is hovered, each trick as a small fan, in a grid that fits the table.
import type { CSSProperties } from 'react';
import { Tarot as TA } from '@slopesque/engines';
import { cls } from '../../../design';
import { CardBack } from '../PlayingCard';
import { TarotCard } from './TarotCard';

export function MyPile({ count, me, look }: { count: number; me: string; look: boolean }) {
  return (
    <div
      className={cls('won-pile', !count && 'is-empty')}
      data-won={count && look ? me : undefined}
      title={
        count
          ? look
            ? 'Survoler pour voir tes plis'
            : "Plis cachés : l'hôte a désactivé leur consultation"
          : 'Tes plis gagnés viendront ici'
      }
    >
      {count > 0 && (
        <>
          {Array.from({ length: Math.min(3, count) }, (_, k) => (
            <span key={k} className="won-card" style={{ '--k': k } as CSSProperties}>
              <CardBack />
            </span>
          ))}
          <b className="won-n">{count}</b>
        </>
      )}
    </div>
  );
}

export function TricksView({ tricks, name }: { tricks: TA.TPlay[][]; name: string }) {
  return (
    <div className="tricks-view">
      <p className="tv-head">{`Plis gagnés par ${name} · ${tricks.length}`}</p>
      <div className="tv-grid">
        {tricks.map(plays => (
          <div key={plays[0]!.card.id} className="tv-trick" style={{ '--m': (plays.length - 1) / 2 } as CSSProperties}>
            {plays.map((p, k) => (
              <span key={p.card.id} className="tv-card" style={{ '--k': k } as CSSProperties}>
                <TarotCard card={p.card} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
