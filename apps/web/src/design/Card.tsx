// A card centred in the stage (`.room-card`): a page instead of the game (no room, a server down, the first launch,
// an integration that doesn't answer). `tone` colours the title: `offline` and `unknown` red, `pending` amber.
import type { ReactNode } from 'react';
import { cls } from './cls';

export interface CardProps {
  title?: ReactNode;
  tone?: 'offline' | 'unknown' | 'pending';
  className?: string;
  children?: ReactNode;
}

export function Card({ title, tone, className, children }: CardProps) {
  return (
    <div className={cls('room-card', tone, className)}>
      {title !== undefined && <h1>{title}</h1>}
      {children}
    </div>
  );
}
