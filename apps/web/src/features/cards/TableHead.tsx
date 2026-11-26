// A card table's header: the game, what is going on (the round, the contract, whose turn), the game's clock (its own
// component: only it is drawn again every second) and the rules.
import type { ReactNode } from 'react';
import { IconButton, useNow } from '../../design';
import { fmtClock } from './model';

/** The time since the game started. */
function Clock({ start }: { start: number }) {
  const now = useNow(1000);
  return (
    <span className="cg-clock" title="Temps de jeu">
      {fmtClock(now - start)}
    </span>
  );
}

export interface TableHeadProps {
  title: string;
  info: ReactNode;
  /** The game's start (the clock). */
  start: number;
  onRules: () => void;
}

export function TableHead({ title, info, start, onRules }: TableHeadProps) {
  return (
    <header className="cg-head">
      <b className="cg-title">{title}</b>
      <span className="cg-info">{info}</span>
      <span className="spacer" />
      <Clock start={start} />
      <IconButton
        icon="info"
        label="Règles du jeu"
        size="sm"
        className="cg-rules"
        data-action="cards-rules"
        onClick={onRules}
      />
    </header>
  );
}
