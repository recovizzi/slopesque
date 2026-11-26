// The wheel's propositions for everyone else (and for the host during a draw): each one's colour, name, weight and
// share; the winner crowned after a draw.
import type { CSSProperties } from 'react';
import { Wheel } from '@slopesque/engines';
import { cls, Icon } from '../../design';
import { itemColor, itemName, pct, weightText, type WheelItem } from './model';

export function WheelLegend({ items, winner = null }: { items: WheelItem[]; winner?: number | null }) {
  if (!items.length) return <p className="poll-wait">La roue est vide pour l'instant.</p>;
  const sh = Wheel.shares(items);
  return (
    <ol className="wheel-legend">
      {items.map((it, i) => (
        <li key={i} className={i === winner ? 'win' : undefined} style={{ '--c': itemColor(i) } as CSSProperties}>
          <span className="swatch" />
          <span className={cls('legend-label', !it.label.trim() && 'is-empty')}>
            {i === winner && (
              <span className="crown">
                <Icon name="crown" />
              </span>
            )}
            {itemName(it, i)}
          </span>
          <small>{weightText(it)}</small>
          <b>{`${pct(sh[i])} %`}</b>
        </li>
      ))}
    </ol>
  );
}
