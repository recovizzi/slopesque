// LEGACY (to delete in task 4.1): the icons as SVG strings, for the HTML-string views not converted to React yet
// (lib/*.ts, features/*/…-view.ts). Made from the registry (design/icons.tsx), the only source: same markup as <Icon>.
import { Fragment, isValidElement, type ReactNode } from 'react';
import { ICONS, SOLID, type IconName } from '../design/icons';

const kebab = (k: string) => k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
/** A registry entry (shapes with string attributes, or a fragment of them) as markup. */
function markup(n: ReactNode): string {
  if (Array.isArray(n)) return n.map(markup).join('');
  if (!isValidElement(n)) return '';
  const { children, ...attrs } = n.props as Record<string, unknown>;
  if (n.type === Fragment) return markup(children as ReactNode);
  return `<${String(n.type)}${Object.entries(attrs).map(([k, v]) => ` ${kebab(k)}="${String(v)}"`).join('')}/>`;
}
const svg = (name: IconName) => {
  const solid = SOLID[name];
  return solid
    ? `<svg viewBox="0 0 24 24" width="${solid}" height="${solid}" aria-hidden="true">${markup(ICONS[name])}</svg>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${markup(ICONS[name])}</svg>`;
};

/** @deprecated SVG strings for the HTML-string views only; React code uses <Icon name> (design). Deleted in task 4.1. */
export const icon = Object.fromEntries((Object.keys(ICONS) as IconName[]).map(n => [n, svg(n)])) as Record<IconName, string>;
