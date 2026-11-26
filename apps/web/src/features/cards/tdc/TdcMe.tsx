// My side of the Trou du cul's table: my hand in a fan (cards of one value chosen together), leave the table (a robot
// plays my hand), my role, the hint, pass or play — or, watching, the way to a seat: mine back, a robot's, or none.
import { Tdc as T } from '@slopesque/engines';
import { Button, cls, Note } from '../../../design';
import { Hand, useSelection } from '../Hand';
import type { TableActions } from '../model';
import { RoleBadge } from '../SeatPill';
import { hint, joinText, pick, type JoinSeats } from './model';
import { TdcCard } from './TdcCard';

export function TdcMe({ t, me, act }: { t: T.Tdc; me: string; act: TableActions }) {
  const [chosen, choose] = useSelection(`${t.round}:${t.turn}`);
  const mine = t.hands[me] ?? [],
    sel = mine.filter(cd => chosen.has(cd.id)),
    myTurn = t.turn !== null && t.turn === me,
    role = t.roles[me];
  return (
    <>
      <Hand
        cards={mine.map(cd => ({ id: cd.id, face: <TdcCard card={cd} />, selected: chosen.has(cd.id) }))}
        onPick={id => choose(pick(mine, chosen, id))}
      />
      <div className="cg-actions">
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
        {role && <RoleBadge role={role}>{T.ROLES[role].name}</RoleBadge>}
        <span className="cg-hint">{hint(t, me, sel)}</span>
        <Button
          variant="ghost"
          data-action="cards-pass"
          disabled={!(myTurn && T.top(t))}
          onClick={() => act.send('cards:pass')}
        >
          Passer
        </Button>
        <Button
          data-action="cards-play"
          disabled={!(myTurn && T.canPlay(t, sel))}
          onClick={() => act.send('cards:play', { cards: [...chosen] })}
        >
          {`Jouer${sel.length ? ` (${sel.length})` : ''}`}
        </Button>
      </div>
    </>
  );
}

/** Watching: join the table, at a seat a robot plays (my own first); a full table: the error on the button. */
export function TdcWatch({ seats, over, act }: { seats: JoinSeats; over: boolean; act: TableActions }) {
  const { label, why } = joinText(seats, over);
  return (
    <div className="cg-watch">
      <Note>{`Tu regardes la partie. ${why}`}</Note>
      <Button
        className={cls('cg-join', seats.full && 'is-error')}
        icon="users"
        data-action="table-join"
        aria-invalid={seats.full || undefined}
        onClick={act.join}
      >
        {label}
      </Button>
    </div>
  );
}
