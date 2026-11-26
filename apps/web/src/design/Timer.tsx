// The time left of a round (`.timer`): a bar that empties (`ratio` 1 → 0), its text in the middle, red when `urgent`.
// useNow() gives the current time, refreshed while needed, to compute what is left.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export interface TimerProps {
  ratio: number;
  urgent?: boolean;
  children: ReactNode;
}

export function Timer({ ratio, urgent, children }: TimerProps) {
  return (
    <div className={`timer ${urgent ? 'urgent' : ''}`}>
      <div className="timer-fill" style={{ '--p': ratio } as CSSProperties} />
      <span className="timer-text">{children}</span>
    </div>
  );
}

/** Date.now(), refreshed every `ms` while `on` (a round open, a vote running). */
export function useNow(ms: number, on = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, on]);
  return now;
}
