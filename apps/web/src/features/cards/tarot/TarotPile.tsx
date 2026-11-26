// The middle of the Tarot's table: the chien shown, the trick (each card above its player's name; the trick just
// taken stays until it goes to its winner), or the deal's count — each player's mark, the next deal.
import { Tarot as TA } from '@slopesque/engines';
import { Button, Dot, Note } from '../../../design';
import type { WhoOf } from '../model';
import { RoleBadge } from '../SeatPill';
import { closedTrick, resultLine, resultTitle } from './model';
import { TarotCard } from './TarotCard';

type Tarot = TA.Tarot;

export interface TarotPileProps {
  t: Tarot;
  host: boolean;
  who: WhoOf;
  name: (seat: string) => string;
  showLast: boolean;
  onDeal: () => void;
}

export function TarotPile({ t, host, who, name, showLast, onDeal }: TarotPileProps) {
  if (t.phase === 'dog')
    return (
      <div className="tarot-trick dog">
        {t.chien.map(cd => (
          <span key={cd.id} className="pcard on-table" data-card={cd.id}>
            <TarotCard card={cd} />
          </span>
        ))}
      </div>
    );
  if (t.phase === 'play')
    return (
      <div className="tarot-trick">
        {(closedTrick(t, showLast) ? t.lastTrick : t.trick).map(p => (
          <span key={p.card.id} className="trick-card">
            <span className="pcard on-table" data-card={p.card.id}>
              <TarotCard card={p.card} />
            </span>
            <small>{name(p.by)}</small>
          </span>
        ))}
      </div>
    );
  if (t.phase !== 'done') return null;
  const deal = host && (
    <Button data-action="cards-deal" onClick={onDeal}>
      Donne suivante
    </Button>
  );
  if (!t.result)
    return (
      <div className="cg-results">
        <h3>{t.note}</h3>
        {deal}
      </div>
    );
  const r = t.result;
  return (
    <div className="cg-results tarot-results">
      <h3>{resultTitle(t, name)}</h3>
      <Note>{resultLine(t)}</Note>
      <ol>
        {t.seats.map(id => (
          <li key={id}>
            <Dot color={who(id).color} />
            <b>{name(id)}</b>
            {id === r.taker ? (
              <RoleBadge role="president">Preneur</RoleBadge>
            ) : id === r.partner ? (
              <RoleBadge role="vice">Partenaire</RoleBadge>
            ) : (
              <RoleBadge>Défense</RoleBadge>
            )}
            <span
              className={r.marks[id]! < 0 ? 'pts neg' : 'pts'}
            >{`${r.marks[id]! > 0 ? '+' : ''}${r.marks[id]}`}</span>
          </li>
        ))}
      </ol>
      {deal || <Note>L'hôte lance la donne suivante.</Note>}
    </div>
  );
}
