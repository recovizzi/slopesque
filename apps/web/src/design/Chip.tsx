// A player's pill (`.chip`, in `.chips`): dashed while waiting, `done` (✓) in the player's colour; and the coloured
// dot (`.dot`) that marks a player in lists.
import type { CSSProperties, ReactNode } from 'react';
import { cls } from './cls';

const tint = (color?: string) => (color ? ({ '--c': color } as CSSProperties) : undefined);

export const Dot = ({ color }: { color: string }) => <span className="dot" style={tint(color)} />;

export interface ChipProps {
  color?: string;
  done?: boolean;
  as?: 'li' | 'span';
  className?: string;
  children: ReactNode;
}

export function Chip({ color, done, as: Tag = 'li', className, children }: ChipProps) {
  return (
    <Tag className={cls('chip', done && 'done', className)} style={tint(color)}>
      {color && <Dot color={color} />}
      {children}
      {done ? ' ✓' : ''}
    </Tag>
  );
}
