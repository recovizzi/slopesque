// A square button with only an icon (`.icon-btn`, 32 px; `sm` 26 px): its label is said by `aria-label` and shown on
// hover (`title`, the label unless given).
import type { ComponentProps } from 'react';
import { cls } from './cls';
import { Icon, type IconName } from './Icon';

export type IconButtonProps = ComponentProps<'button'> & { icon: IconName; label: string; size?: 'sm' | 'md' };

export function IconButton({ icon, label, title = label, size = 'md', className, ...rest }: IconButtonProps) {
  return (
    <button
      className={cls('icon-btn', size === 'sm' && 'sm', className)}
      type="button"
      title={title}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
