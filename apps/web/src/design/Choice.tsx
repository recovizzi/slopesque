// A big choice among a few (`.choice`): its name in bold, what it does in small (change of code, what to make of a file).
import type { ReactNode } from 'react';

export interface ChoiceProps {
  title: ReactNode;
  help?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function Choice({ title, help, onClick, disabled }: ChoiceProps) {
  return (
    <button className="choice" type="button" onClick={onClick} disabled={disabled}>
      <b>{title}</b>
      {help && <small>{help}</small>}
    </button>
  );
}
