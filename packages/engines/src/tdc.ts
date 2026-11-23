// « Trou du cul » (a.k.a. Président): the rules of a round (openspec: card-games), played by the server. Each player tries to get rid of his cards
// first. Cards rank 3 < 4 < … < 10 < Valet < Dame < Roi < As < 2. A play is 1 to 4 cards of the same rank; the next
// players put as many cards of a higher rank, or pass; when everyone else has passed (or a 2 is played: nothing beats
// it) the last one to play takes the trick and leads. Finishing order → roles → points; at the next round the Trou du
// cul gives his 2 best cards to the Président (who gives back 2), the Vice-trou 1 to the Vice-président, and the Trou
// du cul leads. The V1 will reuse an existing implementation (bots, variants): openspec … card-games/spec.md.
export type Suit = 'S' | 'H' | 'D' | 'C';
export interface Card { id: string; r: number; s: Suit }   // r: 3 … 14 (As), 15 (2)
export type Role = 'president' | 'vice' | 'neutre' | 'vtdc' | 'tdc';
export const ROLES: Record<Role, { name: string; points: number }> = {
  president: { name: 'Président', points: 30 },
  vice: { name: 'Vice-président', points: 20 },
  neutre: { name: 'Neutre', points: 10 },
  vtdc: { name: 'Vice-trou du cul', points: 5 },
  tdc: { name: 'Trou du cul', points: 0 },
};

export interface Play { by: string; cards: Card[] }
export interface Tdc {
  seats: string[];                   // players, in playing order
  hands: Record<string, Card[]>;
  trick: Play[];                     // the current trick, the last play on top
  lastTrick: Play[];                 // the trick just taken, still shown until the next play
  turn: string | null;               // null: the round is over
  passed: string[];                  // who passed in this trick (can't play again in it)
  out: string[];                     // finishing order
  roles: Record<string, Role>;       // from the last finished round
  round: number;
  startedAt: number;                 // the game's start (the clock)
  exchanges: string[];               // what was exchanged at the start of this round (said in the chat)
}

export const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
export const rankLabel = (r: number) => ({ 11: 'V', 12: 'D', 13: 'R', 14: 'A', 15: '2' } as Record<number, string>)[r] ?? String(r);
export const rankName = (r: number) => ({ 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As', 15: '2' } as Record<number, string>)[r] ?? String(r);
const COMBO = ['', 'un', 'une paire de', 'un brelan de', 'un carré de'];
export const playName = (cards: Card[]) => `${COMBO[cards.length]} ${rankName(cards[0].r)}`;
const sort = (cs: Card[]) => cs.sort((a, b) => a.r - b.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s));

export function deck(): Card[] {
  return RANKS.flatMap(r => SUITS.map(s => ({ id: `${r}${s}`, r, s })));
}

/** The pack cut, as at a table: a random part (3 cards at least on each side) put under the rest. */
export function cut<T>(pile: T[]) {
  const k = 3 + (crypto.getRandomValues(new Uint32Array(1))[0]! % Math.max(1, pile.length - 5));
  return [...pile.slice(k), ...pile.slice(0, k)];
}
/** How the cards are dealt: « random » (the pack fully shuffled each deal) or « classic » (as at a table: the tricks
 *  gathered in order, cut, dealt by packets — the colours stay grouped, more unbalanced hands). */
export type DealMode = 'random' | 'classic';

export function shuffle<T>(a: T[]) {
  const r = crypto.getRandomValues(new Uint32Array(a.length));
  for (let i = a.length - 1; i > 0; i--) { const j = r[i]! % (i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

const named = (id: string, names: (id: string) => string) => names(id);

/** A new round: all the cards dealt; the exchanges of the last round's roles; who leads (the Trou du cul, or at
 *  the first round whoever has the 3 of clubs). */
export function deal(seats: string[], prev: Tdc | null, names: (id: string) => string): Tdc {
  const cards = shuffle(deck()), hands: Record<string, Card[]> = Object.fromEntries(seats.map(id => [id, [] as Card[]]));
  cards.forEach((c, i) => hands[seats[i % seats.length]].push(c));
  for (const id of seats) sort(hands[id]);
  const roles = prev ? Object.fromEntries(Object.entries(prev.roles).filter(([id]) => seats.includes(id))) : {};
  const who = (r: Role) => Object.keys(roles).find(id => roles[id] === r);
  const exchanges: string[] = [];
  const swap = (low: string | undefined, high: string | undefined, n: number) => {
    if (!low || !high) return;
    const best = hands[low].splice(-n, n), worst = hands[high].splice(0, n);   // hands are sorted
    hands[high].push(...best); hands[low].push(...worst);
    sort(hands[high]); sort(hands[low]);
    exchanges.push(`${named(low, names)} donne ${best.map(c => rankName(c.r)).join(' et ')} à ${named(high, names)}, qui lui rend ${worst.map(c => rankName(c.r)).join(' et ')}.`);
  };
  swap(who('tdc'), who('president'), 2);
  swap(who('vtdc'), who('vice'), 1);
  const lead = who('tdc') ?? seats.find(id => hands[id].some(c => c.id === '3C')) ?? seats[0];
  return { seats, hands, trick: [], lastTrick: [], turn: lead, passed: [], out: [], roles, round: (prev?.round ?? 0) + 1, startedAt: prev?.startedAt ?? Date.now(), exchanges };
}

export const top = (t: Tdc) => t.trick[t.trick.length - 1] ?? null;

/** Can these cards be played now: the same rank; on an empty trick any count, else as many, of a higher rank. */
export function canPlay(t: Tdc, cards: Card[]) {
  if (!cards.length || cards.length > 4 || cards.some(c => c.r !== cards[0].r)) return false;
  const last = top(t);
  return !last || (cards.length === last.cards.length && cards[0].r > last.cards[0].r);
}

const active = (t: Tdc) => t.seats.filter(id => !t.out.includes(id));
/** The next player after `id` who is still in the round (and, if asked, hasn't passed in this trick). */
function next(t: Tdc, id: string, skipPassed: boolean) {
  const n = t.seats.length;
  for (let k = 1; k <= n; k++) {
    const p = t.seats[(t.seats.indexOf(id) + k) % n];
    if (!t.out.includes(p) && !(skipPassed && t.passed.includes(p))) return p;
  }
  return null;
}

/** The trick is over: the last one who played leads (or, if he is out, the next one still in). */
function closeTrick(t: Tdc) {
  const last = top(t)!.by;
  t.lastTrick = t.trick;
  t.trick = []; t.passed = [];
  t.turn = t.out.includes(last) ? next(t, last, false) : last;
}

function endIfOver(t: Tdc) {
  const left = active(t);
  if (left.length > 1) return false;
  t.out.push(...left);
  t.turn = null;
  const n = t.out.length;
  t.roles = Object.fromEntries(t.out.map((id, i) => [id,
    i === 0 ? 'president' : i === n - 1 ? 'tdc' : n >= 4 && i === 1 ? 'vice' : n >= 4 && i === n - 2 ? 'vtdc' : 'neutre'])) as Record<string, Role>;
  return true;
}

export function play(t: Tdc, id: string, cards: Card[]) {
  if (t.turn !== id || !canPlay(t, cards)) return false;
  t.hands[id] = t.hands[id].filter(c => !cards.some(x => x.id === c.id));
  t.lastTrick = [];
  t.trick.push({ by: id, cards });
  if (!t.hands[id].length) t.out.push(id);
  if (endIfOver(t)) return true;
  if (cards[0].r === 15) { closeTrick(t); return true; }   // nothing beats a 2
  const n = next(t, id, true);
  if (!n || n === id) closeTrick(t); else t.turn = n;
  return true;
}

export function pass(t: Tdc, id: string) {
  if (t.turn !== id || !t.trick.length) return false;   // the leader can't pass
  t.passed.push(id);
  const n = next(t, id, true);
  if (!n || n === top(t)!.by || (t.out.includes(top(t)!.by) && active(t).every(p => t.passed.includes(p)))) closeTrick(t);
  else t.turn = n;
  return true;
}

/** A simple robot: the lowest play that beats the trick, else pass; leading,
 *  its lowest rank, all of it. */
export function botMove(t: Tdc, id: string): { play: Card[] } | { pass: true } {
  const hand = t.hands[id], last = top(t);
  const groups = RANKS.map(r => hand.filter(c => c.r === r)).filter(g => g.length);
  if (!last) return { play: groups[0] };
  const need = last.cards.length, g = groups.find(x => x.length >= need && x[0].r > last.cards[0].r);
  return g ? { play: g.slice(0, need) } : { pass: true };
}

/** What a seat sees: its own hand; the others' hands as backs (their number only, no card). */
export function tdcView(t: Tdc, seat: string | null): Tdc {
  return { ...t, hands: Object.fromEntries(Object.entries(t.hands).map(([id, h]) => [id, id === seat ? h : h.map((_, i) => ({ id: `x${i}`, r: 0, s: 'S' as Suit }))])) };
}
