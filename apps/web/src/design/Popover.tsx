// Something that opens next to its trigger (a menu, a small panel): the trigger and the content in one wrapper, so a
// pointer down outside it, or Escape, closes it (useDismiss). The wrapper's class places the content (e.g.
// `.plus-wrap` relative, `.plus-menu` absolute above it).
import { useRef, type ReactNode } from 'react';
import { useDismiss } from './hooks';
import { Icon, type IconName } from './Icon';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The button that opens it (its onClick toggles `open`; aria-expanded={open}). */
  trigger: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Popover({ open, onClose, trigger, className, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose, open);
  return (
    <div ref={ref} className={className}>
      {trigger}
      {open && children}
    </div>
  );
}

/** A list of actions (role="menu"), in a Popover; its look comes from `className` (`.plus-menu`…). */
export const Menu = ({ className, label, children }: { className?: string; label?: string; children: ReactNode }) => (
  <div className={className} role="menu" aria-label={label}>
    {children}
  </div>
);

export function MenuItem({
  icon,
  onClick,
  disabled,
  children,
}: {
  icon?: IconName;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
