// The Trou du cul's table (openspec: card-games): the header, the other players around (their role, out or passed,
// their cards' count, the kick proposed after 30 s), the plays in the middle and the line under them, the round's
// results, then my hand and its buttons — or, watching, the way to a seat. The server deals, checks every play,
// makes the robots play and only ever sends me my own hand.
import { memo } from 'react';
import { Tdc as T } from '@slopesque/engines';
import { cls } from '../../../design';
import type { Late, Seated, TableActions, WhoOf } from '../model';
import { CardBack } from '../PlayingCard';
import { KickButton, RoleBadge, SeatPill, Seats } from '../SeatPill';
import { TableHead } from '../TableHead';
import { pileText, seatState, type JoinSeats } from './model';
import { TdcMe, TdcWatch } from './TdcMe';
import { TdcPlays, TdcResults } from './TdcPile';

const { ROLES } = T;

export interface TdcTableProps {
  t: T.Tdc;
  /** My seat ('' : watching). */
  me: string;
  host: boolean;
  who: WhoOf;
  /** Who got each seat's points (the results). */
  paid: WhoOf;
  /** A player's turn lasting (not mine). */
  late: Late | null;
  seats: JoinSeats;
  act: TableActions;
}

export function TdcTable({ t, me, host, who, paid, late, seats, act }: TdcTableProps) {
  const over = t.turn === null,
    myTurn = !over && t.turn === me,
    others = t.seats.filter(id => id !== me);
  const info = over ? (
    `Manche ${t.round} terminée`
  ) : (
    <>
      {`Manche ${t.round} · `}
      {t.turn === me ? <b>à toi de jouer</b> : `à ${who(t.turn!).name} de jouer`}
    </>
  );
  return (
    <div className={cls('cards-game', myTurn && 'my-turn')}>
      <TableHead title="Trou du cul" info={info} start={t.startedAt} onRules={act.rules} />
      <div className="cg-table">
        <Seats n={others.length}>
          {others.map(id => (
            <TdcSeat
              key={id}
              id={id}
              {...who(id)}
              cards={t.hands[id]?.length ?? 0}
              turn={t.turn === id}
              state={seatState(t, id)}
              passed={t.passed.includes(id)}
              out={t.out.includes(id)}
              role={t.roles[id]}
              lateSecs={late?.seat === id ? late.secs : null}
              lateVote={late?.seat === id && late.vote}
              onKick={act.kick}
            />
          ))}
        </Seats>
        <div className="cg-pile" data-pile="">
          <TdcPlays t={t} />
          {over && <TdcResults t={t} host={host} paid={paid} onDeal={() => act.send('cards:deal')} />}
        </div>
        <p className="cg-pile-text">{pileText(t, me, id => who(id).name)}</p>
      </div>
      <div className="cg-me">
        {me ? <TdcMe t={t} me={me} act={act} /> : <TdcWatch seats={seats} over={over} act={act} />}
      </div>
    </div>
  );
}

interface TdcSeatProps extends Seated {
  id: string;
  cards: number;
  turn: boolean;
  state: string | null;
  passed: boolean;
  out: boolean;
  role: T.Role | undefined;
  lateSecs: number | null;
  lateVote: boolean;
  onKick: () => void;
}

/** Another player's pill: drawn again only when something of his changes. */
const TdcSeat = memo(function TdcSeat({
  id,
  cards,
  turn,
  state,
  passed,
  out,
  role,
  lateSecs,
  lateVote,
  onKick,
  ...p
}: TdcSeatProps) {
  const late = lateSecs !== null;
  return (
    <SeatPill
      p={p}
      className={cls(turn && 'is-turn', late && 'is-late', passed && 'has-passed', out && 'is-out')}
      data-seat={id}
      sub={
        (role || state) && (
          <>
            {role && <RoleBadge role={role}>{ROLES[role].name}</RoleBadge>}
            {state && <span className="seat-state">{state}</span>}
          </>
        )
      }
      side={
        <span className="seat-cards" title={`${cards} cartes`}>
          <CardBack className="mini" />
          <b>{cards}</b>
        </span>
      }
      extra={<KickButton late={late ? { secs: lateSecs, vote: lateVote } : null} onKick={onKick} />}
    />
  );
});
