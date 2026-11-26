// The Tarot's cards: a trump (atout) — a white card with an inner white border, the picture inside (an image the
// host chose, or by default a coloured background with an emoji), the number in the top-left and bottom-right corners
// on a white box whose free corner is rounded and whose edges flow into the border with small concave curves — the
// suit cards (as the other games'), and a card in short (« R ♥️ »). The room's pictures of the trumps come from
// TrumpArtContext (CardsStage gives them): a card is drawn again only when its own picture changes.
import { createContext, memo, useContext, useId } from 'react';
import { Tarot as TA } from '@slopesque/engines';
import { cls } from '../../../design';
import { isRed, SUIT_EMOJI } from '../model';
import { PlayingCard } from '../PlayingCard';
import { CORNER_BOX, CORNER_TEXT, INSET as I, TRUMP_EMOJI, trumpColors, trumpLabel } from './model';

type TCard = TA.TCard;
const IW = 60 - 2 * I,
  IH = 84 - 2 * I;

/** The room's pictures of the trumps (« 0 » the Excuse … « 21 »), their address. */
export const TrumpArtContext = createContext<Record<string, string>>({});

/** A trump (1 … 21) or the Excuse (0): its picture (an image, or the default dressing) inside a white inner border. */
export function TrumpCard({ n, art, className }: { n: number; art?: string; className?: string }) {
  const id = useId().replace(/[^\w-]/g, ''), // this card's clip and gradient: ids unique in the page
    [from, to] = trumpColors(n);
  const corner = (
    <>
      <path className="tbox" d={CORNER_BOX} />
      <text className="tv" x={CORNER_TEXT.x} y={CORNER_TEXT.y} textAnchor="middle">
        {trumpLabel(n)}
      </text>
    </>
  );
  return (
    <svg
      className={cls('card-svg trump', n === 0 && 'excuse', art && 'has-art', className)}
      viewBox="0 0 60 84"
      role="img"
      aria-label={n === 0 ? "L'Excuse" : `Atout ${n}`}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x={I} y={I} width={IW} height={IH} rx="4.5" />
        </clipPath>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect className="tbg" x=".75" y=".75" width="58.5" height="82.5" rx="7" />
      <g clipPath={`url(#${id}-clip)`}>
        {art ? (
          <image href={art} x={I} y={I} width={IW} height={IH} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect x={I} y={I} width={IW} height={IH} fill={`url(#${id}-bg)`} />
            <text x="30" y="45" className="temoji" textAnchor="middle">
              {TRUMP_EMOJI[n]}
            </text>
          </>
        )}
      </g>
      <rect className="tline" x={I} y={I} width={IW} height={IH} rx="4.5" />
      <g className="corner-top">{corner}</g>
      <g className="corner-bottom" transform="rotate(180 30 42)">
        {corner}
      </g>
    </svg>
  );
}

/** Any Tarot card: a trump, the Excuse (with the room's picture), or a suit card (1 … 10, V, C, D, R). */
export const TarotCard = memo(
  function TarotCard({ card, className }: { card: TCard; className?: string }) {
    const art = useContext(TrumpArtContext);
    return card.kind === 'suit' ? (
      <PlayingCard value={TA.suitLabel(card.r)} suit={card.s!} label={TA.cardName(card)} className={className} />
    ) : (
      <TrumpCard n={card.r} art={art[String(card.r)]} className={className} />
    );
  },
  (a, b) => a.card.id === b.card.id && a.className === b.className,
);

/** A card in short, readable at a glance: its letter and its suit (« R ♥️ »), or a trump's number. */
export const MiniCard = ({ card }: { card: TCard }) =>
  card.kind === 'suit' ? (
    <span className={cls('mini-card', isRed(card.s!) && 'red')} title={TA.cardName(card)}>
      {TA.suitLabel(card.r)}
      {SUIT_EMOJI[card.s!]}
    </span>
  ) : (
    <span className="mini-card trump" title={TA.cardName(card)}>
      {card.kind === 'excuse' ? '★' : card.r}
    </span>
  );
