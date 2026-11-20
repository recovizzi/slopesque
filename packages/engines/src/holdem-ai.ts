// The Hold'em's robots (openspec: card-games, Robots du Texas Hold'em): they decide on their seat's view (holdemView:
// their 2 cards, the board, the bets and the chips), never the others' cards.
// - Preflop: the strength of the 2 cards (Bill Chen's formula), the position, the players left, the raises faced;
//   a short stack (under 10 big blinds) goes all-in or folds.
// - After the flop: the chances to win (Monte Carlo: the hidden cards dealt many times, the hand played to the end),
//   against the pot odds (what to call / the pot once called): fold under, call over, bet or raise a strong hand, a
//   bluff now and then.
// Levels: « facile » (calls too much, mistakes, few bluffs), « moyen » (the odds and the chances, a little chance),
// « fort » (the opponents' hands guessed from their bets, varied sizes, bluffs where they work).
import { evaluate, options, pot, type HCard, type Holdem, type Move, deck } from './holdem.js';

export type Level = 'facile' | 'moyen' | 'fort';
export const LEVELS: Record<Level, string> = { facile: 'Facile', moyen: 'Moyen', fort: 'Fort' };

/** Bill Chen's points for 2 cards (−1 … 20): the highest card, pairs doubled, suited +2, gaps, small connectors +1. */
export function chen(a: HCard, b: HCard) {
  const hi = Math.max(a.r, b.r), lo = Math.min(a.r, b.r);
  const base = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  if (hi === lo) return Math.max(5, base(hi) * 2) + (hi === 5 ? 1 : 0);
  let p = base(hi) + (a.s === b.s ? 2 : 0);
  const gap = hi - lo - 1;
  p -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 12) p += 1;
  return Math.ceil(p);
}

type Rng = () => number;
const IDS = deck().map(c => c.id);
const cardOf = new Map(deck().map(c => [c.id, c]));

/** The chances to win (a tie counts its share), dealing the hidden cards `iters` times. `keep(seat, hole)` may refuse
 *  a hand an opponent would not play that way (« fort »: their bets tell something). */
export function equity(v: Holdem, me: string, iters: number, rng: Rng, keep?: (seat: string, hole: HCard[]) => boolean) {
  const mine = v.holes[me]!, board = v.board, opp = v.inHand.filter(s => s !== me && !v.folded.includes(s));
  const known = new Set([...mine, ...board].map(c => c.id));
  const rest = IDS.filter(id => !known.has(id)).map(id => cardOf.get(id)!);
  let total = 0;
  for (let it = 0; it < iters; it++) {
    const pool = [...rest];
    let k = 0;
    const draw = () => { const j = k + Math.floor(rng() * (pool.length - k)); [pool[k], pool[j]] = [pool[j]!, pool[k]!]; return pool[k++]!; };
    const hands: HCard[][] = [];
    for (const s of opp) {
      let h = [draw(), draw()];
      for (let tries = 0; keep && tries < 6 && !keep(s, h); tries++) { k -= 2; h = [draw(), draw()]; }   // another guess
      hands.push(h);
    }
    const full = [...board];
    while (full.length < 5) full.push(draw());
    const my = evaluate([...mine, ...full]).score;
    let best = true, ties = 0;
    for (const h of hands) { const sc = evaluate([...h, ...full]).score; if (sc > my) { best = false; break; } if (sc === my) ties++; }
    if (best) total += 1 / (ties + 1);
  }
  return total / iters;
}

/** How each opponent played this hand: raised preflop, bet or raised after, only called. */
function reads(v: Holdem) {
  const r: Record<string, { pre: number; post: number }> = {};
  for (const l of v.log) {
    const x = (r[l.by] ??= { pre: 0, post: 0 });
    if (l.act === 'raise' || l.act === 'bet' || l.act === 'allin') { if (l.street === 'preflop') x.pre++; else x.post++; }
  }
  return r;
}

/** « fort »: a hand an opponent would have played this way (a raiser has good cards, a bettor after the flop has
 *  something on the board), kept more often. */
function keeper(v: Holdem, rng: Rng) {
  const r = reads(v);
  return (s: string, h: HCard[]) => {
    const x = r[s];
    if (!x) return true;
    const c = chen(h[0]!, h[1]!);
    if (x.pre >= 2 && c < 10) return rng() < 0.1;
    if (x.pre === 1 && c < 7) return rng() < 0.3;
    if (x.post && v.board.length >= 3) {
      const e = evaluate([...h, ...v.board]), boardOnly = evaluate(v.board.length >= 5 ? v.board : [...v.board]).cat;
      if (e.cat <= boardOnly && !draws(h, v.board)) return rng() < 0.35;
    }
    return true;
  };
}
/** A flush or straight draw with these cards. */
function draws(h: HCard[], board: HCard[]) {
  const all = [...h, ...board];
  if (['S', 'H', 'D', 'C'].some(s => all.filter(c => c.s === s).length === 4 && h.some(c => c.s === s))) return true;
  let bits = 0;
  for (const c of all) bits |= 1 << c.r;
  if (bits & (1 << 14)) bits |= 2;
  for (let lo = 1; lo <= 10; lo++) if (((bits >> lo) & 31).toString(2).split('').filter(x => x === '1').length >= 4) return true;
  return false;
}

/** How a level plays: each number a tendency (the duel tool, `pnpm holdem:duel`, measures them). */
export interface Profile {
  mistake: number;        // a move at random, sometimes
  noise: number;          // preflop: the Chen points blurred by ± noise / 2
  open: number;           // preflop: the Chen points to raise first (fewer in late position, more with many players)
  limp: number;           // … to call the big blind
  defend: number;         // … to call a raise
  light: number;          // … a re-raise in late position with 10+ points, this often
  pushFold: boolean;      // a short stack: all-in or fold
  iters: number;          // the deals of the Monte Carlo count
  ranges: boolean;        // the opponents' hands guessed from their bets
  eqNoise: number;        // the chances blurred by ± eqNoise / 2
  value: [number, number];   // the chances to bet (heads-up, several opponents)
  slow: number;           // a monster checked, this often (not on the river)
  bluff: [number, number];   // a bluff when checked to (heads-up, two opponents)
  drawBluff: number;      // … more with a draw (not on the river)
  pressure: number;       // facing a bet: the chances needed over the pot odds…
  pressureBet: number;    // … plus this × the bet / the pot (a big bet means a strong hand)
  implied: number;        // a draw: the chances it may win later
  raise: [number, number];   // the chances to raise a bet
  semi: number;           // a draw raised heads-up, this often
  size: [number, number]; // a bet: from size[0] × the pot, up to size[0] + size[1]
}
export const PROFILES: Record<Level, Profile> = {
  facile: { mistake: 0.12, noise: 4, open: 11, limp: 5, defend: 6, light: 0, pushFold: false, iters: 200, ranges: false, eqNoise: 0.25, value: [0.6, 0.66], slow: 0, bluff: [0.03, 0.03], drawBluff: 0,
    pressure: -0.08, pressureBet: 0, implied: 0, raise: [0.72, 0.78], semi: 0, size: [0.6, 0] },
  moyen: { mistake: 0.03, noise: 2, open: 9, limp: 7, defend: 8, light: 0, pushFold: true, iters: 800, ranges: false, eqNoise: 0, value: [0.6, 0.66], slow: 0, bluff: [0.08, 0.08], drawBluff: 0,
    pressure: 0.06, pressureBet: 0.08, implied: 0.05, raise: [0.72, 0.78], semi: 0, size: [0.6, 0] },
  fort: { mistake: 0, noise: 1, open: 9, limp: 7, defend: 8, light: 0.1, pushFold: true, iters: 2000, ranges: true, eqNoise: 0, value: [0.56, 0.62], slow: 0.2, bluff: [0.15, 0.06], drawBluff: 0.2,
    pressure: 0.06, pressureBet: 0.08, implied: 0.05, raise: [0.72, 0.78], semi: 0.15, size: [0.5, 0.3] },
};
const round = (x: number, bb: number) => Math.max(bb, Math.round(x / (bb / 2)) * (bb / 2));

/** A robot's move on its seat's view (a legal one), at a level (or with a profile, to measure one). */
export function decide(v: Holdem, me: string, level: Level | Profile, rng: Rng = Math.random): Move {
  const P = typeof level === 'string' ? PROFILES[level] : level;
  const o = options(v, me);
  if (!o) return { act: 'fold' };
  const bet = v.bets[me] ?? 0, stack = v.stacks[me]!, owe = o.call, p = pot(v), odds = owe ? owe / (p + owe) : 0;
  const opp = v.inHand.filter(s => s !== me && !v.folded.includes(s));
  const bbs = (stack + bet) / v.bb;
  const raiseTo = (to: number): Move => {
    if (!o.raise) return owe ? { act: 'call' } : { act: 'check' };
    const t = Math.min(o.raise.max, Math.max(o.raise.min, round(to, v.bb)));
    if (t >= o.raise.max || (t - bet) > 0.45 * stack) return { act: 'allin' };   // most of the stack: all of it
    return { act: 'raise', to: t };
  };
  const callOr = (yes: boolean): Move => (owe === 0 ? { act: 'check' } : yes ? { act: 'call' } : { act: 'fold' });
  if (rng() < P.mistake) return owe === 0 ? (rng() < 0.3 ? raiseTo(p * 0.5) : { act: 'check' }) : rng() < 0.6 ? { act: 'call' } : { act: 'fold' };

  if (v.street === 'preflop') {
    const [a, b] = v.holes[me]!;
    const c = chen(a!, b!) + (rng() - 0.5) * P.noise;
    const n = opp.length + 1, seats = v.inHand.length;
    const pos = (v.inHand.indexOf(me) - v.inHand.indexOf(v.button!) + seats) % seats;   // 0: the button, 1: small blind…
    const late = pos === 0 || (seats > 3 && pos === seats - 1);
    const need = (base: number) => base + (n >= 6 ? 1 : n <= 3 ? -1.5 : 0) - (late ? 1 : 0);
    if (bbs <= 10 && P.pushFold) {   // a short stack: all-in or fold
      if (c >= need(n <= 2 ? 5 : 7.5) - (bbs <= 5 ? 1.5 : 0)) return o.raise ? { act: 'allin' } : { act: 'call' };
      return callOr(false);
    }
    const raised = v.current > v.bb, big = v.current / v.bb;
    if (!raised) {
      if (c >= need(P.open)) return raiseTo(v.bb * (3 + opp.filter(s => (v.bets[s] ?? 0) >= v.bb && s !== v.bbSeat).length));
      if (owe === 0) return { act: 'check' };
      return callOr(c >= need(P.limp) || (owe <= v.bb / 2 && c >= 5));
    }
    if (c >= (big > 12 ? 13 : 12) || (late && c >= 10 && rng() < P.light)) return raiseTo(v.current * 3);
    const callNeed = P.defend + (big > 8 ? 2 : big > 4 ? 1 : 0) + (owe > stack * 0.4 ? 2 : 0) - (P.pushFold && odds > 0.33 ? 1 : 0);
    return callOr(c >= callNeed);
  }

  // after the flop: the chances to win, the pot odds
  const eq = equity(v, me, P.iters, rng, P.ranges ? keeper(v, rng) : undefined) + (rng() - 0.5) * P.eqNoise;
  const many = opp.length, last = v.street === 'river', hu = many > 1 ? 1 : 0, draw = !last && draws(v.holes[me]!, v.board);
  if (owe === 0) {
    if (eq >= P.value[hu]!) {
      if (eq > 0.9 && !last && rng() < P.slow) return { act: 'check' };   // a slow play, sometimes
      return raiseTo(p * (P.size[0] + (eq > 0.8 ? P.size[1] : rng() * P.size[1])));
    }
    if (many <= 2 && rng() < P.bluff[hu]! + (draw ? P.drawBluff : 0)) return raiseTo(p * (P.size[0] + rng() * P.size[1]));
    return { act: 'check' };
  }
  // facing a bet: a big bet means a strong hand more often than the random hands the count assumes
  const pressure = P.pressure + P.pressureBet * Math.min(1, owe / Math.max(1, p - owe));
  if (eq >= P.raise[hu]! && o.raise) return raiseTo(v.current + Math.max(v.minRaise, p * (P.size[0] + 0.15 + rng() * P.size[1])));
  if (draw && many === 1 && o.raise && rng() < P.semi) return raiseTo(v.current * 2.5);   // a semi-bluff
  return callOr(eq + (draw ? P.implied : 0) >= odds + pressure);
}
