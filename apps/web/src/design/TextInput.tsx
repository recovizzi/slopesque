// A text field (the `input` of design/field.css: border, focus ring). `mono`: a code or a key (monospace, capitals).
import type { ComponentProps } from 'react';
import { cls } from './cls';

export type TextInputProps = ComponentProps<'input'> & { mono?: boolean };

export function TextInput({ mono, className, ...rest }: TextInputProps) {
  return <input className={cls(mono && 'mono', className) || undefined} {...rest} />;
}
