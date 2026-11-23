// La Coinche (belote coinchée), played by the server (openspec: card-games, Coinche; plan-slopesque-v1 decision 22):
// 4 seats in two teams facing each other (seats 0 and 2, 1 and 3), 32 cards, a game up to a target. A deal: 8 cards
// each; the bidding (80 … 160 by 10 with a trump suit, or capot; coinche ×2 by an opponent in turn, which ends the
// bidding, then surcoinche ×4 by the bidders); the tricks (follow; on a trump lead, go higher if possible; without the
// suit, trump unless the partner is master; over an opponent's trump, overtrump if possible, else a lower trump);
// the count (trump J 20, 9 14, A 11, 10 10, K 4, Q 3; plain A 11, 10 10, K 4, Q 3, J 2; the last trick 10; all the
// tricks 250; belote 20 to its team), the contract made with the bid and 82 at least. The robots play on what their
// seat may see (coincheView).
import { shuffle, type Suit } from './tdc.js';

/** A card: r 7 … 14 (11 Valet, 12 Dame, 13 Roi, 14 As). */
export interface CCard { id: string; r: number; s: Suit }
export interface CPlay { by: string; card: CCard }
export type Speech = { by: string; kind: 'pass' } | { by: string; kind: 'bid'; value: number; suit: Suit } | { by: string; kind: 'coinche' } | { by: string; kind: 'surcoinche' };
export type Say = { kind: 'pass' } | { kind: 'bid'; value: number; suit: Suit } | { kind: 'coinche' } | { kind: 'surcoinche' };
export interface Contract { by: string; value: number; suit: Suit; mult: 1 | 2 | 4 }
export const CAPOT = 250;
export const VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, CAPOT];
export const TARGETS = [1000, 1500, 2000];
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const SUIT_NAME: Record<Suit, string> = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
export const SUIT_SIGN: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export interface DealResult {
  attack: 0 | 1;                         // the bidders' team
  contract: Contract;
  points: [number, number];              // the cards' points (and the last trick) of each team: 162, or 250 for all the tricks
  belote: 0 | 1 | null;                  // the team that had belote-rebelote
  made: boolean;
  score: [number, number];               // what each team scores for this deal
  capot: 0 | 1 | null;                   // the team that took all the tricks
}
export interface Coinche {
  seats: string[];                       // 4, in table order; teams: 0 & 2, 1 & 3
  dealer: string;
  hands: Record<string, CCard[]>;
  phase: 'bid' | 'play' | 'done';
  speeches: Speech[];                    // the bidding of this deal, in order
  contract: Contract | null;             // the highest bid so far, then the deal's contract
  passes: number;                        // passes in a row since the last bid
  coincheBy: string | null;
  answer: string[];                      // after a coinche: the bidders who may still surcoinche, in turn
  turn: string | null;
  trick: CPlay[];
  lastTrick: CPlay[];
  lastWinner: string | null;
  tricks: Record<string, CPlay[][]>;     // each seat's won tricks
  winners: string[];                     // who took each trick
  belote: { by: string | null; said: number };   // the holder of the trump King and Queen; « Belote » (1), « Rebelote » (2)
  scores: [number, number];              // the game's scores (team 0, team 1)
  target: number;
  deal: number;
  startedAt: number;
  result: DealResult | null;
  history: { deal: number; contract: Contract | null; score: [number, number] }[];   // the score sheet
  note: string;                          // « Tout le monde a passé : nouvelle donne. »
  over: boolean;
  winner: 0 | 1 | null;                  // the team that won the game
}

// ------------------------------------------------------------------ cards
const RANKS = [7, 8, 9, 10, 11, 12, 13, 14];
export function deck(): CCard[] { return SUITS.flatMap(s => RANKS.map(r => ({ id: `${s}${r}`, r, s }))); }
export const card = (id: string): CCard => ({ id, s: id[0] as Suit, r: Number(id.slice(1)) });
const TRUMP_ORDER = [7, 8, 12, 13, 10, 14, 9, 11];   // weakest → strongest
const PLAIN_ORDER = [7, 8, 9, 11, 12, 13, 10, 14];
/** A card's strength in its suit (trump or not). */
export const power = (c: CCard, trump: Suit) => (c.s === trump ? 100 + TRUMP_ORDER.indexOf(c.r) : PLAIN_ORDER.indexOf(c.r));
const TRUMP_PTS: Record<number, number> = { 11: 20, 9: 14, 14: 11, 10: 10, 13: 4, 12: 3 };
const PLAIN_PTS: Record<number, number> = { 14: 11, 10: 10, 13: 4, 12: 3, 11: 2 };
export const points = (c: CCard, trump: Suit) => (c.s === trump ? TRUMP_PTS[c.r] ?? 0 : PLAIN_PTS[c.r] ?? 0);
export const rankLabel = (r: number) => ({ 11: 'V', 12: 'D', 13: 'R', 14: 'A' } as Record<number, string>)[r] ?? String(r);
export const rankName = (r: number) => ({ 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' } as Record<number, string>)[r] ?? String(r);
export const cardName = (c: CCard) => `${rankName(c.r)} de ${SUIT_NAME[c.s]}`;
export const contractName = (k: Pick<Contract, 'value' | 'suit' | 'mult'>) => `${k.value === CAPOT ? 'Capot' : k.value} ${SUIT_SIGN[k.suit]}${k.mult === 4 ? ' surcoinché' : k.mult === 2 ? ' coinché' : ''}`;
/** The hand's order: by suit (alternating colours), the trumps first once known, strongest first. */
export function sortHand(cs: CCard[], trump: Suit | null = null) {
  const order: Suit[] = trump ? [trump, ...(['S', 'H', 'C', 'D'] as Suit[]).filter(s => s !== trump)] : ['S', 'H', 'C', 'D'];
  return cs.sort((a, b) => order.indexOf(a.s) - order.indexOf(b.s) || power(b, trump ?? 'X' as Suit) - power(a, trump ?? 'X' as Suit));
}

// ------------------------------------------------------------------ the game
export const team = (c: Pick<Coinche, 'seats'>, s: string) => (c.seats.indexOf(s) % 2) as 0 | 1;
const next = (c: Pick<Coinche, 'seats'>, s: string, k = 1) => c.seats[(c.seats.indexOf(s) + k) % 4]!;
export const partnerOf = (c: Pick<Coinche, 'seats'>, s: string) => next(c, s, 2);

/** A new game (scores at 0): the dealer is the last seat, the first one speaks. */
export function newGame(seats: string[], target = 1000, now = Date.now()): Coinche {
  const c = { seats: [...seats], dealer: seats[3]!, scores: [0, 0], target, deal: 0, startedAt: now, history: [], over: false, winner: null } as unknown as Coinche;
  dealHand(c, false);
  return c;
}

/** The next deal: the dealer moves on (not before the first), 8 cards each, the bidding opens on his left. */
export function dealHand(c: Coinche, rotate = true) {
  if (rotate) c.dealer = next(c, c.dealer);
  const cards = shuffle(deck()), hands: Record<string, CCard[]> = {};
  for (let k = 0; k < 4; k++) { const s = next(c, c.dealer, k + 1); hands[s] = sortHand(cards.slice(k * 8, k * 8 + 8)); }
  Object.assign(c, { hands, phase: 'bid', speeches: [], contract: null, passes: 0, coincheBy: null, answer: [], turn: next(c, c.dealer), trick: [], lastTrick: [], lastWinner: null,
    tricks: Object.fromEntries(c.seats.map(s => [s, []])), winners: [], belote: { by: null, said: 0 }, result: null, note: '', deal: c.deal + 1 });
}

/** What a seat may say now: pass, a bid higher than the contract (its values), coinche, surcoinche. */
export function options(c: Coinche, s: string) {
  if (c.phase !== 'bid' || c.turn !== s) return null;
  if (c.coincheBy) return { pass: true, values: [] as number[], coinche: false, surcoinche: c.answer.includes(s) };
  const k = c.contract;
  return { pass: true, values: VALUES.filter(v => !k || v > k.value), coinche: !!k && k.value !== CAPOT && team(c, k.by) !== team(c, s), surcoinche: false };
}

/** A seat speaks; the bidding ends (play), or everyone passed (a new deal, said in `note`). */
export function bid(c: Coinche, s: string, say: Say) {
  const o = options(c, s);
  if (!o) return false;
  if (c.coincheBy) {   // the bidders answer the coinche
    if (say.kind !== 'pass' && say.kind !== 'surcoinche') return false;
    c.speeches.push({ by: s, kind: say.kind });
    c.answer = c.answer.filter(x => x !== s);
    if (say.kind === 'surcoinche') { c.contract!.mult = 4; return startPlay(c); }
    if (!c.answer.length) return startPlay(c);
    c.turn = c.answer[0]!;
    return true;
  }
  if (say.kind === 'pass') {
    c.speeches.push({ by: s, kind: 'pass' });
    c.passes++;
    if (c.contract && c.passes >= 3) return startPlay(c);
    if (!c.contract && c.passes >= 4) { c.phase = 'done'; c.turn = null; c.note = 'Tout le monde a passé : nouvelle donne.'; return true; }
    c.turn = next(c, s);
    return true;
  }
  if (say.kind === 'bid') {
    if (!o.values.includes(say.value) || !SUITS.includes(say.suit)) return false;
    c.speeches.push({ by: s, kind: 'bid', value: say.value, suit: say.suit });
    c.contract = { by: s, value: say.value, suit: say.suit, mult: 1 };
    c.passes = 0;
    if (say.value === CAPOT) return startPlay(c);   // the capot ends the bidding
    c.turn = next(c, s);
    return true;
  }
  if (say.kind === 'coinche') {
    if (!o.coinche) return false;
    c.speeches.push({ by: s, kind: 'coinche' });
    c.contract!.mult = 2;
    c.coincheBy = s;
    c.answer = [next(c, s), next(c, s, 3)];   // the bidders, in turn
    c.turn = c.answer[0]!;
    return true;
  }
  return false;
}

function startPlay(c: Coinche) {
  const trump = c.contract!.suit;
  c.phase = 'play'; c.turn = next(c, c.dealer); c.answer = [];
  for (const s of c.seats) c.hands[s] = sortHand(c.hands[s]!, trump);
  c.belote = { by: c.seats.find(s => c.hands[s]!.some(x => x.s === trump && x.r === 13) && c.hands[s]!.some(x => x.s === trump && x.r === 12)) ?? null, said: 0 };
  return true;
}

/** Who wins the trick so far: the highest trump, else the highest card of the suit led. */
export function winner(trick: CPlay[], trump: Suit) {
  const lead = trick[0]!.card.s;
  return trick.reduce((w, p) => {
    const a = w.card, b = p.card;
    const beats = b.s === a.s ? power(b, trump) > power(a, trump) : b.s === trump && a.s !== trump;
    return beats && (b.s === lead || b.s === trump) ? p : w;
  }).by;
}

/** The cards a seat may play now (follow; on a trump lead go higher; trump unless the partner is master;
 *  overtrump, else undertrump). */
export function legal(c: Coinche, s: string): CCard[] {
  const hand = c.hands[s]!, trump = c.contract!.suit;
  if (!c.trick.length) return hand;
  const lead = c.trick[0]!.card.s, trumps = hand.filter(x => x.s === trump);
  const top = Math.max(-1, ...c.trick.filter(p => p.card.s === trump).map(p => power(p.card, trump)));
  const over = trumps.filter(x => power(x, trump) > top);
  if (lead === trump) return trumps.length ? (over.length ? over : trumps) : hand;
  const follow = hand.filter(x => x.s === lead);
  if (follow.length) return follow;
  if (team(c, winner(c.trick, trump)) === team(c, s)) return hand;   // the partner is master: free
  if (!trumps.length) return hand;
  return over.length ? over : trumps;
}

/** A card played; the belote said; the trick taken; the deal counted after the 8th. */
export function play(c: Coinche, s: string, cd: CCard) {
  if (c.phase !== 'play' || c.turn !== s || !legal(c, s).some(x => x.id === cd.id)) return false;
  const trump = c.contract!.suit;
  c.hands[s] = c.hands[s]!.filter(x => x.id !== cd.id);
  if (c.belote.by === s && cd.s === trump && (cd.r === 12 || cd.r === 13)) c.belote.said++;
  if (!c.trick.length) c.lastTrick = [];
  c.trick.push({ by: s, card: cd });
  if (c.trick.length < 4) { c.turn = next(c, s); return true; }
  const w = winner(c.trick, trump);
  c.tricks[w]!.push(c.trick);
  c.winners.push(w);
  c.lastWinner = w; c.lastTrick = c.trick; c.trick = [];
  if (c.winners.length === 8) { count(c); return true; }
  c.turn = w;
  return true;
}

export const round10 = (x: number) => Math.round(x / 10) * 10;

function count(c: Coinche) {
  const k = c.contract!, trump = k.suit, attack = team(c, k.by), defense = (1 - attack) as 0 | 1;
  const pts: [number, number] = [0, 0];
  for (const s of c.seats) for (const tr of c.tricks[s]!) for (const p of tr) pts[team(c, s)] += points(p.card, trump);
  pts[team(c, c.winners.at(-1)!)] += 10;   // dix de der
  const all = ([0, 1] as const).find(t => c.winners.every(w => team(c, w) === t)) ?? null;
  if (all !== null) { pts[all] = 250; pts[(1 - all) as 0 | 1] = 0; }
  const bt = c.belote.by ? team(c, c.belote.by) : null, bel = (t: 0 | 1) => (bt === t ? 20 : 0);
  const made = k.value === CAPOT ? all === attack : pts[attack] + bel(attack) >= Math.max(k.value, 82);
  const score: [number, number] = [0, 0];
  if (k.value === CAPOT) {
    score[made ? attack : defense] = 500 * k.mult;
    score[attack] += bel(attack); score[defense] += bel(defense);
  } else if (made) {
    score[attack] = round10(pts[attack]) + k.value * k.mult + bel(attack);
    score[defense] = round10(pts[defense]) + bel(defense);
  } else {
    score[attack] = bel(attack);
    score[defense] = 160 + k.value * k.mult + bel(defense);
  }
  c.result = { attack, contract: { ...k }, points: pts, belote: bt, made, score, capot: all };
  c.scores = [c.scores[0] + score[0], c.scores[1] + score[1]];
  c.history.push({ deal: c.deal, contract: { ...k }, score });
  c.phase = 'done'; c.turn = null;
  if (Math.max(...c.scores) >= c.target && c.scores[0] !== c.scores[1]) { c.over = true; c.winner = c.scores[0] > c.scores[1] ? 0 : 1; }
}

/** Everyone passed: the deal is noted (nothing scored) before the next one. */
export function passedOut(c: Coinche) {
  if (c.phase === 'done' && !c.result) c.history.push({ deal: c.deal, contract: null, score: [0, 0] });
}

/** What a seat sees: its own hand, the others' as backs. */
export function coincheView(c: Coinche, seat: string | null): Coinche {
  return { ...c, hands: Object.fromEntries(Object.entries(c.hands).map(([s, h]) => [s, s === seat || c.phase === 'done' ? h : h.map((_, i) => ({ id: `x${i}`, r: 0, s: 'S' as Suit }))])) };
}
