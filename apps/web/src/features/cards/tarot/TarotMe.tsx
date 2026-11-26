// My side of the Tarot's table: my hand in a fan (in the bids, to look at; for the écart, what can go — no King, no
// bout — chosen; in play, the legal cards, the others greyed; the chien just taken glows), leave the table, my trumps,
// then what I can do now: bid, call a King (at 5), make the écart, announce a chelem or show a poignée, play.
// Watching: take a robot's seat.
import { Tarot as TA } from '@slopesque/engines';
import { Button, Note } from '../../../design';
import { Hand, useSelection } from '../Hand';
import type { TableActions } from '../model';
import { RoleBadge } from '../SeatPill';
import { BID_ORDER, bidName, handState, pick, trumpCount } from './model';
import { TarotCard } from './TarotCard';

type Tarot = TA.Tarot;
const { HANDFUL_NAMES, HANDFUL_POINTS } = TA;

export function TarotMe({ t, me, act }: { t: Tarot; me: string; act: TableActions }) {
  const [chosen, choose] = useSelection(`${t.deal}:${t.phase}`);
  const mine = t.hands[me] ?? [],
    { ok, active } = handState(t, me),
    chien = new Set(t.phase === 'dog' ? t.chien.map(cd => cd.id) : []);
  const onPick = (id: string) => {
    // a card chosen, then clicked again: played
    const r = pick(t, me, chosen, id);
    if (!r) return;
    if ('play' in r) act.send('cards:play', { cards: [r.play] });
    else choose(r.chosen);
  };
  return (
    <>
      <Hand
        cards={mine.map(cd => ({
          id: cd.id,
          face: <TarotCard card={cd} />,
          selected: chosen.has(cd.id),
          off: active && !ok.has(cd.id),
          fresh: chien.has(cd.id),
        }))}
        onPick={onPick}
      />
      <Button
        variant="ghost"
        size="sm"
        className="cg-leave"
        data-action="table-leave"
        title="Un robot joue ta main à ta place"
        onClick={() => act.send('table:leave')}
      >
        Quitter la table
      </Button>
      <TarotActions t={t} me={me} chosen={chosen} act={act} />
    </>
  );
}

function TarotActions({
  t,
  me,
  chosen,
  act,
}: {
  t: Tarot;
  me: string;
  chosen: ReadonlySet<string>;
  act: TableActions;
}) {
  const mine = t.hands[me] ?? [],
    myTurn = t.turn === me,
    { trumps, bouts } = trumpCount(mine);
  const chip = (
    <RoleBadge className="trump-count" title="Atouts et Excuse dans ta main">
      {`Atouts ${trumps} · bouts ${bouts}`}
    </RoleBadge>
  );
  if (t.phase === 'call' && t.taker === me)
    return (
      <div className="cg-actions call">
        {chip}
        <span className="cg-hint">Appelle :</span>
        {TA.callable(t).map(cd => (
          <button
            key={cd.id}
            className="call-card"
            type="button"
            data-action="tarot-call"
            data-v={cd.id}
            title={`Appeler ${TA.cardName(cd)}${mine.some(x => x.id === cd.id) ? ' (le tien : tu joues seul)' : ''}`}
            onClick={() => act.send('tarot:call', { card: cd.id })}
          >
            <TarotCard card={cd} className="small" />
          </button>
        ))}
      </div>
    );
  if (t.phase === 'bid') {
    const can = TA.bidsFor(t);
    return (
      <div className="cg-actions">
        {chip}
        <span className="cg-hint">{myTurn ? 'Ton enchère :' : 'Les autres parlent…'}</span>
        {BID_ORDER.map(b => (
          <Button
            key={b}
            variant={b === 'pass' ? 'ghost' : 'primary'}
            className="sm-bid"
            data-action="tarot-bid"
            data-v={b}
            disabled={!(myTurn && can.includes(b))}
            onClick={() => act.send('tarot:bid', { bid: b })}
          >
            {bidName(b)}
          </Button>
        ))}
      </div>
    );
  }
  if (t.phase === 'dog' && t.taker === me) {
    const n = mine.filter(cd => chosen.has(cd.id)).length,
      k = TA.ecartSize(t);
    return (
      <div className="cg-actions">
        {chip}
        <span className="cg-hint">{`Écart : ${n} / ${k} — choisis ${k} cartes (ni Roi ni bout ; atout seulement s'il le faut)`}</span>
        <Button
          data-action="tarot-ecart"
          disabled={n !== k}
          onClick={() => act.send('tarot:discard', { cards: [...chosen] })}
        >
          Faire l'écart
        </Button>
      </div>
    );
  }
  const sel = mine.find(cd => chosen.has(cd.id)),
    play = t.phase === 'play',
    sizes = TA.handfulSizes(t.seats.length);
  return (
    <div className="cg-actions">
      {chip}
      {play && t.taker === me && !t.chelem && !(t.started ?? []).length && !t.trick.length && (
        <Button
          variant="ghost"
          size="sm"
          data-action="tarot-chelem"
          title="Tous les plis : +400 réussi, −200 manqué ; tu entames"
          onClick={() => act.send('tarot:chelem')}
        >
          Annoncer un chelem
        </Button>
      )}
      {play &&
        myTurn &&
        TA.handfulLevels(t, me).map(lv => (
          <Button
            key={lv}
            variant="ghost"
            size="sm"
            data-action="tarot-handful"
            data-v={lv}
            title={`Montrer ${sizes[lv - 1]} atouts : ${HANDFUL_POINTS[lv - 1]} points pour le camp qui gagne la donne`}
            onClick={() => act.send('tarot:handful', { level: lv })}
          >
            {`Montrer une ${HANDFUL_NAMES[lv - 1]} (${sizes[lv - 1]})`}
          </Button>
        ))}
      <span className="cg-hint">
        {!play
          ? ''
          : myTurn
            ? sel
              ? `Jouer ${TA.cardName(sel)} ?`
              : 'Choisis une carte (les autres sont grisées)'
            : 'Attends ton tour…'}
      </span>
      <Button
        data-action="cards-play"
        disabled={!(play && myTurn && sel)}
        onClick={() => act.send('cards:play', { cards: [...chosen] })}
      >
        Jouer
      </Button>
    </div>
  );
}

/** Watching: the Tarot is played at its number of seats (robots on the free ones): take a robot's seat. */
export function TarotWatch({ seats, act }: { seats: number; act: TableActions }) {
  return (
    <div className="cg-watch">
      <Note>{`Tu regardes la partie : le Tarot se joue à ${seats} (des robots complètent les places libres). Prends la place d'un robot : sa main et ses points deviennent les tiens.`}</Note>
      <Button className="cg-join" data-action="table-join" onClick={act.join}>
        Prendre une place
      </Button>
    </div>
  );
}
