// The small pictures of the /activity window (80 × 52): clear at a glance, the same colours in both themes (a
// picture, not the interface: its colours are its own).
import type { ReactNode } from 'react';

export type ArtKind = 'disk' | 'poll' | 'wheel' | 'chat' | 'cards' | 'web';

const INK = '#1c1b19',
  ACCENT = '#5b5bd6',
  PALE = '#e9e7ff',
  YELLOW = '#ffd166',
  RED = '#ef476f',
  GREEN = '#06d6a0',
  BLUE = '#4cc9f0';

/** A playing card, tilted, with its suit in the middle. */
const Card = ({ x, angle, at, suit, color }: { x: number; angle: number; at: string; suit: string; color: string }) => (
  <g transform={`rotate(${angle} ${at})`}>
    <rect x={x} y="8" width="26" height="38" rx="4" fill="#fff" stroke={INK} strokeOpacity=".35" strokeWidth="1.5" />
    <text x={x + 13} y="33" fontSize="16" textAnchor="middle" fill={color}>
      {suit}
    </text>
  </g>
);

const ART: Record<ArtKind, ReactNode> = {
  disk: (
    <>
      <path d="M10 46A30 30 0 0 1 70 46Z" fill={PALE} stroke={ACCENT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M40 46L58 24" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="46" r="4" fill={ACCENT} />
    </>
  ),
  poll: (
    <>
      <rect x="12" y="10" width="44" height="9" rx="4.5" fill={ACCENT} />
      <rect x="12" y="23" width="56" height="9" rx="4.5" fill={GREEN} />
      <rect x="12" y="36" width="28" height="9" rx="4.5" fill={RED} />
    </>
  ),
  wheel: (
    <>
      <g transform="translate(40 28)">
        <path d="M0 0L0-21A21 21 0 0 1 21 0Z" fill={YELLOW} />
        <path d="M0 0L21 0A21 21 0 0 1 0 21Z" fill={RED} />
        <path d="M0 0L0 21A21 21 0 0 1-21 0Z" fill={GREEN} />
        <path d="M0 0L-21 0A21 21 0 0 1 0-21Z" fill={BLUE} />
        <circle r="4" fill="#fff" stroke={INK} strokeWidth="1.5" />
      </g>
      <path d="M40 2l-5 7h10z" fill={INK} />
    </>
  ),
  chat: (
    <>
      <rect x="8" y="8" width="40" height="22" rx="8" fill={ACCENT} />
      <path d="M16 30l-4 7 11-7z" fill={ACCENT} />
      <rect x="32" y="22" width="40" height="20" rx="8" fill={PALE} stroke={ACCENT} strokeWidth="2" />
      <path d="M62 42l5 6-11-6z" fill={PALE} stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  cards: (
    <>
      <Card x={18} angle={-12} at="34 28" suit="♠" color={INK} />
      <Card x={36} angle={10} at="48 28" suit="♥" color="#d93d42" />
    </>
  ),
  web: (
    <>
      <rect x="8" y="6" width="64" height="40" rx="5" fill="#1b4b6e" />
      <rect x="8" y="6" width="64" height="9" rx="4" fill="#2a6f97" />
      <circle cx="14" cy="10.5" r="1.8" fill="#fff" />
      <circle cx="20" cy="10.5" r="1.8" fill="#fff" />
      <path d="M34 22v16l13-8z" fill={YELLOW} />
    </>
  ),
};

export const ActivityArt = ({ kind }: { kind: ArtKind }) => (
  <svg className="act-art" viewBox="0 0 80 52" aria-hidden="true">
    {ART[kind]}
  </svg>
);
