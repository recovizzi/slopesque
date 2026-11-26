// A window over the whole panel (`.modal` above `.modal-backdrop`): its title (`<h2>`, and its accessible name), a
// close button in its head if asked (`.rules-head`), closed by Escape (useEscape: the drawer behind stays open) and
// by a click on the backdrop. `as="form"`: a window whose buttons submit it. Its buttons: <ModalButtons>.
import type { FormEventHandler, ReactNode } from 'react';
import { cls } from './cls';
import { useEscape } from './hooks';
import { IconButton } from './IconButton';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** A ✕ in the head of the window. */
  closeButton?: boolean;
  as?: 'div' | 'form';
  onSubmit?: FormEventHandler<HTMLFormElement>;
  /** `alertdialog`: a message that must be read (the server lost a game…). */
  role?: 'dialog' | 'alertdialog';
  /** Closed by Escape (default); false when the caller handles Escape itself. */
  escape?: boolean;
}

export function Modal({
  title,
  onClose,
  children,
  className,
  closeButton,
  as = 'div',
  onSubmit,
  role = 'dialog',
  escape = true,
}: ModalProps) {
  useEscape(onClose, escape);
  const head = closeButton ? (
    <div className="rules-head">
      <h2>{title}</h2>
      <IconButton icon="close" label="Fermer" size="sm" onClick={onClose} />
    </div>
  ) : (
    <h2>{title}</h2>
  );
  const props = { className: cls('modal', className), role, 'aria-modal': true, 'aria-label': title };
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      {as === 'form' ? (
        <form {...props} onSubmit={onSubmit}>
          {head}
          {children}
        </form>
      ) : (
        <div {...props}>
          {head}
          {children}
        </div>
      )}
    </>
  );
}

/** The buttons of a window, at its bottom right (`.modal-buttons`): the way back first, the action last. */
export const ModalButtons = ({ children }: { children: ReactNode }) => <div className="modal-buttons">{children}</div>;
