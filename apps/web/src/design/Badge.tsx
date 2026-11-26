// A small label (`.tag`): `accent` (filled, the default: « Actuel »), `wait` (amber: « En attente », « Reconnexion… »),
// `insecure` (red, with its icon: « Connexion non chiffrée »).
import type { ComponentProps } from 'react';
import { cls } from './cls';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'accent' | 'wait' | 'insecure';
export type BadgeProps = ComponentProps<'span'> & { tone?: BadgeTone; icon?: IconName };

export function Badge({ tone = 'accent', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cls('tag', tone !== 'accent' && tone, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}
