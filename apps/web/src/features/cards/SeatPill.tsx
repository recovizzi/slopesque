// The players around the table: a seat's pill (the avatar, the name cut with « … », a line under it, what goes on the
// right; a robot's icon on the top-right corner, a mark on the top-left one), the button to propose a kick that
// floats under it, the row of pills (all on one row up to 4, else two rows), a role's badge. Their look: cards.css.
// A seat no player is behind (`hue` null) has the robots' grey avatar (`.cg-seat.is-robot`).
import { Children, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { Avatar, cls, Icon } from '../../design';
import { seatCols, type Late, type Seated } from './model';

const BOT_TITLE = 'Un robot joue cette place';
/** Something to show (not only null, false or empty lists). */
export const filled = (node: ReactNode) => Children.toArray(node).length > 0;

/** The robot's icon: a robot plays the seat (for a player who left: until the end of the round). */
export const BotMark = ({ corner }: { corner?: boolean }) => (
  <span className={cls('seat-bot', corner && 'corner')} title={BOT_TITLE}>
    <Icon name="bot" />
  </span>
);

/** A seat's name, the robot's icon after it if a robot plays it (the results' lines). */
export const SeatLabel = ({ p, className = 'seat-name' }: { p: Pick<Seated, 'name' | 'bot'>; className?: string }) => (
  <>
    <span className={className}>{p.name}</span>
    {p.bot && <BotMark />}
  </>
);

export interface SeatPillProps extends Omit<HTMLAttributes<HTMLLIElement>, 'children'> {
  p: Seated;
  /** The line under the name (badges, a state); left out when empty. */
  sub?: ReactNode;
  /** On the right (the count of the seat's cards…). */
  side?: ReactNode;
  /** On the top-left corner. */
  mark?: ReactNode;
  /** Floats under the pill (« Exclure ? »). */
  extra?: ReactNode;
}

/** A seat's pill, the same size for all (the row shares the table's width). */
export function SeatPill({ p, className, sub, side, mark, extra, style, ...rest }: SeatPillProps) {
  return (
    <li
      className={cls('cg-seat', p.hue === null && 'is-robot', className)}
      style={{ '--c': p.color, ...style } as CSSProperties}
      {...rest}
    >
      {mark}
      {p.bot && <BotMark corner />}
      <Avatar name={p.name} hue={p.hue ?? 0} photo={p.bot ? null : p.photo} />
      <span className="seat-main">
        <span className="seat-name" title={p.name}>
          {p.name}
        </span>
        {filled(sub) && <span className="seat-sub">{sub}</span>}
      </span>
      {filled(side) && <span className="seat-side">{side}</span>}
      {extra}
    </li>
  );
}

/** The row of the other seats around the table. */
export const Seats = ({ n, children }: { n: number; children: ReactNode }) => (
  <ul className="cg-seats" style={{ '--cols': seatCols(n) } as CSSProperties}>
    {children}
  </ul>
);

/** A player's turn has lasted 30 s: a button under his pill to propose the vote (as /kick), or the vote running. */
export function KickButton({ late, onKick }: { late: Pick<Late, 'secs' | 'vote'> | null; onKick: () => void }) {
  if (!late) return null;
  if (late.vote) return <span className="seat-kick is-vote">vote en cours</span>;
  return (
    <button
      className="seat-kick"
      type="button"
      data-action="kick"
      title={`Son tour dure depuis ${late.secs} s : proposer au vote qu'un robot joue à sa place (comme /kick)`}
      onClick={onKick}
    >
      <Icon name="kick" />
      Exclure ?
    </button>
  );
}

/** A role, a bid, a bonus… on a seat or in the results (`role`: its colour, `role-president`…). */
export const RoleBadge = ({
  role,
  className,
  title,
  children,
}: {
  role?: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) => (
  <span className={cls('role-badge', role && `role-${role}`, className)} title={title}>
    {children}
  </span>
);
