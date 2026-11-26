// The Tarot's table (openspec: card-games, Tarot): the header (the deal, the contract and, at 5, the called card then
// the partner, whose turn), the other players around, the middle (chien, trick, count) and the line under it, my pile
// of won tricks and a player's tricks while hovered, then my side. The server deals, checks every card, makes the
// robots play and only ever sends me my own hand.
import { Tarot as TA } from '@slopesque/engines';
import { cls } from '../../../design';
import type { TableActions, WhoOf } from '../model';
import { TableHead } from '../TableHead';
import { DOING, handState, pileText } from './model';
import { MiniCard } from './TarotCard';
import { TarotMe, TarotWatch } from './TarotMe';
import { TarotPile } from './TarotPile';
import { TarotSeats } from './TarotSeats';
import { MyPile, TricksView } from './TarotTricks';

export interface TarotTableProps {
  t: TA.Tarot;
  /** My seat ('' : watching). */
  me: string;
  host: boolean;
  who: WhoOf;
  /** The trick just completed, still on the table (before it goes to its winner). */
  showLast: boolean;
  /** The player whose won tricks are shown (hovering his pill, or my pile). */
  wonView: string | null;
  /** The host's setting: the won tricks can be looked at (off: remember the cards). */
  showTricks: boolean;
  act: TableActions;
}

export function TarotTable({ t, me, host, who, showLast, wonView, showTricks, act }: TarotTableProps) {
  const name = (id: string) => (id === me ? 'Toi' : who(id).name),
    myTurn = t.turn === me,
    { active } = handState(t, me),
    viewed = showTricks && wonView ? t.tricks[wonView] : undefined;
  const info = (
    <>
      {`Donne ${t.deal} · `}
      {t.taker && t.bid ? (
        <>
          {`${name(t.taker)} : ${TA.BIDS[t.bid].name}`}
          {t.called && (
            <>
              {' · appelle '}
              <MiniCard card={t.called} />
              {t.revealed && t.partner && t.partner !== t.taker && ` avec ${name(t.partner)}`}
            </>
          )}
        </>
      ) : (
        'enchères'
      )}
      {t.turn !== null &&
        (myTurn ? (
          <>
            {' · '}
            <b>{`à toi de ${DOING[t.phase]}`}</b>
          </>
        ) : (
          ` · à ${name(t.turn)} de ${DOING[t.phase]}`
        ))}
    </>
  );
  return (
    <div
      className={cls(
        'cards-game tarot',
        (active || (myTurn && (t.phase === 'bid' || t.phase === 'call'))) && 'my-turn',
      )}
    >
      <TableHead title={`Tarot à ${t.seats.length}`} info={info} start={t.startedAt} onRules={act.rules} />
      <div className="cg-table">
        <TarotSeats t={t} me={me} who={who} wonView={wonView} showTricks={showTricks} />
        <div className="cg-pile" data-pile="">
          <TarotPile
            t={t}
            host={host}
            who={who}
            name={name}
            showLast={showLast}
            onDeal={() => act.send('cards:deal')}
          />
        </div>
        <p className="cg-pile-text">{pileText(t, me, name, showLast)}</p>
        {me && <MyPile count={t.tricks[me]?.length ?? 0} me={me} look={showTricks} />}
        {viewed?.length ? <TricksView tricks={viewed} name={name(wonView!)} /> : null}
      </div>
      <div className="cg-me">
        {me ? <TarotMe t={t} me={me} act={act} /> : <TarotWatch seats={t.seats.length} act={act} />}
      </div>
    </div>
  );
}
