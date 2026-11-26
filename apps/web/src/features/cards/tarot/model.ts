// The Tarot's table in words and shapes (no DOM): the trumps' default dressing and their corner box, the bids, what
// the middle of the table says, the count's line, which of my cards can be chosen, my choice. The rules of the game
// themselves: engines' Tarot.
import { Tarot as TA } from '@slopesque/engines';
import { SUIT_EMOJI } from '../model';

type Bid = TA.Bid;
type Tarot = TA.Tarot;
type TCard = TA.TCard;
const { BIDS } = TA;

/** The default dressing of the trumps: an emoji each (0: the Excuse, the jester). */
export const TRUMP_EMOJI = [
  '🤡',
  '🐣',
  '🎈',
  '🎨',
  '🎻',
  '🎪',
  '🌻',
  '🚲',
  '⛵',
  '🏰',
  '🎡',
  '🌋',
  '🐉',
  '🦁',
  '🦅',
  '🌙',
  '🔥',
  '⭐',
  '🌊',
  '☀️',
  '🌈',
  '👑',
];
export const trumpLabel = (n: number) => (n === 0 ? '★' : String(n));
/** The two colours of a trump's default background (a diagonal gradient), different for each. */
export const trumpColors = (n: number) => {
  const hue = (210 + n * 17) % 360;
  return [`hsl(${hue} 70% 80%)`, `hsl(${(hue + 40) % 360} 55% 52%)`] as const;
};

// A trump's picture inside a white inner border (I from the edge); the number's box, top left (the bottom-right one is
// the same, turned): W × H from the inner border, its free corner rounded (R), concave curves (F) where it meets the
// border, so that the white flows from the border.
export const INSET = 3.5;
const I = INSET,
  W = 16,
  H = 17,
  R = 5,
  F = 4;
export const CORNER_BOX = `M${I} ${I}H${I + W + F}A${F} ${F} 0 0 0 ${I + W} ${I + F}V${I + H - R}A${R} ${R} 0 0 1 ${I + W - R} ${I + H}H${I + F}A${F} ${F} 0 0 0 ${I} ${I + H + F}Z`;
/** The number's place in its box. */
export const CORNER_TEXT = { x: I + W / 2, y: I + H / 2 + 0.5 };

export const BID_ORDER: Bid[] = ['pass', 'prise', 'garde', 'sans', 'contre'];
export const bidName = (b: Bid) => (b === 'pass' ? 'Passe' : BIDS[b].name);
/** What the player whose turn it is has to do, by phase. */
export const DOING: Record<Tarot['phase'], string> = {
  bid: 'parler',
  call: 'appeler un Roi',
  dog: "faire l'écart",
  play: 'jouer',
  done: '',
};

/** The highest bid said so far (null: everyone passed, or no one spoke). */
export function bestBid(t: Tarot) {
  const said = Object.values(t.bids).filter((b): b is Exclude<Bid, 'pass'> => b !== 'pass');
  return said.length ? said.reduce((a, b) => (BIDS[b].mult > BIDS[a].mult ? b : a)) : null;
}

/** The trick just completed, still on the table until it goes to its winner (`showLast`). */
export const closedTrick = (t: Tarot, showLast: boolean) =>
  t.phase === 'play' && !t.trick.length && t.lastTrick.length > 0 && showLast;

/** The line under the middle of the table: the bids, the call, the chien, the trick (what is asked), by phase. */
export function pileText(t: Tarot, me: string, name: (seat: string) => string, showLast: boolean) {
  if (t.phase === 'bid') {
    const best = bestBid(t);
    return best
      ? `Enchère la plus haute : ${bidName(best)}`
      : 'Enchères : chacun parle une fois, plus haut que le précédent, ou passe';
  }
  if (t.phase === 'call')
    return t.taker === me
      ? "À 5 : appelle un Roi — celui qui l'a sera ton partenaire, sans le dire, jusqu'à ce qu'il le joue"
      : `${name(t.taker!)} appelle un Roi…`;
  if (t.phase === 'dog')
    return `Le chien, pris par ${name(t.taker!)} : ${t.taker === me ? `écarte-en ${TA.ecartSize(t)} (ni Roi ni bout)` : 'il fait son écart…'}`;
  if (t.phase !== 'play') return '';
  if (closedTrick(t, showLast)) return `${name(t.lastWinner!)} remporte le pli`;
  if (!t.trick.length && t.lastWinner) return `${name(t.lastWinner)} ouvre`;
  const lead = t.trick.find(p => p.card.kind !== 'excuse')?.card;
  if (!lead) return "À l'entame";
  return lead.kind === 'trump'
    ? 'Atout demandé : monte si tu peux'
    : `${SUIT_EMOJI[lead.s!]} demandé : fournis, sinon coupe (et surcoupe)`;
}

/** The deal's end: who won or fell. */
export function resultTitle(t: Tarot, name: (seat: string) => string) {
  const r = t.result!;
  const verb = r.won ? (r.partner ? 'gagnent' : 'gagne') : r.partner ? 'chutent' : 'chute';
  return `Donne ${t.deal} : ${name(r.taker)}${r.partner ? ` et ${name(r.partner)}` : ''} ${verb}`;
}

/** The deal's count in one line: contract, bouts, points to make and made, then the mark and how it is computed. */
export function resultLine(t: Tarot) {
  const r = t.result!,
    alone = t.seats.length === 5 && !r.partner;
  const sign = (n: number) => (n > 0 ? '+' : '−');
  return (
    `${BIDS[r.bid].name} · ${r.bouts} bout${r.bouts > 1 ? 's' : ''} → ${r.need} points à faire · ${String(r.made).replace('.', ',')} faits` +
    ` → ${r.won ? '' : '−'}(25 + ${Math.round(Math.abs(r.made - r.need))})` +
    (r.petit ? ` ${r.petit === 'taker' ? '+' : '−'} 10 (Petit au bout)` : '') +
    ` × ${BIDS[r.bid].mult}` +
    (r.handfuls ? ` ${sign(r.handfuls)} ${Math.abs(r.handfuls)} (poignée)` : '') +
    (r.chelem ? ` ${sign(r.chelem)} ${Math.abs(r.chelem)} (chelem)` : '') +
    ` = ${r.score}` +
    (t.seats.length === 5 ? (alone ? ' · seul contre 4 : × 4' : ' · preneur × 2, partenaire × 1') : '')
  );
}

/** My hand now: `active` when I choose (my card to play, my écart), `ok` the cards I may choose (all of them else). */
export function handState(t: Tarot, me: string) {
  const mine = t.hands[me] ?? [],
    myTurn = t.turn === me,
    dog = t.phase === 'dog' && t.taker === me;
  const ok = t.phase === 'play' && myTurn ? TA.legal(t, me) : dog ? mine.filter(cd => TA.canDiscard(t, cd)) : mine;
  return { ok: new Set(ok.map(cd => cd.id)), active: (t.phase === 'play' && myTurn) || dog };
}

/** A card clicked in my hand: in the écart, chosen or no longer (up to its size); in play, chosen, then clicked again
 *  to play it (`play`); else nothing. */
export function pick(
  t: Tarot,
  me: string,
  chosen: ReadonlySet<string>,
  id: string,
): { chosen: ReadonlySet<string> } | { play: string } | null {
  const card = (t.hands[me] ?? []).find(x => x.id === id);
  if (!card) return null;
  if (t.phase === 'dog' && t.taker === me) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else if (TA.canDiscard(t, card) && next.size < TA.ecartSize(t)) next.add(id);
    return { chosen: next };
  }
  if (t.phase === 'play' && t.turn === me && TA.legal(t, me).some(x => x.id === id))
    return chosen.has(id) ? { play: id } : { chosen: new Set([id]) };
  return null;
}

/** My trumps and bouts (a badge by my buttons). */
export const trumpCount = (hand: TCard[]) => ({
  trumps: hand.filter(cd => cd.kind !== 'suit').length,
  bouts: hand.filter(TA.isBout).length,
});

/** The rules' example cards: a suit card, a trump (0: the Excuse). */
export const suitCard = (s: 'S' | 'H' | 'D' | 'C', r: number): TCard => ({ id: `${s}${r}`, kind: 'suit', r, s });
export const trumpCard = (r: number): TCard => ({ id: `T${r}`, kind: r ? 'trump' : 'excuse', r });
