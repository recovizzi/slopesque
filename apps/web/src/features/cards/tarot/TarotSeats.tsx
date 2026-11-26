// The other players around the Tarot's table: whose turn, the taker (and his contract), the partner once revealed,
// each one's bid while bidding, a poignée shown, a chelem announced, the tricks won (hovered: shown over the table,
// unless the host hid them), the cards left.
import { memo } from 'react';
import { Tarot as TA } from '@slopesque/engines';
import { cls } from '../../../design';
import type { Seated, WhoOf } from '../model';
import { RoleBadge, SeatPill, Seats } from '../SeatPill';
import { bidName } from './model';

const { BIDS, HANDFUL_NAMES } = TA;

export function TarotSeats(props: {
  t: TA.Tarot;
  me: string;
  who: WhoOf;
  wonView: string | null;
  showTricks: boolean;
}) {
  const { t, me, who, wonView, showTricks } = props,
    others = t.seats.filter(id => id !== me);
  return (
    <Seats n={others.length}>
      {others.map(id => {
        const b = t.bids[id],
          h = t.handfuls?.[id];
        return (
          <TarotSeat
            key={id}
            id={id}
            {...who(id)}
            turn={t.turn === id}
            viewed={wonView === id}
            won={t.tricks[id]?.length ?? 0}
            cards={t.hands[id]?.length ?? 0}
            showTricks={showTricks}
            taker={t.taker === id ? BIDS[t.bid!].name : null}
            partner={t.revealed && t.partner === id}
            bid={t.phase === 'bid' && b ? bidName(b) : null}
            handful={h ? HANDFUL_NAMES[h.level - 1]! : null}
            handfulCards={h?.cards.length ?? 0}
            chelem={t.chelem === id}
          />
        );
      })}
    </Seats>
  );
}

interface TarotSeatProps extends Seated {
  id: string;
  turn: boolean;
  viewed: boolean;
  won: number;
  cards: number;
  showTricks: boolean;
  /** The taker's contract (he is the taker). */
  taker: string | null;
  /** The partner, revealed. */
  partner: boolean;
  /** What he said (while bidding). */
  bid: string | null;
  /** The poignée he showed, and its trumps. */
  handful: string | null;
  handfulCards: number;
  chelem: boolean;
}

/** Another player's pill: drawn again only when something of his changes. */
const TarotSeat = memo(function TarotSeat(props: TarotSeatProps) {
  const { id, turn, viewed, won, cards, showTricks, taker, partner, bid, handful, handfulCards, chelem, ...p } = props;
  const sub = (taker || partner || bid || handful || chelem || won > 0) && (
    <>
      {taker ? (
        <RoleBadge role="president" title={`Preneur : ${taker}`}>
          Preneur
        </RoleBadge>
      ) : partner ? (
        <RoleBadge role="vice">Partenaire</RoleBadge>
      ) : (
        bid && <RoleBadge>{bid}</RoleBadge>
      )}
      {handful && (
        <RoleBadge role="handful" title={`${handfulCards} atouts montrés`}>
          {handful}
        </RoleBadge>
      )}
      {chelem && <RoleBadge role="chelem">Chelem annoncé</RoleBadge>}
      {won > 0 && (
        <span
          className="seat-tricks"
          title={showTricks ? 'Survoler pour voir ses plis' : "Plis cachés : l'hôte a désactivé leur consultation"}
        >{`${won} pli${won > 1 ? 's' : ''}`}</span>
      )}
    </>
  );
  return (
    <SeatPill
      p={p}
      className={cls(turn && 'is-turn', viewed && 'is-viewed')}
      data-seat={id}
      data-won={won && showTricks ? id : undefined}
      sub={sub}
      side={
        <span className="seat-cards" title={`${cards} cartes`}>
          <b>{cards}</b>
        </span>
      }
    />
  );
});
