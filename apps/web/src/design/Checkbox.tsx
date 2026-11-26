// A checkbox and its label, clickable as a whole (`.check`). `onChange` gets the new state.
import type { ComponentProps, ReactNode } from 'react';
import { cls } from './cls';

export type CheckboxProps = Omit<ComponentProps<'input'>, 'type' | 'onChange'> & {
  label: ReactNode;
  onChange?: (checked: boolean) => void;
};

export function Checkbox({ label, onChange, className, ...rest }: CheckboxProps) {
  return (
    <label className={cls('check', className)}>
      <input type="checkbox" {...rest} onChange={e => onChange?.(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
