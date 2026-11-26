// A drop-down list (the `select` of design/field.css). `onChange` gets the value chosen (a string: Number() it).
import type { ComponentProps, ReactNode } from 'react';

export interface SelectOption {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}
export type SelectProps = Omit<ComponentProps<'select'>, 'onChange'> & {
  options: SelectOption[];
  onChange?: (value: string) => void;
};

export function Select({ options, onChange, ...rest }: SelectProps) {
  return (
    <select {...rest} onChange={e => onChange?.(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
