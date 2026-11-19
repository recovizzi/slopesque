// Small shared pieces: an icon (inline SVG strings of lib/icons.ts), a player's round, HTML already escaped.
import { useEffect } from 'react';
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

/** A window closed by Escape (before the drawer behind it: the event is marked as handled). */
export function useEscape(onClose: () => void, on = true) {
  useEffect(() => {
    if (!on) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose, on]);
}

/** Copies a text: the clipboard, or (refused in the frame, older browsers) a hidden field selected and copied. */
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* refused too */ }
    t.remove();
    return ok;
  }
}
