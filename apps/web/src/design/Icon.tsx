// An icon of the registry (icons.tsx) as an inline <svg>: 18 px, stroked with currentColor (its colour and, often,
// its size come from the CSS around it: `.btn svg`, `.tab svg`…). Decorative (aria-hidden): the button or the text
// around it says what it is.
import { ICONS, SOLID, type IconName } from './icons';

export type { IconName } from './icons';

export interface IconProps {
  name: IconName;
  /** Width and height in px (default 18; a solid icon has its own). The CSS usually sets it instead. */
  size?: number;
  className?: string;
}

export function Icon({ name, size, className }: IconProps) {
  const solid = SOLID[name],
    s = size ?? solid ?? 18;
  return solid ? (
    <svg className={className} viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
      {ICONS[name]}
    </svg>
  ) : (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
