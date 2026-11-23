// The Coinche's robots (openspec: card-games, Robots de la Coinche): they decide on their seat's view (coincheView:
// their hand, the bidding, the cards played).
// - Memory: the cards fallen, the suits each player can no longer follow (and the trump he can't have).
// - Play by rules: the bidders draw the trumps with a master trump, everyone plays his master cards, loads the
//   partner's trick when it is sure (a 10, an Ace), wins cheaply when he can, gives the least otherwise.
// - Bids: the hand's strength for each trump (Jack and 9 of trump, length, Aces and protected 10s, belote), the
//   partner's bid supported (+10 an Ace or a top trump), a coinche when the defence holds the contract.
// - « fort »: the cards played by looking (the hidden cards dealt many times as they may be, the deal played to the
//   end by the rules, the card with the best outcome kept), the contract by playing the deal on hands drawn at random.
// Levels: « facile » (mistakes, bold or shy bids), « moyen » (the rules), « fort » (the simulations).
import { CAPOT, deck, isSuit, isTrump, TRUMPS, type Trump, legal, options, partnerOf, play, points, power, SUITS, team, winner, type CCard, type Coinche, type CPlay, type Say } from './coinche.js';
import type { Suit } from './tdc.js';

export type Level = 'facile' | 'moyen' | 'fort';
type Rng = () => number;

// ------------------------------------------------------------------ memory
interface Memory {
  c: Coinche; me: string; trump: Trump; hand: CCard[];
  gone: Set<string>;                                   // cards played (or in my hand)
  voids: Record<string, Set<Suit>>;                    // suits a player can no longer follow
  us: (s: string) => boolean;                          // my team
}
const allPlays = (c: Coinche): CPlay[][] => {
  const byOrder: CPlay[][] = [];
  const counts: Record<string, number> = {};
  for (const w of c.winners) { const k = counts[w] ?? 0; byOrder.push(c.tricks[w]![k]!); counts[w] = k + 1; }
  return c.trick.length ? [...byOrder, c.trick] : byOrder;
};
function remember(c: Coinche, me: string): Memory {
  const trump = c.contract!.suit, gone = new Set<string>(c.hands[me]!.map(x => x.id)), voids: Record<string, Set<Suit>> = Object.fromEntries(c.seats.map(s => [s, new Set<Suit>()]));
  for (const tr of allPlays(c)) {
    const lead = tr[0]!.card.s;
    tr.forEach((p, i) => {
      gone.add(p.card.id);
      if (i && p.card.s !== lead) {
        voids[p.by]!.add(lead);
        const before = tr.slice(0, i), partnerMaster = team(c, winner(before, trump)) === team(c, p.by);
        if (isSuit(trump) && p.card.s !== trump && (lead === trump || !partnerMaster)) voids[p.by]!.add(trump);   // he had to trump: he has none
      }
    });
  }
  return { c, me, trump, hand: c.hands[me]!, gone, voids, us: s => team(c, s) === team(c, me) };
}
const unseen = (m: Memory) => deck().filter(x => !m.gone.has(x.id));
/** No card still hidden beats this one in its suit (a master card). */
const master = (m: Memory, cd: CCard) => !unseen(m).some(x => x.s === cd.s && power(x, m.trump) > power(cd, m.trump));
const pts = (m: Memory, cd: CCard) => points(cd, m.trump);
const low = (m: Memory, cs: CCard[]) => [...cs].sort((a, b) => pts(m, a) - pts(m, b) || (isTrump(a, m.trump) ? 1 : 0) - (isTrump(b, m.trump) ? 1 : 0) || power(a, m.trump) - power(b, m.trump))[0]!;

/** Whether a player still to play may beat the trick (from what he may hold). */
function mayBeat(m: Memory, x: string, trick: CPlay[]) {
  const lead = trick[0]!.card.s, w = trick.find(p => p.by === winner(trick, m.trump))!.card, hidden = unseen(m);
  const followHigher = !m.voids[x]!.has(lead) && hidden.some(h => h.s === lead && w.s === lead && power(h, m.trump) > power(w, m.trump));
  if (!isSuit(m.trump)) return followHigher;   // SA, TA: nobody cuts
  const canTrump = (m.voids[x]!.has(lead) || lead === m.trump) && !m.voids[x]!.has(m.trump) && hidden.some(h => h.s === m.trump && (w.s !== m.trump || power(h, m.trump) > power(w, m.trump)));
  return followHigher || (lead !== m.trump ? (m.voids[x]!.has(lead) || hidden.filter(h => h.s === lead).length === 0) && canTrump : canTrump);
}
const after = (m: Memory) => { const i = m.c.seats.indexOf(m.me); return [1, 2, 3].map(k => m.c.seats[(i + k) % 4]!).slice(0, 3 - m.c.trick.length); };

// ------------------------------------------------------------------ play by rules
function playByRules(m: Memory, rng: Rng, mistake = 0): CCard {
  const cards = legal(m.c, m.me);
  if (cards.length === 1) return cards[0]!;
  if (mistake && rng() < mistake) return cards[Math.floor(rng() * cards.length)]!;
  const { c, trump } = m, trick = c.trick;
  if (!trick.length) return leadCard(m, cards);
  const w = winner(trick, trump), mine = m.us(w), rest = after(m);
  const sure = mine && rest.every(x => m.us(x) || !mayBeat(m, x, trick));
  const wins = cards.filter(cd => winner([...trick, { by: m.me, card: cd }], trump) === m.me);
  if (sure) {   // load the partner's trick: the most points, keeping the strong trumps and the master cards of a long suit
    const load = cards.filter(cd => !isTrump(cd, trump) || (cd.r !== 11 && cd.r !== 9));
    const pool = load.length ? load : cards;
    return [...pool].sort((a, b) => pts(m, b) - pts(m, a) || (master(m, a) ? 1 : 0) - (master(m, b) ? 1 : 0))[0]!;
  }
  if (wins.length) {
    const last = rest.length === 0;
    const safe = wins.filter(cd => last || rest.every(x => m.us(x) || !mayBeat(m, x, [...trick, { by: m.me, card: cd }])));
    const value = trick.reduce((n, p) => n + pts(m, p.card), 0);
    if (safe.length) return [...safe].sort((a, b) => power(a, trump) - power(b, trump))[0]!;   // the cheapest that holds
    if (value >= 10 || trick.some(p => isSuit(trump) && p.card.s === trump)) return [...wins].sort((a, b) => power(b, trump) - power(a, trump))[0]!;
  }
  return low(m, cards);
}

function leadCard(m: Memory, cards: CCard[]): CCard {
  const { c, trump } = m, attack = m.us(c.contract!.by), suit = isSuit(trump) ? trump : null, myTrumps = suit ? cards.filter(cd => cd.s === suit) : [];
  const theirs = !!suit && unseen(m).filter(x => x.s === suit).length > 0 && c.seats.some(x => !m.us(x) && !m.voids[x]!.has(suit));
  // the bidders draw the trumps with a master trump
  if (attack && theirs && myTrumps.length) { const top = myTrumps.find(cd => master(m, cd)); if (top) return top; if (c.contract!.by === m.me && myTrumps.length >= 3) return myTrumps.sort((a, b) => power(b, trump) - power(a, trump))[0]!; }
  // a master card in a suit the opponents still follow
  const masters = cards.filter(cd => cd.s !== suit && master(m, cd) && (!suit || c.seats.every(x => m.us(x) || !m.voids[x]!.has(cd.s) || m.voids[x]!.has(suit))));   // SA, TA: nobody cuts
  if (masters.length) return masters.sort((a, b) => pts(m, b) - pts(m, a))[0]!;
  // a suit the partner cuts, when the opponents don't
  const partner = partnerOf(c, m.me), cut = suit ? cards.filter(cd => cd.s !== suit && m.voids[partner]!.has(cd.s) && !m.voids[partner]!.has(suit)) : [];
  if (cut.length) return low(m, cut);
  // else a small card, not a lonely 10, not a trump if I defend
  const plain = cards.filter(cd => cd.s !== suit && !(cd.r === 10 && !m.hand.some(x => x.s === cd.s && x.r === 14) && !m.gone.has(`${cd.s}14`)));
  return low(m, plain.length ? plain : cards.filter(cd => cd.s !== suit).length ? cards.filter(cd => cd.s !== suit) : cards);
}

// ------------------------------------------------------------------ play by looking (« fort »)
/** A world: the hidden cards dealt to the others as they may be (their voids kept). */
function sample(m: Memory, rng: Rng): Coinche | null {
  const { c, me } = m, others = c.seats.filter(x => x !== me), free = unseen(m);
  for (let tries = 0; tries < 40; tries++) {
    const left = Object.fromEntries(others.map(x => [x, c.hands[x]!.length])), hands: Record<string, CCard[]> = Object.fromEntries(others.map(x => [x, [] as CCard[]]));
    let ok = true;
    for (const cd of [...free].sort(() => rng() - 0.5)) {
      const can = others.filter(x => left[x]! > 0 && (tries > 30 || !m.voids[x]!.has(cd.s)));
      if (!can.length) { ok = false; break; }
      const x = can[Math.floor(rng() * can.length)]!;
      hands[x]!.push(cd); left[x]!--;
    }
    if (!ok || Object.values(left).some(n => n)) continue;
    return { ...c, hands: { ...hands, [me]: [...m.hand] }, trick: [...c.trick], tricks: Object.fromEntries(Object.entries(c.tricks).map(([k, v]) => [k, [...v]])), winners: [...c.winners],
      belote: { ...c.belote }, contract: { ...c.contract! }, scores: [...c.scores], history: [], result: null };
  }
  return null;
}
/** The deal played to its end by the rules: what it is worth to my team (its points, the contract made or not). */
function rollout(w: Coinche, me: string, rng: Rng) {
  for (let k = 0; k < 40 && w.phase === 'play'; k++) { const x = w.turn!; play(w, x, playByRules(remember(w, x), rng)); }
  const r = w.result!, mine = team(w, me);
  return r.score[mine] - r.score[(1 - mine) as 0 | 1];
}
function playByLooking(m: Memory, rng: Rng, worlds = 20): CCard {
  const cards = legal(m.c, m.me);
  if (cards.length === 1) return cards[0]!;
  const total = new Map(cards.map(cd => [cd.id, 0]));
  let n = 0;
  for (let k = 0; k < worlds; k++) {
    const w0 = sample(m, rng);
    if (!w0) continue;
    n++;
    for (const cd of cards) {
      const w = structuredClone(w0);
      play(w, m.me, cd);
      total.set(cd.id, total.get(cd.id)! + rollout(w, m.me, rng));
    }
  }
  const rules = playByRules(m, rng);
  if (!n) return rules;
  const best = Math.max(...total.values());
  const top = cards.filter(cd => total.get(cd.id)! >= best - 4 * n);   // within 4 points a deal: the rules decide
  return top.some(cd => cd.id === rules.id) ? rules : top.sort((a, b) => total.get(b.id)! - total.get(a.id)!)[0]!;
}

// ------------------------------------------------------------------ bidding
/** A hand's strength with this trump: about the points it brings (its team's, with an average partner). Sans atout:
 *  the Aces, the 10s behind them, a long suit led by its Ace; tout atout: the Jacks, the 9s behind them, the Aces. */
export function strength(hand: CCard[], trump: Trump) {
  const has0 = (r: number, s: Suit) => hand.some(cd => cd.s === s && cd.r === r);
  if (trump === 'SA') return SUITS.reduce((v, s) => {
    const n = hand.filter(cd => cd.s === s).length, a = has0(14, s);
    return v + (a ? 24 : 0) + (has0(10, s) ? (a ? 14 : n >= 2 ? 4 : 0) : 0) + (a && has0(13, s) && has0(10, s) ? 6 : 0) + (a && n >= 4 ? (n - 3) * 8 : 0);
  }, 0);
  if (trump === 'TA') return SUITS.reduce((v, s) => {
    const n = hand.filter(cd => cd.s === s).length, j = has0(11, s);
    return v + (j ? 22 : 0) + (has0(9, s) ? (j ? 14 : n >= 2 ? 5 : 0) : 0) + (has0(14, s) && j && has0(9, s) ? 6 : 0) + (j && n >= 4 ? (n - 3) * 6 : 0);
  }, 0);
  const tr = hand.filter(cd => cd.s === trump), has = (r: number, s = trump) => hand.some(cd => cd.s === s && cd.r === r);
  let v = 0;
  if (has(11)) v += 25;
  if (has(9)) v += has(11) || tr.length >= 3 ? 17 : 8;
  if (has(14)) v += 10;
  if (has(10)) v += 6;
  v += Math.max(0, tr.length - 2) * 8;
  if (has(13) && has(12)) v += 20;
  for (const s of SUITS.filter(x => x !== trump)) {
    const n = hand.filter(cd => cd.s === s).length;
    if (has(14, s)) v += 12;
    if (has(10, s)) v += has(14, s) ? 8 : n >= 2 ? 3 : 0;
    if (n === 0 && tr.length >= 2) v += 6;   // a void: a trick to cut
  }
  return v;
}
/** The points my team makes about 85 times out of 100 with this strength (measured: 3 000 deals played by « moyen »):
 *  a fall costs 160 + the bid, a cautious bid wins more (`pnpm coinche:duel`). */
const sure = (v: number, t: Trump) => (t === 'SA' ? 34 + 0.63 * v : t === 'TA' ? 26 + 0.67 * v : 8 + 1.2 * v);   // measured for each kind (4 000 deals each)
/** The bid these points are worth (82 at least), or 0. */
const worth = (p: number) => (p >= 82 ? Math.min(160, Math.floor(p / 10) * 10) : 0);

/** The contract my hand makes best: the most points sure (strengths of SA and TA are on their own scales). */
function bestTrump(hand: CCard[]) { return TRUMPS.map(s => ({ s, v: strength(hand, s) })).sort((a, b) => sure(b.v, b.s) - sure(a.v, a.s))[0]!; }

/** « fort »: the deal played on hands drawn at random, me bidding this trump: the points my team makes 9 times out of
 *  10, for each suit. */
function simulateBid(c: Coinche, me: string, rng: Rng, deals = 14, pct = 0.1) {
  const hand = c.hands[me]!, mine = new Set(hand.map(x => x.id)), rest = deck().filter(x => !mine.has(x.id));
  return TRUMPS.map(s => {
    const made: number[] = [];
    for (let k = 0; k < deals; k++) {
      const cards = [...rest].sort(() => rng() - 0.5), w: Coinche = structuredClone({ ...c, hands: {}, result: null, history: [] }) as Coinche;
      let i = 0;
      for (const x of c.seats) w.hands[x] = x === me ? [...hand] : cards.slice(i * 8, (i += 1) * 8);
      Object.assign(w, { phase: 'play', contract: { by: me, value: 80, suit: s, mult: 1 }, turn: c.seats[(c.seats.indexOf(c.dealer) + 1) % 4], trick: [], winners: [], tricks: Object.fromEntries(c.seats.map(x => [x, []])) });
      w.belote = { by: isSuit(s) ? c.seats.find(x => w.hands[x]!.some(y => y.s === s && y.r === 13) && w.hands[x]!.some(y => y.s === s && y.r === 12)) ?? null : null, said: 0 };
      for (let n = 0; n < 40 && w.phase === 'play'; n++) { const x = w.turn!; play(w, x, playByRules(remember(w, x), rng)); }
      const r = w.result!, t = team(c, me);
      made.push(r.points[t] + (r.belote === t ? 20 : 0));
    }
    made.sort((a, b) => a - b);
    return { s, p: made[Math.floor(made.length * pct)]! };
  }).sort((a, b) => b.p - a.p)[0]!;
}

const NOISE: Record<Level, number> = { facile: 30, moyen: 6, fort: 0 };
function aiSay(c: Coinche, me: string, level: Level, rng: Rng, simulate = level === 'fort', pct = 0.1): Say {
  const o = options(c, me)!, hand = c.hands[me]!, k = c.contract;
  if (c.coincheBy) {   // coinched: surcoinche a sure contract
    const v = strength(hand, k!.suit) + (k!.by === me ? 0 : 20);
    return o.surcoinche && worth(sure(v, k!.suit)) >= k!.value + 30 && level !== 'facile' ? { kind: 'surcoinche' } : { kind: 'pass' };
  }
  const partner = partnerOf(c, me), mineK = k && team(c, k.by) === team(c, me);
  // the opponents' contract: coinche when the defence (my Aces, my trumps in their suit) holds it
  if (k && !mineK && o.coinche) {
    const tr = hand.filter(x => isTrump(x, k.suit)), aces = hand.filter(x => !isTrump(x, k.suit) && x.r === 14).length;
    const def = (isSuit(k.suit) ? aces * 16 + (tr.some(x => x.r === 11) ? 22 : 0) + (tr.some(x => x.r === 9) ? 10 : 0) + Math.max(0, tr.length - 1) * 6
      : k.suit === 'SA' ? aces * 24 + hand.filter(x => x.r === 10 && hand.some(y => y.s === x.s && y.r === 14)).length * 10
      : hand.filter(x => x.r === 11).length * 24 + hand.filter(x => x.r === 9 && hand.some(y => y.s === x.s && y.r === 11)).length * 10) + (level === 'facile' ? (rng() - 0.5) * 40 : 0);
    if (def >= 162 - k.value + 25 && k.value >= 90) return { kind: 'coinche' };
  }
  const choice = simulate ? simulateBid(c, me, rng, 14, pct) : (() => { const b = bestTrump(hand); return { s: b.s, p: sure(b.v, b.s) + (rng() - 0.5) * NOISE[level] }; })();
  // the partner's bid: supported with my Aces and top trumps in his suit, or my own suit if much better
  const partnerBid = [...c.speeches].reverse().find(x => x.kind === 'bid' && x.by === partner) as { value: number; suit: Trump } | undefined;
  if (partnerBid && k && mineK) {
    const ps = partnerBid.suit, tr = isSuit(ps) ? hand.filter(x => x.s === ps) : [];
    const support = ps === 'SA' ? hand.filter(x => x.r === 14).length * 10 : ps === 'TA' ? hand.filter(x => x.r === 11).length * 10 + hand.filter(x => x.r === 9).length * 5
      : hand.filter(x => x.s !== ps && x.r === 14).length * 10 + (tr.some(x => x.r === 11) ? 20 : tr.some(x => x.r === 9) ? 10 : 0) + (tr.length >= 3 ? 10 : 0);
    const raise = Math.min(160, partnerBid.value + Math.floor(support / 10) * 10 - 10);
    if (raise > k.value && o.values.includes(raise)) return { kind: 'bid', value: raise, suit: partnerBid.suit };
    return { kind: 'pass' };
  }
  const value = worth(choice.p);
  if (value && o.values.includes(value) && !(k && team(c, k.by) === team(c, me))) return { kind: 'bid', value, suit: choice.s };
  if (value && level !== 'facile' && o.values.includes(CAPOT) && isSuit(choice.s) && hand.every(x => x.s === choice.s ? true : x.r === 14) && hand.filter(x => x.s === choice.s).length >= 5) return { kind: 'bid', value: CAPOT, suit: choice.s };
  return { kind: 'pass' };
}

/** A robot's move on its seat's view: a word in the bidding, or a card. */
export function decide(c: Coinche, me: string, level: Level, rng: Rng = Math.random, how: { simulateBid?: boolean; look?: boolean; pct?: number } = {}): { say: Say } | { play: CCard } {
  if (c.phase === 'bid') return { say: aiSay(c, me, level, rng, how.simulateBid ?? level === 'fort', how.pct) };
  const m = remember(c, me);
  return { play: (how.look ?? level === 'fort') ? playByLooking(m, rng) : playByRules(m, rng, level === 'facile' ? 0.25 : 0) };
}
