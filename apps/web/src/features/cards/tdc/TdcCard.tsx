// A card of the Trou du cul (3 … 10, V, D, R, A, 2): drawn once per card, whatever the table does around it.
import { memo } from 'react';
import { Tdc as T } from '@slopesque/engines';
import { PlayingCard } from '../PlayingCard';
import { cardLabel } from './model';

export const TdcCard = memo(
  function TdcCard({ card, className }: { card: T.Card; className?: string }) {
    return <PlayingCard value={T.rankLabel(card.r)} suit={card.s} label={cardLabel(card)} className={className} />;
  },
  (a, b) => a.card.id === b.card.id && a.className === b.className,
);
