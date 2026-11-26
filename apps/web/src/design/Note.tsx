// A line of small text: help (`.note`, muted), `alert` (red frame, said at once: role="alert"), `pending` (something
// applied later, in the accent), `ok` (a success, in green), `danger` (a warning about a risky action, in red).
import type { ReactNode } from 'react';
import { cls } from './cls';

export type NoteTone = 'note' | 'alert' | 'pending' | 'ok' | 'danger';
export interface NoteProps {
  tone?: NoteTone;
  as?: 'p' | 'span' | 'div';
  className?: string;
  children: ReactNode;
}

const TONE: Record<NoteTone, string> = {
  note: 'note',
  alert: 'alert',
  pending: 'note pending',
  ok: 'note ok-note',
  danger: 'note danger-note',
};

export function Note({ tone = 'note', as: Tag = 'p', className, children }: NoteProps) {
  return (
    <Tag className={cls(TONE[tone], className)} role={tone === 'alert' ? 'alert' : undefined}>
      {children}
    </Tag>
  );
}

/** A list or a panel with nothing in it yet: what is missing, and how to get some (a help line). */
export const EmptyState = ({ children, className }: { children: ReactNode; className?: string }) => (
  <Note className={className}>{children}</Note>
);
