// A card in SVG (viewBox 60 × 84), the same for every game: a small rounded rectangle; at the top, the value on the
// left and the suit (emoji) on the right; the same at the bottom, turned upside down (readable either way); a big suit
// in the middle. Its back: blue, a frame and crossed lines. Their look: cards.css (.card-svg, .cbg, .cv…), a light
// face in both themes. A game's own card (the Tarot's trumps…) lives with the game.
import type { ReactNode } from 'react';
import { cls } from '../../design';
import { isRed, SUIT_EMOJI, type Suit } from './model';

export interface PlayingCardProps {
  /** What the corners say: « 7 », « D », « 10 »… */
  value: string;
  suit: Suit;
  /** Its name, said to screen readers: « Dame de cœur ». */
  label: string;
  /** `small` (the rules' examples)… */
  className?: string;
}

export function PlayingCard({ value, suit, label, className }: PlayingCardProps) {
  const corner = (
    <>
      <text x="6" y="17" className="cv">
        {value}
      </text>
      <text x="54" y="16" className="cs" textAnchor="end">
        {SUIT_EMOJI[suit]}
      </text>
    </>
  );
  return (
    <svg
      className={cls('card-svg', isRed(suit) ? 'red' : 'black', className)}
      viewBox="0 0 60 84"
      role="img"
      aria-label={label}
    >
      <rect className="cbg" x=".75" y=".75" width="58.5" height="82.5" rx="7" />
      <g className="corner-top">{corner}</g>
      <g className="corner-bottom" transform="rotate(180 30 42)">
        {corner}
      </g>
      <text x="30" y="49" className="cc" textAnchor="middle">
        {SUIT_EMOJI[suit]}
      </text>
    </svg>
  );
}

/** A card face down (`mini`: the count of a seat's cards). */
export const CardBack = ({ className }: { className?: string }) => (
  <svg className={cls('card-svg back', className)} viewBox="0 0 60 84" aria-hidden="true">
    <rect className="cbk" x=".75" y=".75" width="58.5" height="82.5" rx="7" />
    <rect className="cbk-in" x="6" y="6" width="48" height="72" rx="4" />
    <path className="cbk-l" d="M6 6L54 78M54 6L6 78M30 6V78M6 42H54" />
  </svg>
);

/** A row of cards in the rules' text. */
export const RuleCards = ({ children }: { children: ReactNode }) => <span className="rule-cards">{children}</span>;
