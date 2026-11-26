// A player's round: the profile photo (in this room), or the first letter of the name on the player's colour.
import type { CSSProperties, MouseEventHandler } from 'react';
import { hueColor } from '@slopesque/engines';

/** A player's colour from its hue (0 → 359). */
export const colorOf = (hue: number) => hueColor(hue);

export interface AvatarProps {
  name: string;
  hue: number;
  photo?: string | null;
  /** `sm` 28 px (lists), '' 32 px (the header), `lg` (Profil). */
  size?: 'sm' | 'lg' | '';
  /** Clickable (the header's avatar): a <button> instead of a <span>. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title?: string;
  label?: string;
}

export function Avatar({ name, hue, photo, size = 'sm', onClick, title, label }: AvatarProps) {
  const style = { '--c': colorOf(hue) } as CSSProperties;
  const face = photo ? <img src={photo} alt="" draggable={false} /> : name.slice(0, 1).toUpperCase();
  return onClick
    ? <button className={`avatar${size ? ` ${size}` : ''}${photo ? ' has-photo' : ''}`} type="button" onClick={onClick} style={style} title={title} aria-label={label}>{face}</button>
    : <span className={`avatar ${size}${photo ? ' has-photo' : ''}`} style={style} title={title}>{face}</span>;
}
