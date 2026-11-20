// Texas Hold'em, No Limit, played by the server as a tournament of fictional chips (openspec: card-games, Texas
// Hold'em; plan-slopesque-v1 decision 21). Rules of the Poker TDA: a button, the small and the big blind, 2 hidden
// cards each, four betting rounds (preflop, flop, turn, river); a raise at least the largest prior bet or raise of the
// round, an all-in for less doesn't reopen the betting for those who acted; side pots; the bet nobody called comes
// back; heads-up, the button is the small blind (first preflop, last after); the best 5 of 7 cards wins, the odd chip
// to the first winner left of the button. The blinds rise every N hands; a player without chips is out; the last one
// with chips wins. The robots play on what their seat may see (holdemView).
import { shuffle, type Suit } from './tdc.js';

/** A card: r 2 … 14 (11 Valet, 12 Dame, 13 Roi, 14 As). */
export interface HCard { id: string; r: number; s: Suit }
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type Act = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'sb' | 'bb';
export interface Move { act: 'fold' | 'check' | 'call' | 'raise' | 'allin'; to?: number }
export interface Settings { stack: number; every: number }   // starting chips; blinds up every N hands (0: never)

export const STACKS = [500, 1000, 2000, 5000];
export const EVERY = [5, 10, 20, 0];
export const DEFAULT_SETTINGS: Settings = { stack: 1000, every: 10 };
/** The big blind of each level (the small one is half): 10 / 20, 20 / 40, 30 / 60… */
export const BLINDS = [20, 40, 60, 80, 120, 160, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000, 15000, 20000, 30000, 40000, 60000, 80000, 100000];
export const MAX_SEATS = 8;

export interface Award { amount: number; winners: string[]; hand: string; side: number }   // side 0: the main pot
export interface HandResult {
  awards: Award[];                                       // each pot and who took it
  uncontested: boolean;                                  // the others folded: won without showing
  shown: string[];                                       // the hands turned over
  best: Record<string, { cat: number; name: string; five: string[] }>;   // each shown hand: its best 5 cards
  won: Record<string, number>;                           // what each seat took from the pots
  out: string[];                                         // eliminated in this hand
}
export interface LogLine { by: string; street: Street; act: Act; amount: number }
export interface Holdem {
  seats: string[];                       // table order (the eliminated ones stay, in `out`)
  settings: Settings;
  stacks: Record<string, number>;        // the chips in front of each seat (not yet in the pot)
  out: string[];                         // eliminated, in order (the first is the last place)
  places: Record<string, number>;        // final places (1: the winner)
  over: boolean;                         // the game has ended
  hand: number;                          // hands dealt so far
  level: number; sb: number; bb: number;
  levelUp: boolean;                      // this hand starts a new level of blinds
  button: string | null; sbSeat: string | null; bbSeat: string | null;
  deck: HCard[];                         // what is left (never in a view)
  holes: Record<string, HCard[]>;
  board: HCard[];
  street: Street;
  inHand: string[];                      // the seats dealt in this hand
  folded: string[];
  bets: Record<string, number>;          // put in on this street
  paid: Record<string, number>;          // put in during the hand (bets included)
  current: number;                       // the bet to match on this street
  minRaise: number;                      // the smallest raise allowed (the last full bet or raise)
  acted: string[];                       // who has acted on this street
  faced: Record<string, number>;         // the bet each one matched when he last acted (a full raise since reopens)
  aggressor: string | null;              // the last one to bet or raise on the last street (shows first)
  turn: string | null;
  last: Record<string, { act: Act; amount: number }>;   // each seat's last action, shown on its place
  log: LogLine[];                        // the hand's actions (the robots read the betting)
  revealed: boolean;                     // nobody can bet any more: the hands are turned over, the board runs out
  startStacks: Record<string, number>;
  result: HandResult | null;
  startedAt: number;
}

// ------------------------------------------------------------------ cards and hands
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export function deck(): HCard[] { return SUITS.flatMap(s => Array.from({ length: 13 }, (_, i) => ({ id: `${s}${i + 2}`, r: i + 2, s }))); }
export const card = (id: string): HCard => ({ id, s: id[0] as Suit, r: Number(id.slice(1)) });
export const rankLabel = (r: number) => ({ 11: 'V', 12: 'D', 13: 'R', 14: 'A' } as Record<number, string>)[r] ?? String(r);
const RANK = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' } as Record<number, string>;
const RANKS = { 11: 'Valets', 12: 'Dames', 13: 'Rois', 14: 'As' } as Record<number, string>;
export const rankName = (r: number) => RANK[r] ?? String(r);
const of = (r: number, plural = true) => { const w = plural ? RANKS[r] ?? String(r) : rankName(r); return r === 14 ? `d'${w}` : `de ${w}`; };
const au = (r: number) => (r === 14 ? 'à l\'As' : r === 11 ? 'au Valet' : r === 12 ? 'à la Dame' : r === 13 ? 'au Roi' : `au ${r}`);
export const SUIT_NAME: Record<Suit, string> = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
export const cardName = (c: HCard) => `${rankName(c.r)} de ${SUIT_NAME[c.s]}`;

/** The hands, from the weakest (0) to the strongest (8; 9: the royal straight flush, a name only). */
export const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];

export interface Eval { score: number; cat: number; five: HCard[]; values: number[] }
/** The highest straight in a set of ranks (a bit per rank, the As also as 1): its top card, or 0. */
function straightTop(bits: number) {
  if (bits & (1 << 14)) bits |= 1 << 1;
  for (let top = 14; top >= 5; top--) if (((bits >> (top - 4)) & 31) === 31) return top;
  return 0;
}
/** The best 5 cards of 5 to 7: its category, a score to compare (higher wins, equal ties) and the 5 cards. */
export function evaluate(cards: HCard[]): Eval {
  const bySuit: Record<string, HCard[]> = { S: [], H: [], D: [], C: [] }, byRank: HCard[][] = Array.from({ length: 15 }, () => []);
  let bits = 0;
  for (const c of cards) { bySuit[c.s]!.push(c); byRank[c.r]!.push(c); bits |= 1 << c.r; }
  const score = (cat: number, values: number[]) => [0, 1, 2, 3, 4].reduce((s, i) => s * 15 + (values[i] ?? 0), cat);
  const run = (top: number, pool: HCard[]) => Array.from({ length: 5 }, (_, k) => { const r = top - k === 1 ? 14 : top - k; return pool.find(c => c.r === r)!; });
  const flush = Object.values(bySuit).find(cs => cs.length >= 5);
  if (flush) {
    let fb = 0;
    for (const c of flush) fb |= 1 << c.r;
    const top = straightTop(fb);
    if (top) return { cat: 8, score: score(8, [top]), five: run(top, flush), values: [top] };
  }
  const groups = byRank.map((cs, r) => ({ r, cs })).filter(g => g.cs.length).sort((a, b) => b.cs.length - a.cs.length || b.r - a.r);
  const kick = (n: number, not: number[]) => byRank.flatMap((cs, r) => (not.includes(r) ? [] : cs)).sort((a, b) => b.r - a.r).slice(0, n);
  const g0 = groups[0]!, g1 = groups[1];
  if (g0.cs.length === 4) { const k = kick(1, [g0.r]); return { cat: 7, score: score(7, [g0.r, k[0]!.r]), five: [...g0.cs, ...k], values: [g0.r, k[0]!.r] }; }
  if (g0.cs.length === 3 && g1 && g1.cs.length >= 2) return { cat: 6, score: score(6, [g0.r, g1.r]), five: [...g0.cs, ...g1.cs.slice(0, 2)], values: [g0.r, g1.r] };
  if (flush) { const f = [...flush].sort((a, b) => b.r - a.r).slice(0, 5); return { cat: 5, score: score(5, f.map(c => c.r)), five: f, values: f.map(c => c.r) }; }
  const top = straightTop(bits);
  if (top) return { cat: 4, score: score(4, [top]), five: run(top, cards), values: [top] };
  if (g0.cs.length === 3) { const k = kick(2, [g0.r]); return { cat: 3, score: score(3, [g0.r, ...k.map(c => c.r)]), five: [...g0.cs, ...k], values: [g0.r, ...k.map(c => c.r)] }; }
  if (g0.cs.length === 2 && g1 && g1.cs.length === 2) {
    const k = kick(1, [g0.r, g1.r]);
    return { cat: 2, score: score(2, [g0.r, g1.r, k[0]?.r ?? 0]), five: [...g0.cs, ...g1.cs, ...k], values: [g0.r, g1.r, k[0]?.r ?? 0] };
  }
  if (g0.cs.length === 2) { const k = kick(3, [g0.r]); return { cat: 1, score: score(1, [g0.r, ...k.map(c => c.r)]), five: [...g0.cs, ...k], values: [g0.r, ...k.map(c => c.r)] }; }
  const k = kick(5, []);
  return { cat: 0, score: score(0, k.map(c => c.r)), five: k, values: k.map(c => c.r) };
}

/** A hand in words: « Paire de Rois », « Full aux Dames par les 4 », « Quinte au Valet »… */
export function handName(e: Pick<Eval, 'cat' | 'values'>) {
  const [a = 0, b = 0] = e.values;
  switch (e.cat) {
    case 8: return a === 14 ? 'Quinte flush royale' : `Quinte flush ${au(a)}`;
    case 7: return `Carré ${of(a)}`;
    case 6: return `Full aux ${RANKS[a] ?? a} par les ${RANKS[b] ?? b}`;
    case 5: return `Couleur ${au(a)}`;
    case 4: return `Quinte ${au(a)}`;
    case 3: return `Brelan ${of(a)}`;
    case 2: return `Double paire, ${RANKS[a] ?? a} et ${RANKS[b] ?? b}`;
    case 1: return `Paire ${of(a)}`;
    default: return `Hauteur ${rankName(a)}`;
  }
}

// ------------------------------------------------------------------ the game
const blindOf = (level: number) => BLINDS[Math.min(level, BLINDS.length - 1)]!;
export const alive = (g: Holdem) => g.seats.filter(s => !g.out.includes(s));
export const active = (g: Holdem, s: string) => g.inHand.includes(s) && !g.folded.includes(s);
const after = (g: Holdem, from: string, ok: (s: string) => boolean) => {
  const i = g.seats.indexOf(from);
  for (let k = 1; k <= g.seats.length; k++) { const s = g.seats[(i + k) % g.seats.length]!; if (ok(s)) return s; }
  return null;
};
const nextAlive = (g: Holdem, from: string) => after(g, from, s => !g.out.includes(s))!;
/** The pot: everything put in during the hand. */
export const pot = (g: Pick<Holdem, 'paid'>) => Object.values(g.paid).reduce((a, b) => a + b, 0);

/** A new game for these seats: the same chips for all, the first hand dealt. */
export function newGame(seats: string[], settings: Settings = DEFAULT_SETTINGS, now = Date.now()): Holdem {
  const g: Holdem = { seats: [...seats], settings, stacks: Object.fromEntries(seats.map(s => [s, settings.stack])), out: [], places: {}, over: false, hand: 0, level: 0, sb: 10, bb: 20, levelUp: false,
    button: null, sbSeat: null, bbSeat: null, deck: [], holes: {}, board: [], street: 'showdown', inHand: [], folded: [], bets: {}, paid: {}, current: 0, minRaise: 20, acted: [], faced: {},
    aggressor: null, turn: null, last: {}, log: [], revealed: false, startStacks: {}, result: null, startedAt: now };
  dealHand(g);
  return g;
}

function put(g: Holdem, s: string, amount: number) {
  const n = Math.min(amount, g.stacks[s]!);
  g.stacks[s]! -= n; g.bets[s] = (g.bets[s] ?? 0) + n; g.paid[s] = (g.paid[s] ?? 0) + n;
  return n;
}

/** The next hand: the button moves on, the blinds (of the level reached) are posted, 2 cards each. */
export function dealHand(g: Holdem, rand: () => number = Math.random) {
  const live = alive(g);
  if (g.over || live.length < 2) return false;
  g.hand++;
  const level = g.settings.every ? Math.floor((g.hand - 1) / g.settings.every) : 0;
  g.levelUp = g.hand > 1 && level !== g.level;
  g.level = level; g.bb = blindOf(level); g.sb = g.bb / 2;
  g.button = g.button && !g.out.includes(g.button) ? nextAlive(g, g.button) : g.button ? nextAlive(g, g.button) : live[Math.floor(rand() * live.length)]!;
  g.sbSeat = live.length === 2 ? g.button : nextAlive(g, g.button);
  g.bbSeat = nextAlive(g, g.sbSeat);
  Object.assign(g, { deck: shuffle(deck()), holes: {}, board: [], street: 'preflop', inHand: live, folded: [], bets: {}, paid: {}, acted: [], faced: {}, aggressor: null, last: {}, log: [],
    revealed: false, result: null, startStacks: { ...g.stacks } });
  for (let k = 0; k < 2; k++) for (let i = 0; i < live.length; i++) { const s = after(g, g.button, x => live.includes(x) && (g.holes[x]?.length ?? 0) === k)!; (g.holes[s] ??= []).push(g.deck.pop()!); }
  const sb = put(g, g.sbSeat, g.sb), bb = put(g, g.bbSeat, g.bb);
  g.last[g.sbSeat] = { act: 'sb', amount: sb }; g.last[g.bbSeat] = { act: 'bb', amount: bb };
  g.log.push({ by: g.sbSeat, street: 'preflop', act: 'sb', amount: sb }, { by: g.bbSeat, street: 'preflop', act: 'bb', amount: bb });
  g.current = g.bb; g.minRaise = g.bb;   // a short big blind: the others still match the full one (TDA)
  g.turn = null;
  advance(g, g.bbSeat);
  return true;
}

/** Whether a seat still has to act on this street. */
function needs(g: Holdem, s: string) {
  if (!active(g, s) || g.stacks[s] === 0) return false;
  const behind = g.inHand.some(x => x !== s && active(g, x) && g.stacks[x]! > 0);
  if (!behind && (g.bets[s] ?? 0) >= g.current) return false;   // alone with chips, nothing to match: nothing to decide
  return !g.acted.includes(s) || (g.bets[s] ?? 0) < g.current;
}

export interface Options { fold: boolean; check: boolean; call: number; raise: { min: number; max: number } | null; allin: number }
/** What a seat may do now: check or call (how much), raise to between min and max (the total of its bet), all-in. */
export function options(g: Holdem, s: string): Options | null {
  if (g.over || g.turn !== s || g.street === 'showdown') return null;
  const bet = g.bets[s] ?? 0, stack = g.stacks[s]!, owe = Math.max(0, g.current - bet), max = bet + stack;
  const reopened = !g.acted.includes(s) || g.current - (g.faced[s] ?? 0) >= g.minRaise;
  const others = g.inHand.some(x => x !== s && active(g, x) && g.stacks[x]! > 0);
  const min = Math.min(g.current + g.minRaise, max);
  const raise = reopened && others && max > g.current ? { min, max } : null;
  return { fold: true, check: owe === 0, call: Math.min(owe, stack), raise, allin: raise || max <= g.current ? max : 0 };
}

/** A seat's move, checked against the rules; then the next seat, street or the showdown. */
export function act(g: Holdem, s: string, m: Move) {
  const o = options(g, s);
  if (!o) return false;
  const bet = g.bets[s] ?? 0, before = g.current;
  let kind: Act;
  if (m.act === 'fold') { g.folded.push(s); kind = 'fold'; }
  else if (m.act === 'check') { if (!o.check) return false; kind = 'check'; }
  else if (m.act === 'call') { if (o.check) return false; put(g, s, o.call); kind = g.stacks[s] === 0 ? 'allin' : 'call'; }
  else {
    const to = m.act === 'allin' ? o.allin : Math.floor(m.to ?? 0);
    if (!to || to > bet + g.stacks[s]!) return false;
    if (to > g.current) {
      if (!o.raise || (to < o.raise.min && to !== o.raise.max)) return false;   // under the minimum: only an all-in
      if (to - g.current >= g.minRaise) g.minRaise = to - g.current;            // a full raise (a shorter all-in doesn't change it)
      g.current = to; g.aggressor = s;
    } else if (m.act !== 'allin' || to !== bet + g.stacks[s]!) return false;    // all-in for less than the bet: a call
    put(g, s, to - bet);
    kind = g.stacks[s] === 0 ? 'allin' : before === 0 ? 'bet' : 'raise';
  }
  if (!g.acted.includes(s)) g.acted.push(s);
  g.faced[s] = g.current;
  const amount = kind === 'fold' || kind === 'check' ? 0 : g.bets[s]!;
  g.last[s] = { act: kind, amount };
  g.log.push({ by: s, street: g.street, act: kind, amount });
  advance(g, s);
  return true;
}

function advance(g: Holdem, from: string) {
  const live = g.inHand.filter(x => active(g, x));
  if (live.length === 1) return win(g, live[0]!);
  const next = after(g, from, x => needs(g, x));
  if (next) { g.turn = next; return; }
  // the street is over
  if (g.street === 'river') return showdown(g);
  const canBet = live.filter(x => g.stacks[x]! > 0).length;
  if (canBet <= 1) {   // nobody can bet any more: the hands turned over, the board runs out
    g.revealed = true;
    while (g.board.length < 5) burnAndDeal(g, g.board.length ? 1 : 3);
    return showdown(g);
  }
  burnAndDeal(g, g.street === 'preflop' ? 3 : 1);
  g.street = g.street === 'preflop' ? 'flop' : g.street === 'flop' ? 'turn' : 'river';
  g.bets = {}; g.current = 0; g.minRaise = g.bb; g.acted = []; g.faced = {};
  for (const x of live) if (g.stacks[x]! > 0) delete g.last[x];
  g.turn = after(g, g.button!, x => needs(g, x));
  if (!g.turn) advance(g, g.button!);
}

function burnAndDeal(g: Holdem, n: number) {
  g.deck.pop();
  for (let k = 0; k < n; k++) g.board.push(g.deck.pop()!);
}

/** The others folded: the pot to the last one, without showing. */
function win(g: Holdem, s: string) {
  const amount = pot(g);
  g.stacks[s]! += amount;
  g.result = { awards: [{ amount, winners: [s], hand: '', side: 0 }], uncontested: true, shown: [], best: {}, won: { [s]: amount }, out: [] };
  endHand(g);
}

/** The pots by levels of what was put in: each pot, and who may win it (folded players pay, never win). */
export function pots(g: Pick<Holdem, 'inHand' | 'folded' | 'paid'>) {
  const live = g.inHand.filter(s => !g.folded.includes(s));
  const levels = [...new Set(live.map(s => g.paid[s] ?? 0))].filter(x => x > 0).sort((a, b) => a - b);
  const out: { amount: number; seats: string[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = g.inHand.reduce((n, s) => n + Math.max(0, Math.min(g.paid[s] ?? 0, level) - prev), 0);
    if (amount) out.push({ amount, seats: live.filter(s => (g.paid[s] ?? 0) >= level) });
    prev = level;
  }
  const rest = g.inHand.reduce((n, s) => n + Math.max(0, (g.paid[s] ?? 0) - prev), 0);
  if (rest && out.length) out.at(-1)!.amount += rest;
  return out;
}

function showdown(g: Holdem) {
  g.street = 'showdown'; g.turn = null; g.revealed = true;
  const live = g.inHand.filter(x => active(g, x));
  const ev = Object.fromEntries(live.map(s => [s, evaluate([...g.holes[s]!, ...g.board])]));
  const order = [...live].sort((a, b) => dist(g, a) - dist(g, b));   // from the left of the button (the odd chip)
  const awards: Award[] = [], won: Record<string, number> = {};
  let side = 0;
  for (const p of pots(g)) {
    if (p.seats.length === 1) { g.stacks[p.seats[0]!]! += p.amount; continue; }   // a bet nobody called: back to its player
    const best = Math.max(...p.seats.map(s => ev[s]!.score)), winners = order.filter(s => p.seats.includes(s) && ev[s]!.score === best);
    const share = Math.floor(p.amount / winners.length);
    let odd = p.amount - share * winners.length;
    for (const w of winners) { const n = share + (odd-- > 0 ? 1 : 0); g.stacks[w]! += n; won[w] = (won[w] ?? 0) + n; }
    awards.push({ amount: p.amount, winners, hand: handName(ev[winners[0]!]!), side: side++ });
  }
  const best = Object.fromEntries(live.map(s => [s, { cat: ev[s]!.cat, name: handName(ev[s]!), five: ev[s]!.five.map(c => c.id) }]));
  g.result = { awards, uncontested: false, shown: live, best, won, out: [] };
  endHand(g);
}
const dist = (g: Holdem, s: string) => (g.seats.indexOf(s) - g.seats.indexOf(g.button!) + g.seats.length - 1) % g.seats.length;

/** The hand's end: the players without chips are out (their place: the ones out in the same hand by their chips at
 *  its start); the last one with chips wins the game. */
function endHand(g: Holdem) {
  g.street = 'showdown'; g.turn = null; g.bets = {};
  const busted = g.inHand.filter(s => g.stacks[s] === 0).sort((a, b) => (g.startStacks[a] ?? 0) - (g.startStacks[b] ?? 0));
  for (const s of busted) { g.places[s] = alive(g).length; g.out.push(s); }
  g.result!.out = busted;
  const live = alive(g);
  if (live.length === 1) { g.places[live[0]!] = 1; g.over = true; }
}

/** The host ends the game: the seats still in are placed by their chips (a hand in progress: its chips given back). */
export function finish(g: Holdem) {
  if (g.over) return false;
  const live = alive(g), chips = (s: string) => g.stacks[s]! + (g.street === 'showdown' ? 0 : g.paid[s] ?? 0);
  live.sort((a, b) => chips(b) - chips(a) || g.seats.indexOf(a) - g.seats.indexOf(b)).forEach((s, i) => { g.places[s] = i + 1; });
  if (g.street !== 'showdown') { for (const s of g.inHand) g.stacks[s]! += g.paid[s] ?? 0; g.paid = {}; g.bets = {}; }
  g.street = 'showdown'; g.turn = null; g.over = true;
  return true;
}

/** The room's points of a place: 10 × (seats − place). */
export const placePoints = (place: number, seats: number) => 10 * (seats - place);

/** What a seat sees: its own cards, the others' only once turned over (showdown, or nobody can bet any more). */
export function holdemView(g: Holdem, seat: string | null): Holdem {
  const back = (cs: HCard[]) => cs.map((_, i) => ({ id: `x${i}`, r: 0, s: 'S' as Suit }));
  const open = (s: string) => s === seat || (g.revealed && active(g, s));
  return { ...g, deck: [], holes: Object.fromEntries(Object.entries(g.holes).map(([s, h]) => [s, open(s) ? h : back(h)])) };
}
