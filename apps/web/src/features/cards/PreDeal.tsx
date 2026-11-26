// Before the first deal of the game the host chose (any card game): the seats taken, take one or leave it; robots play
// the free seats; the host deals when the players are seated.
import type { CardGameKey, CardsView } from '@slopesque/shared';
import { Button, cls } from '../../design';
import { plural, preDealTitle, type TableActions, type WhoOf } from './model';
import { SeatPill, Seats } from './SeatPill';

export interface PreDealProps {
  game: CardGameKey;
  c: CardsView;
  /** I have a seat. */
  seated: boolean;
  host: boolean;
  who: WhoOf;
  /** I tried to join a full table (the error, on the button). */
  full: boolean;
  act: TableActions;
}

export function PreDeal({ game, c, seated, host, who, full, act }: PreDealProps) {
  const n = c.settings[game] ?? 2,
    seats = c.game === game ? c.seats : [],
    free = seats.filter(st => !st.user).length;
  return (
    <div className="cards-game">
      <header className="cg-head">
        <b className="cg-title">{preDealTitle(game, c.settings)}</b>
        <span className="cg-info">Avant la donne : prends une place ; des robots jouent les places libres.</span>
      </header>
      <div className="cg-table">
        <Seats n={seats.length}>
          {seats.map(st => (
            <SeatPill key={st.id} p={who(st.id)} />
          ))}
        </Seats>
        <div className="cg-pile">
          {host && (
            <Button size="big" data-action="cards-deal" onClick={() => act.send('cards:deal')}>
              Distribuer
            </Button>
          )}
        </div>
        <p className="cg-pile-text">
          {`${plural(seats.length - free, 'joueur')} sur ${plural(n, 'place')}${host ? '' : " · l'hôte distribue"}`}
        </p>
      </div>
      <div className="cg-me">
        <div className="cg-watch">
          {seated ? (
            <Button variant="ghost" data-action="table-leave" onClick={() => act.send('table:leave')}>
              Quitter la table
            </Button>
          ) : (
            <Button className={cls('cg-join', full && 'is-error')} data-action="table-join" onClick={act.join}>
              {free || !seats.length ? 'Prendre une place' : `Table complète (${n}/${n})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
