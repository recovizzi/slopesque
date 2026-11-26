// The icon registry: the shapes of every icon (24 × 24 grid, stroked with currentColor, 2 px, round ends), drawn by
// <Icon name> (Icon.tsx). The only source of the icons: the HTML-string views not converted yet read them as strings
// through legacy/icons.ts (deleted in task 4.1). A new icon: its shapes here (from an icon set's SVG, attributes in
// camelCase), nothing else.
import type { ReactElement } from 'react';

export const ICONS = {
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />,
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 14l2 2 4-4" /></>,
  sticker: <><path d="M20 12V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6z" /><path d="M20 12a8 8 0 0 0-8 8" /><path d="M9 10h.01M15 10h.01" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
  bot: <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M9 13.5v1M15 13.5v1M2 13v3M22 13v3" /><circle cx="12" cy="3.5" r="1" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  reply: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  replied: <><path d="M4 20v-5a6 6 0 0 1 6-6h10" /><path d="M15 4l5 5-5 5" /></>,
  vote: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 12l3 3 5-6" /></>,
  away: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  gone: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /><path d="M14 3h4l-4 4h4" /></>,
  kick: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 12.5-4.3M16 15l5 5M21 15l-5 5" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  gif: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 10H8.5a1.5 1.5 0 0 0 0 3H10v-1.2M13 10v4M16 14v-4h2.2M16 12h1.8" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  imageOff: <><path d="M3 3l18 18" /><path d="M21 15V5a2 2 0 0 0-2-2H9M3 7v12a2 2 0 0 0 2 2h12" /><path d="M3 17l5-5 4 4M14 10l2-2 5 5" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;

/** Icons drawn filled with currentColor (no stroke), and their size. The others are stroked, 18 px. */
export const SOLID: Partial<Record<IconName, number>> = { play: 28 };
