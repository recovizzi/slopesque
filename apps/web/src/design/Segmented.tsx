// A choice among a few, side by side (`.seg-group` of `.seg`, the chosen one `.on`): a poll's kind of answer…
import type { ReactNode } from 'react';
import { cls } from './cls';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}
export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What is chosen, for screen readers. */
  label?: string;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  return (
    <span className={cls('seg-group', className)} role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={cls('seg', o.value === value && 'on')}
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
