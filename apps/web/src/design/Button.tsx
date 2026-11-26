// The button of the app (`.btn`): filled with the accent (primary), `ghost` (quiet, on the surface), `danger`
// (outlined red), `danger-fill` (filled red: a final step); sizes `sm`, `md` (default), `big` (a page's main action).
// With `href` it is a link that looks like a button. `type` is "button" unless given ("submit" in a form).
import type { ComponentProps, ReactNode } from 'react';
import { cls } from './cls';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'danger-fill';
export type ButtonSize = 'sm' | 'md' | 'big';
interface Look {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** An icon before the text. */
  icon?: IconName;
  className?: string;
  children?: ReactNode;
}
export type ButtonProps = Look & ComponentProps<'button'>;
export type LinkButtonProps = Look &
  ComponentProps<'a'> & {
    href: string;
    /** Opened in a new tab (target, rel). */
    external?: boolean;
  };

/** The classes of a button: for an element that must stay something else (a <label> that opens a file…). */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) =>
  cls('btn', variant !== 'primary' && variant, size !== 'md' && size, className);

export function Button({ variant, size, icon, className, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} type="button" {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function LinkButton({ variant, size, icon, className, children, external, ...rest }: LinkButtonProps) {
  return (
    <a
      className={buttonClass(variant, size, className)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </a>
  );
}
