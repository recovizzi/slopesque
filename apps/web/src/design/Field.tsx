// A labelled control (`.field`): the label above (`<span>`), the control, then a help line (`.note`) or an error
// (`.alert`, said at once). A `<label>` around a single control (the click focuses it); `as="div"` when it holds
// several controls or a help line.
import type { ReactNode } from 'react';
import { cls } from './cls';
import { Note } from './Note';

export interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  /** Replaces the help line while there is one. */
  error?: ReactNode;
  as?: 'label' | 'div';
  className?: string;
  children: ReactNode;
}

export function Field({ label, help, error, as: Tag = 'label', className, children }: FieldProps) {
  return (
    <Tag className={cls('field', className)}>
      <span>{label}</span>
      {children}
      {error ? <Note tone="alert">{error}</Note> : help != null && help !== false && <Note>{help}</Note>}
    </Tag>
  );
}
