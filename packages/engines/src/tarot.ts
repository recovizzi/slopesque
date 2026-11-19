// French Tarot at 4 or 5 players (FFT rules), played by the server: 78 cards — 4 suits of 14 (1 … 10, Valet, Cavalier,
// Dame, Roi), 21 trumps (atouts) and the Excuse. A deal at 4: 18 cards each, a chien of 6; at 5: 15 each, a chien of 3,
// and the taker calls a King (a Queen if he has the 4 Kings, a Cavalier if the 4 Queens too) before the chien: its
// holder is his secret partner, known when the card is played (called himself, or the card in the chien: alone, ×4;
// else taker ×2, partner ×1, each defender −1). Bids (Prise ×1, Garde ×2, Garde sans
// ×4, Garde contre ×6), the taker's écart (no King, no bout), tricks (follow suit; else trump, overtrumping if
// possible; on a trump lead, a higher trump if possible), then the count: the bouts (1, 21, Excuse) in the taker's
// tricks set the points to make (56 / 51 / 41 / 36 out of 91); score = (25 + |difference|) × the contract; the taker
// gets it 3 times, each defender once (or the opposite). Petit au bout, poignées and chelem: the V1 (card-games spec).
// The robots are simple; they play on what their seat may see (tarotView): at 5 they don't « know » the partner.
import { shuffle as mix, type Suit } from './tdc.js';

export type Kind = 'suit' | 'trump' | 'excuse';
/** A card: a suit card (r 1 … 14: 11 Valet, 12 Cavalier, 13 Dame, 14 Roi), a trump (r 1 … 21) or the Excuse (r 0). */
export interface TCard { id: string; kind: Kind; r: number; s?: Suit }
export type Bid = 'pass' | 'prise' | 'garde' | 'sans' | 'contre';
export const BIDS: Record<Exclude<Bid, 'pass'>, { name: string; mult: number }> = {
  prise: { name: 'Prise', mult: 1 }, garde: { name: 'Garde', mult: 2 }, sans: { name: 'Garde sans', mult: 4 }, contre: { name: 'Garde contre', mult: 6 },
};
const ORDER: Bid[] = ['pass', 'prise', 'garde', 'sans', 'contre'];
export const NEED = [56, 51, 41, 36];   // points to make, by the number of bouts

export interface TPlay { by: string; card: TCard }
export interface TResult { taker: string; partner: string | null; bid: Exclude<Bid, 'pass'>; bouts: number; need: number; made: number; won: boolean; score: number; marks: Record<string, number> }
export interface Tarot {
  seats: string[];                       // 4 or 5 players; the dealer is the last, the first bids and leads
  hands: Record<string, TCard[]>;
  chien: TCard[];
  phase: 'bid' | 'call' | 'dog' | 'play' | 'done';
  called: TCard | null;                  // at 5: the card the taker called
  partner: string | null;                // … who holds it (the taker himself, or null if it is in the chien)
  revealed: boolean;                     // … the called card has been played: everyone knows the partner
  bids: Record<string, Bid>;
  turn: string | null;
  taker: string | null;
  bid: Exclude<Bid, 'pass'> | null;
  ecart: TCard[];                        // the taker's discards (or the chien, for Garde sans / contre)
  trick: TPlay[];
  lastTrick: TPlay[];
  won: Record<string, TCard[]>;          // the cards of each player's tricks (the count)
  tricks: Record<string, TPlay[][]>;     // each player's won tricks, as played (to look at them again)
  lastWinner: string | null;             // who took the last trick
  deal: number;
  startedAt: number;
  result: TResult | null;
  note: string;                          // « Tout le monde a passé : nouvelle donne. »
}

const SUITS: Suit[] = ['S', 'H', 'C', 'D'];   // in the hand: black, red, black, red
export const isBout = (c: TCard) => c.kind === 'excuse' || (c.kind === 'trump' && (c.r === 1 || c.r === 21));
/** Card points (×2 to stay in integers: the deck makes 182 half-points = 91). */
export function halfPoints(c: TCard) {
  if (isBout(c)) return 9;
  if (c.kind === 'trump') return 1;
  return c.r === 14 ? 9 : c.r === 13 ? 7 : c.r === 12 ? 5 : c.r === 11 ? 3 : 1;
}
export const points = (cs: TCard[]) => cs.reduce((s, c) => s + halfPoints(c), 0) / 2;
export const suitLabel = (r: number) => ({ 11: 'V', 12: 'C', 13: 'D', 14: 'R' } as Record<number, string>)[r] ?? String(r);
export const cardName = (c: TCard) => (c.kind === 'excuse' ? 'l\'Excuse' : c.kind === 'trump' ? (c.r === 1 ? 'le Petit' : `le ${c.r} d'atout`)
  : `${({ 11: 'Valet', 12: 'Cavalier', 13: 'Dame', 14: 'Roi' } as Record<number, string>)[c.r] ?? c.r} de ${({ S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' })[c.s!]}`);

export function deck(): TCard[] {
  const suits = SUITS.flatMap(s => Array.from({ length: 14 }, (_, i) => ({ id: `${s}${i + 1}`, kind: 'suit' as Kind, r: i + 1, s })));
  const trumps = Array.from({ length: 21 }, (_, i) => ({ id: `T${i + 1}`, kind: 'trump' as Kind, r: i + 1 }));
  return [...suits, ...trumps, { id: 'EX', kind: 'excuse', r: 0 }];
}

/** The hand's order: the suits (alternating colours), then the trumps, the Excuse last. */
export function sortHand(cs: TCard[]) {
  const key = (c: TCard) => (c.kind === 'suit' ? SUITS.indexOf(c.s!) * 100 + c.r : c.kind === 'trump' ? 1000 + c.r : 2000);
  return cs.sort((a, b) => key(a) - key(b));
}

const shuffle = mix;

/** A new deal for these 4 or 5 seats; with the same players as before, the seats turn (the first player bids and
 *  leads; next deal, the next one). */
export function deal(seats: string[], prev: Tarot | null): Tarot {
  const same = prev && prev.seats.length === seats.length && prev.seats.every(id => seats.includes(id));
  const order = same ? [...prev!.seats.slice(1), prev!.seats[0]] : seats;
  const n = order.length === 5 ? 15 : 18, cards = shuffle(deck()), hands: Record<string, TCard[]> = {};
  order.forEach((id, k) => { hands[id] = sortHand(cards.slice(k * n, k * n + n)); });
  return { seats: order, hands, chien: cards.slice(order.length * n), phase: 'bid', bids: {}, turn: order[0], taker: null, bid: null, called: null, partner: null, revealed: false, ecart: [], trick: [], lastTrick: [],
    won: Object.fromEntries(order.map(id => [id, []])), tricks: Object.fromEntries(order.map(id => [id, []])), lastWinner: null, deal: (prev?.deal ?? 0) + 1, startedAt: prev?.startedAt ?? Date.now(), result: null, note: '' };
}

const best = (t: Tarot) => Object.values(t.bids).reduce((m, b) => (ORDER.indexOf(b) > ORDER.indexOf(m) ? b : m), 'pass' as Bid);
/** The bids still possible for a player: pass, or higher than the best so far. */
export const bidsFor = (t: Tarot) => ORDER.filter(b => b === 'pass' || ORDER.indexOf(b) > ORDER.indexOf(best(t))) as Bid[];
const nextSeat = (t: Tarot, id: string) => t.seats[(t.seats.indexOf(id) + 1) % t.seats.length];

/** A bid; after the 4: a taker (the chien shown for Prise and Garde) or, if all passed, a new deal. */
export function bid(t: Tarot, id: string, b: Bid) {
  if (t.phase !== 'bid' || t.turn !== id || !bidsFor(t).includes(b)) return false;
  t.bids[id] = b;
  if (Object.keys(t.bids).length < t.seats.length) { t.turn = nextSeat(t, id); return true; }
  const top = best(t);
  if (top === 'pass') { t.phase = 'done'; t.turn = null; t.note = 'Tout le monde a passé : nouvelle donne.'; return true; }
  t.taker = t.seats.find(s => t.bids[s] === top)!;
  t.bid = top as Exclude<Bid, 'pass'>;
  if (t.seats.length === 5) { t.phase = 'call'; t.turn = t.taker; return true; }   // at 5: a King called first
  afterCall(t);
  return true;
}

function afterCall(t: Tarot) {
  if (t.bid === 'sans' || t.bid === 'contre') { t.ecart = t.chien; t.phase = 'play'; t.turn = t.seats[0]; }
  else { t.hands[t.taker!] = sortHand([...t.hands[t.taker!], ...t.chien]); t.phase = 'dog'; t.turn = t.taker; }
}

/** At 5, the cards the taker may call: the 4 Kings; a Queen if he has the 4 Kings; a Cavalier if the 4 Queens too. */
export function callable(t: Tarot): TCard[] {
  const h = t.hands[t.taker!];
  for (const r of [14, 13, 12]) {
    if (h.filter(c => c.kind === 'suit' && c.r === r).length < 4) return SUITS.map(s => ({ id: `${s}${r}`, kind: 'suit' as Kind, r, s }));
  }
  return SUITS.map(s => ({ id: `${s}11`, kind: 'suit' as Kind, r: 11, s }));
}

/** The taker calls a card: its holder is his partner (himself, or nobody if it is in the chien: he plays alone). */
export function call(t: Tarot, id: string, cardId: string) {
  const c = callable(t).find(x => x.id === cardId);
  if (t.phase !== 'call' || t.turn !== id || !c) return false;
  t.called = c;
  t.partner = t.seats.find(s => t.hands[s].some(x => x.id === c.id)) ?? null;
  afterCall(t);
  return true;
}

/** The écart: as many cards as the chien had (6 at 4, 3 at 5). */
export const ecartSize = (t: Tarot) => (t.seats.length === 5 ? 3 : 6);

/** What may go in the écart: no King, no bout; a trump only if nothing else is left. */
export function canDiscard(t: Tarot, c: TCard) {
  if (c.kind === 'excuse' || isBout(c) || (c.kind === 'suit' && c.r === 14)) return false;
  if (c.kind === 'trump') return t.hands[t.taker!].filter(x => x.kind === 'suit' && x.r !== 14).length < ecartSize(t);
  return true;
}

export function discard(t: Tarot, cards: TCard[]) {
  if (t.phase !== 'dog' || cards.length !== ecartSize(t) || !cards.every(c => canDiscard(t, c))) return false;
  t.hands[t.taker!] = t.hands[t.taker!].filter(c => !cards.some(x => x.id === c.id));
  t.ecart = cards;
  t.phase = 'play'; t.turn = t.seats[0];
  return true;
}

/** The cards a player may play now (following, trumping, overtrumping; the Excuse always). */
export function legal(t: Tarot, id: string): TCard[] {
  const hand = t.hands[id];
  const lead = t.trick.find(p => p.card.kind !== 'excuse')?.card;   // the Excuse led: the next card sets the suit
  const first = Object.values(t.won).every(w => !w.length);
  if (!t.trick.length && first && t.called) {   // at 5, the first lead: not in the called suit, except the called card
    const ok = hand.filter(c => c.kind !== 'suit' || c.s !== t.called!.s || c.id === t.called!.id);
    return ok.length ? ok : hand;
  }
  if (!lead) return hand;
  const trumps = hand.filter(c => c.kind === 'trump'), ex = hand.filter(c => c.kind === 'excuse');
  const topTrump = Math.max(0, ...t.trick.filter(p => p.card.kind === 'trump').map(p => p.card.r));
  const over = trumps.filter(c => c.r > topTrump);
  if (lead.kind === 'trump') return trumps.length ? [...(over.length ? over : trumps), ...ex] : hand;
  const follow = hand.filter(c => c.kind === 'suit' && c.s === lead.s);
  if (follow.length) return [...follow, ...ex];
  if (trumps.length) return [...(over.length ? over : trumps), ...ex];
  return hand;
}

/** Who takes the trick: the highest trump, else the highest card of the suit led (never the Excuse). */
function winner(trick: TPlay[]) {
  const lead = trick.find(p => p.card.kind !== 'excuse')?.card;
  if (!lead) return trick[0].by;   // only the Excuse so far (led): nobody beats it yet
  const trumps = trick.filter(p => p.card.kind === 'trump');
  if (trumps.length) return trumps.reduce((a, b) => (b.card.r > a.card.r ? b : a)).by;
  return trick.filter(p => p.card.kind === 'suit' && p.card.s === lead?.s).reduce((a, b) => (b.card.r > a.card.r ? b : a)).by;
}

export function play(t: Tarot, id: string, card: TCard) {
  if (t.phase !== 'play' || t.turn !== id || !legal(t, id).some(c => c.id === card.id)) return false;
  t.hands[id] = t.hands[id].filter(c => c.id !== card.id);
  if (t.called?.id === card.id) t.revealed = true;   // the partner is known
  if (!t.trick.length) t.lastTrick = [];
  t.trick.push({ by: id, card });
  if (t.trick.length < t.seats.length) { t.turn = nextSeat(t, id); return true; }
  const w = winner(t.trick), last = Object.values(t.hands).every(h => !h.length);
  for (const p of t.trick) {   // the Excuse stays with its owner's side (on the last trick: to the trick's winner)
    const to = p.card.kind === 'excuse' && !last ? p.by : w;
    t.won[to].push(p.card);
  }
  t.tricks[w].push(t.trick);
  t.lastWinner = w;
  t.lastTrick = t.trick; t.trick = [];
  if (last) { count(t); return true; }
  t.turn = w;
  return true;
}

function count(t: Tarot) {
  const taker = t.taker!, bidT = t.bid!, partner = t.partner && t.partner !== taker ? t.partner : null;
  const mine = [...t.won[taker], ...(partner ? t.won[partner] : []), ...(bidT === 'contre' ? [] : t.ecart)];
  const bouts = mine.filter(isBout).length, need = NEED[bouts], made = points(mine);
  const won = made >= need, base = (25 + Math.round(Math.abs(made - need))) * BIDS[bidT].mult, score = won ? base : -base;
  const defenders = t.seats.length - 1 - (partner ? 1 : 0);   // the marks add up to 0
  const marks = Object.fromEntries(t.seats.map(id => [id, id === taker ? (defenders - (partner ? 1 : 0)) * score : id === partner ? score : -score]));
  t.result = { taker, partner, bid: bidT, bouts, need, made, won, score, marks };
  t.phase = 'done'; t.turn = null;
}

// ------------------------------------------------------------------ MOCKUP: simple bots
/** A bot's bid from the strength of its hand (trumps, bouts, Kings, long suits). */
export function botBid(t: Tarot, id: string): Bid {
  const h = t.hands[id], trumps = h.filter(c => c.kind === 'trump'), bouts = h.filter(isBout).length;
  const kings = h.filter(c => c.kind === 'suit' && c.r === 14).length, high = trumps.filter(c => c.r >= 16).length;
  const s = trumps.length * 2 + high * 2 + bouts * 6 + kings * 3;
  const want: Bid = s >= 46 ? 'contre' : s >= 40 ? 'sans' : s >= 30 ? 'garde' : s >= 24 ? 'prise' : 'pass';
  return bidsFor(t).includes(want) ? want : 'pass';
}

/** The bot's call: the King (Queen…) of the suit it holds most of, not its own if it can. */
export function botCall(t: Tarot): string {
  const h = t.hands[t.taker!], len = (s?: Suit) => h.filter(c => c.s === s).length;
  const options = callable(t).sort((a, b) => Number(h.some(c => c.id === a.id)) - Number(h.some(c => c.id === b.id)) || len(b.s) - len(a.s));
  return options[0].id;
}

/** The bot's écart: the lowest cards of its shortest suits (no King, no bout). */
export function botDiscard(t: Tarot): TCard[] {
  const h = t.hands[t.taker!], len = (s?: Suit) => h.filter(c => c.s === s).length;
  return h.filter(c => canDiscard(t, c)).sort((a, b) => (a.kind === 'trump' ? 1 : 0) - (b.kind === 'trump' ? 1 : 0) || len(a.s) - len(b.s) || halfPoints(a) - halfPoints(b) || a.r - b.r).slice(0, ecartSize(t));
}

/** The bot's card: it wins cheaply when it can, else gives its lowest; its own side winning, it gives points. */
export function botPlay(t: Tarot, id: string): TCard {
  const ok = legal(t, id).filter(c => c.kind !== 'excuse' || t.hands[id].length <= 2 || legal(t, id).length === 1);
  const cards = ok.length ? ok : legal(t, id), low = (cs: TCard[]) => [...cs].sort((a, b) => halfPoints(a) - halfPoints(b) || a.r - b.r)[0];
  if (!t.trick.length) {
    if (id === t.taker) { const tr = cards.filter(c => c.kind === 'trump' && c.r > 15 && c.r !== 21); if (tr.length) return tr[tr.length - 1]; }
    return low(cards.filter(c => c.kind === 'suit').length ? cards.filter(c => c.kind === 'suit') : cards);
  }
  const side = (x: string) => x === t.taker || x === t.partner;   // on the seat's view: the partner once revealed, or to himself
  const w = winner(t.trick), same = (a: string) => side(a) === side(id);
  if (same(w) && t.trick.length === t.seats.length - 1) return [...cards].sort((a, b) => halfPoints(b) - halfPoints(a) || b.r - a.r).find(c => c.kind !== 'trump' || c.r !== 1) ?? low(cards);
  const beats = cards.filter(c => winner([...t.trick, { by: id, card: c }]) === id && !(c.kind === 'trump' && c.r === 1));
  return beats.length ? low(beats) : low(cards);
}

/** What a seat sees: its own hand (the others' as backs), the chien and the écart only for the taker while he makes
 *  it, the partner at 5 only once revealed (or to himself). */
export function tarotView(t: Tarot, seat: string | null): Tarot {
  const back = (cs: TCard[]) => cs.map((_, i) => ({ id: `x${i}`, kind: 'suit' as Kind, r: 0, s: 'S' as Suit }));
  const taker = seat !== null && seat === t.taker;
  return { ...t,
    hands: Object.fromEntries(Object.entries(t.hands).map(([id, h]) => [id, id === seat ? h : back(h)])),
    chien: taker && t.phase === 'dog' ? t.chien : back(t.chien),
    ecart: taker || t.phase === 'done' ? t.ecart : back(t.ecart),
    partner: t.revealed || t.phase === 'done' || (seat !== null && seat === t.partner) ? t.partner : null };
}
