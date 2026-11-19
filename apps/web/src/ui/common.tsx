// Small shared pieces: an icon (inline SVG strings of lib/icons.ts), a player's round, HTML already escaped.
import { hueColor } from '@slopesque/engines';
import { icon } from '../lib/icons';

export type IconName = keyof typeof icon;
/** An inline icon: its <svg> stays the button's child for the layout (display: contents). */
export const Icon = ({ name }: { name: IconName }) => <span className="ic" dangerouslySetInnerHTML={{ __html: icon[name] }} />;

/** HTML made by our own escaping helpers (lib/html.ts esc, links, emoji): never raw player text. */
export const Html = ({ html, as: Tag = 'span', className }: { html: string; as?: 'span' | 'div' | 'p'; className?: string }) =>
  <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

export const colorOf = (hue: number) => hueColor(hue);

/** A player's round: the profile photo, or the first letter on the colour. */
export function Avatar({ name, hue, photo, size = 'sm' }: { name: string; hue: number; photo?: string | null; size?: 'sm' | 'lg' | '' }) {
  return <span className={`avatar ${size}${photo ? ' has-photo' : ''}`} style={{ '--c': colorOf(hue) } as React.CSSProperties}>
    {photo ? <img src={photo} alt="" draggable={false} /> : name.slice(0, 1).toUpperCase()}</span>;
}

/** The colour name of a player (bold, in its colour). */
export const Who = ({ name, hue }: { name: string; hue: number }) => <b style={{ color: colorOf(hue) }}>{name}</b>;
