// The Tarot's robots (openspec: card-games, Robots honnêtes ; Niveau des robots). A robot decides only from its seat's
// view (tarotView): its hand, the cards fallen, the bids, the chien shown, the poignées, the partner once revealed.
// From them it keeps a memory — who can't follow a suit, who has no trump left or none above a rank, who is probably
// on its side — and plays by the classic rules of the game: load the tricks its side is sure to take, give nothing to
// the other side, win cheaply with a card that stays master, save the Petit, use the 21 on a rich trick, get rid of the
// Excuse before the end. Levels: « facile » makes mistakes and bids shy; « moyen » plays these rules with a little
// chance; « fort » also plays the rest of the deal on several possible deals of the cards it can't see (consistent with
// what it saw) and keeps the card that does best on average (perfect-information Monte Carlo).
import {
  BIDS, bidsFor, callable, canDiscard, ecartSize, halfPoints, handfulLevels, handfulSizes, isBout, legal, points, winner,
  type Bid, type TCard, type TPlay, type Tarot,
} from './tarot.js';

export type Level = 'facile' | 'moyen' | 'fort';
export const LEVELS: Record<Level, string> = { facile: 'Facile', moyen: 'Moyen', fort: 'Fort' };
export type Rng = () => number;
type Suit = 'S' | 'H' | 'C' | 'D';
type Color = Suit | 'T';   // a suit, or the trumps
const SUITS: Suit[] = ['S', 'H', 'C', 'D'];
const color = (c: TCard): Color | null => (c.kind === 'trump' ? 'T' : c.kind === 'suit' ? (c.s as Suit) : null);
const isPetit = (c: TCard) => c.kind === 'trump' && c.r === 1;
const is21 = (c: TCard) => c.kind === 'trump' && c.r === 21;
const pts = (c: TCard) => halfPoints(c) / 2;

/** What a seat knows, from its view only. */
interface Memory {
  me: string;
  t: Tarot;
  hand: TCard[];
  out: Set<string>;                          // fallen (played), or in my écart
  voids: Record<string, Set<Color>>;          // a player who can't have this colour any more
  trumpCap: Record<string, number>;           // … nor a trump above this rank
  us: (x: string) => boolean;                 // on my side (sure, or probable before the partner is known)
}

/** The plays so far: the tricks taken (in the view, all of them are there) and the trick on the table. */
function allTricks(t: Tarot): TPlay[][] {
  return [...Object.values(t.tricks).flat(), ...(t.trick.length ? [t.trick] : [])];
}

function remember(t: Tarot, me: string): Memory {
  const hand = t.hands[me] ?? [], out = new Set<string>();
  const voids: Record<string, Set<Color>> = Object.fromEntries(t.seats.map(s => [s, new Set<Color>()]));
  const trumpCap: Record<string, number> = Object.fromEntries(t.seats.map(s => [s, 21]));
  for (const trick of allTricks(t)) {
    const lead = trick.find(p => p.card.kind !== 'excuse')?.card;
    let top = 0;
    for (const p of trick) {
      out.add(p.card.id);
      const c = p.card;
      if (lead && c.kind !== 'excuse' && p.by !== trick.find(q => q.card.kind !== 'excuse')!.by) {
        const led = color(lead)!;
        if (color(c) !== led) {
          voids[p.by]!.add(led);                                   // didn't follow
          if (c.kind !== 'trump') { voids[p.by]!.add('T'); trumpCap[p.by] = 0; }   // nor trumped: no trump
        }
        if (c.kind === 'trump' && top && c.r < top) trumpCap[p.by] = Math.min(trumpCap[p.by]!, top);   // didn't overtrump: none above
      }
      if (c.kind === 'trump') top = Math.max(top, c.r);
    }
  }
  if (me === t.taker) for (const c of t.ecart) if (c.r) out.add(c.id);   // my own écart
  // my side: the taker and his partner; at 5, before the called card falls, guessed from the play
  const partner = t.partner ?? (t.called && hand.some(c => c.id === t.called!.id) ? me : null);
  const guess = partner ?? guessPartner(t, me);
  const taker = t.taker;
  const side = (x: string) => x === taker || x === guess;
  const us = (x: string) => (x === me ? true : side(me) === side(x));
  return { me, t, hand, out, voids, trumpCap, us };
}

/** At 5, before the called card falls: the player who most looks like the taker's partner (he fed the taker's tricks
 *  with points, led the called suit, kept clear of beating him), or nobody. */
function guessPartner(t: Tarot, me: string): string | null {
  if (t.seats.length !== 5 || !t.taker || !t.called) return null;
  const score: Record<string, number> = {};
  for (const trick of allTricks(t)) {
    if (trick.length < t.seats.length) continue;
    const w = winner(trick);
    for (const p of trick) {
      if (p.by === t.taker || p.by === me) continue;
      if (w === t.taker && pts(p.card) >= 2.5) score[p.by] = (score[p.by] ?? 0) + 2;          // fed the taker
      if (w === p.by && trick.some(q => q.by === t.taker && pts(q.card) >= 2.5)) score[p.by] = (score[p.by] ?? 0) - 2;   // took from him
      if (trick[0]!.by === p.by && p.card.kind === 'suit' && p.card.s === t.called.s) score[p.by] = (score[p.by] ?? 0) + 1;
    }
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

/** The cards nobody has played and that I don't hold. */
const unseen = (m: Memory) => {
  const mine = new Set(m.hand.map(c => c.id));
  return allCards().filter(c => !m.out.has(c.id) && !mine.has(c.id));
};
let DECK: TCard[] | null = null;
function allCards() {
  if (!DECK) {
    const suits = SUITS.flatMap(s => Array.from({ length: 14 }, (_, i) => ({ id: `${s}${i + 1}`, kind: 'suit' as const, r: i + 1, s })));
    DECK = [...suits, ...Array.from({ length: 21 }, (_, i) => ({ id: `T${i + 1}`, kind: 'trump' as const, r: i + 1 })), { id: 'EX', kind: 'excuse' as const, r: 0 }];
  }
  return DECK;
}

/** The players still to play in this trick, after me. */
function after(t: Tarot, me: string) {
  const n = t.seats.length, i = t.seats.indexOf(me), left = n - t.trick.length - 1;
  return Array.from({ length: left }, (_, k) => t.seats[(i + 1 + k) % n]!);
}

/** Can a player still beat this trick (with what he may hold)? */
function canBeat(m: Memory, x: string, trick: TPlay[]) {
  const lead = trick.find(p => p.card.kind !== 'excuse')?.card;
  if (!lead) return true;
  const w = trick.find(p => p.by === winner(trick))!.card, free = unseen(m);
  const trumps = free.filter(c => c.kind === 'trump' && c.r <= m.trumpCap[x]! && !m.voids[x]!.has('T'));
  if (w.kind === 'trump') return trumps.some(c => c.r > w.r) && (lead.kind === 'trump' || m.voids[x]!.has(color(lead)!) || !free.some(c => c.s === lead.s));
  const led = color(lead)!;
  const higher = free.some(c => c.kind === 'suit' && c.s === lead.s && c.r > w.r) && !m.voids[x]!.has(led);
  const cut = trumps.length > 0 && (m.voids[x]!.has(led) || !free.some(c => c.s === lead.s));
  return higher || cut;
}

/** Is the trick sure for the side now winning it (nobody left to play can beat it)? */
const sure = (m: Memory, trick: TPlay[]) => after(m.t, m.me).every(x => m.us(x) === m.us(winner(trick)) || !canBeat(m, x, trick));

const low = (cs: TCard[]) => [...cs].sort((a, b) => pts(a) - pts(b) || (a.kind === 'trump' ? 1 : 0) - (b.kind === 'trump' ? 1 : 0) || a.r - b.r)[0]!;
const high = (cs: TCard[]) => [...cs].sort((a, b) => pts(b) - pts(a) || b.r - a.r)[0]!;

// ------------------------------------------------------------------ the card (moyen: the rules)
function playByRules(m: Memory, rng: Rng): TCard {
  const { t, me } = m;
  let cards = legal(t, me);
  if (cards.length === 1) return cards[0]!;
  const ex = cards.find(c => c.kind === 'excuse');
  const left = m.hand.length;
  if (ex && left <= 2 && !t.chelem) return ex;                     // never kept to the last trick (it would be lost)
  const noEx = cards.filter(c => c.kind !== 'excuse');
  if (noEx.length) cards = noEx;
  const trick = t.trick;

  if (!trick.length) return lead(m, cards, rng);

  const w = winner(trick), ours = m.us(w), last = after(t, me).length === 0, value = trick.reduce((s, p) => s + pts(p.card), 0);
  const beat = cards.filter(c => winner([...trick, { by: me, card: c }]) === me);
  if (ours && (last || sure(m, trick))) {
    const petit = cards.find(isPetit), withPetit: TPlay[] = petit ? [...trick, { by: me, card: petit }] : [];
    if (petit && m.us(winner(withPetit)) && (last || sure(m, withPetit))) return petit;   // save the Petit: in a trick my side is sure to take
    const load = cards.filter(c => c.kind === 'suit');
    return load.length ? high(load) : low(cards.filter(c => !is21(c)).length ? cards.filter(c => !is21(c)) : cards);   // load the points
  }
  if (!ours || !sure(m, trick)) {
    // win it if worth it, with a card that stays master (the cheapest), never with the Petit unless it can't be beaten
    const safe = beat.filter(c => !after(t, me).some(x => !m.us(x) && canBeat(m, x, [...trick, { by: me, card: c }])));
    const worth = !ours && (value >= 1 || last || after(t, me).length <= 1);
    const take = safe.filter(c => !isPetit(c) || safe.length === 1);
    if (take.length && (worth || value >= 2.5)) {
      const cheap = take.filter(c => !is21(c));
      if (cheap.length) return low(cheap);
      if (value >= 4) return take.find(is21)!;                   // the 21 for a rich trick
    }
    if (ex && (ours ? false : low(cards).r >= 11 || pts(low(cards)) >= 2.5)) return ex;   // nothing cheap to give: the Excuse
  }
  const give = cards.filter(c => !isPetit(c) && !is21(c));
  return low(give.length ? give : cards);                          // keep the points, the bouts
}

/** Leading a trick: the taker's side draws trumps when it has them, plays its masters; the defence plays a master or a
 *  small card of a long suit, avoiding the colours a taker's opponent cuts. */
function lead(m: Memory, cards: TCard[], rng: Rng): TCard {
  const { t, me } = m, taker = me === t.taker || (!!t.partner && me === t.partner);
  const free = unseen(m), trumps = cards.filter(c => c.kind === 'trump'), outTrumps = free.filter(c => c.kind === 'trump').length;
  const master = cards.filter(c => c.kind === 'suit' && !free.some(f => f.s === c.s && f.r > c.r)
    && t.seats.every(x => x === me || m.us(x) || !m.voids[x]!.has(c.s as Color) || m.voids[x]!.has('T')));
  if (t.chelem === me) return trumps.length ? high(trumps) : master.length ? high(master) : high(cards);
  if (taker && trumps.length >= Math.max(3, outTrumps / 2) && outTrumps > 0) {
    const draw = trumps.filter(c => !isPetit(c) && !is21(c));
    if (draw.length) return high(draw);                            // draw the trumps out
  }
  if (master.length) return high(master);
  const suits = cards.filter(c => c.kind === 'suit');
  if (suits.length) {
    const len = (s?: string) => m.hand.filter(c => c.s === s).length;
    const safe = suits.filter(c => !t.seats.some(x => x !== me && !m.us(x) && m.voids[x]!.has(c.s as Color) && !m.voids[x]!.has('T')));
    const pool = (safe.length ? safe : suits).filter(c => c.r < 11);
    const from = pool.length ? pool : (safe.length ? safe : suits);
    const longest = Math.max(...from.map(c => len(c.s)));
    const choices = from.filter(c => len(c.s) === longest);
    return choices.length > 1 && rng() < 0.3 ? choices[Math.floor(rng() * choices.length)]! : low(choices);
  }
  const plain = trumps.filter(c => !isPetit(c) && !is21(c));
  return plain.length ? low(plain) : low(cards);
}

// ------------------------------------------------------------------ fort: the rest of the deal, on possible deals
/** A full deal consistent with what this seat saw: the unseen cards given to the others (and to the hidden écart or
 *  chien), each where it can be (no suit someone failed to follow, no trump above what he refused to play). */
function sample(m: Memory, rng: Rng): Tarot | null {
  const { t, me } = m;
  const others = t.seats.filter(x => x !== me);
  const need: Record<string, number> = Object.fromEntries(others.map(x => [x, t.hands[x]!.length]));
  const hidden = t.phase === 'play' ? t.ecart.filter(c => !c.r).length : 0;   // the écart (or chien) I haven't seen
  const pile = '#';   // the écart or chien nobody (but the taker) has seen
  if (hidden) need[pile] = hidden;
  const fixed: Record<string, TCard[]> = Object.fromEntries([...others, pile].map(x => [x, []]));
  const free = unseen(m);
  const placeOf = new Map<string, string>();
  for (const [x, h] of Object.entries(t.handfuls)) if (x !== me) for (const c of h.cards) if (free.some(f => f.id === c.id)) placeOf.set(c.id, x);
  for (let tries = 0; tries < 30; tries++) {
    const left = { ...need }, hands: Record<string, TCard[]> = Object.fromEntries(Object.keys(fixed).map(x => [x, [] as TCard[]]));
    const cards = [...free].sort(() => rng() - 0.5);
    let ok = true;
    for (const c of cards) {
      const forced = placeOf.get(c.id);
      const shown = t.shownChien.some(s => s.id === c.id) && t.taker && t.taker !== me;
      const can = forced ? [forced] : Object.keys(left).filter(x => left[x]! > 0 && (x === pile
        ? (t.bid === 'sans' || t.bid === 'contre' || (!(c.kind === 'suit' && c.r === 14) && !isBout(c)))
        : !(shown && x !== t.taker) && (tries > 20 || (!m.voids[x]!.has(color(c) ?? 'T') && !(c.kind === 'trump' && c.r > m.trumpCap[x]!)))));
      const shownCan = shown ? can.filter(x => x === t.taker || x === pile) : can;
      const pick = (shownCan.length ? shownCan : can);
      if (!pick.length) { ok = false; break; }
      const x = pick[Math.floor(rng() * pick.length)]!;
      if ((left[x] ?? 0) <= 0) { ok = false; break; }
      hands[x]!.push(c); left[x]!--;
    }
    if (!ok || Object.values(left).some(n => n !== 0)) continue;
    const world: Tarot = { ...t, hands: { ...Object.fromEntries(others.map(x => [x, hands[x]!])), [me]: [...m.hand] }, trick: t.trick.map(p => ({ ...p })),
      won: Object.fromEntries(Object.entries(t.won).map(([k, v]) => [k, [...v]])), tricks: Object.fromEntries(Object.entries(t.tricks).map(([k, v]) => [k, [...v]])),
      winners: [...t.winners], started: [...t.started], ecart: hidden ? hands[pile]! : [...t.ecart] };
    if (t.called && !t.partner) {   // the partner, in this world: whoever got the called card
      const holder = t.seats.find(x => world.hands[x]!.some(c => c.id === t.called!.id));
      world.partner = holder ?? null;
    }
    return world;
  }
  return null;
}

/** A quick play for the simulations (everything visible): win cheaply when the other side leads it, load a trick of
 *  one's side when last, else give the least. */
function quick(w: Tarot, x: string, rng: Rng): TCard {
  const cards = legal(w, x), side = (y: string) => y === w.taker || y === w.partner;
  if (cards.length === 1) return cards[0]!;
  if (!w.trick.length) {
    const tr = cards.filter(c => c.kind === 'trump' && !isPetit(c));
    if (side(x) && tr.length > 2) return high(tr);
    const pool = cards.filter(c => c.kind === 'suit');
    return pool.length ? (rng() < 0.5 ? low(pool) : pool[Math.floor(rng() * pool.length)]!) : low(cards);
  }
  const win = winner(w.trick), last = w.trick.length === w.seats.length - 1;
  if (side(win) === side(x)) return last ? high(cards.filter(c => c.kind !== 'excuse' && !is21(c)).length ? cards.filter(c => c.kind !== 'excuse' && !is21(c)) : cards) : low(cards);
  const beat = cards.filter(c => winner([...w.trick, { by: x, card: c }]) === x && !isPetit(c));
  return beat.length ? low(beat) : low(cards.filter(c => !isPetit(c)).length ? cards.filter(c => !isPetit(c)) : cards);
}

/** The rest of a deal played quickly; my side's card points at the end (with the Petit au bout). */
function rollout(w: Tarot, me: string, rng: Rng, play: (w: Tarot, id: string, c: TCard) => boolean) {
  for (let k = 0; k < 400 && w.phase === 'play'; k++) { const x = w.turn!; if (!play(w, x, quick(w, x, rng))) break; }
  const side = (y: string) => y === w.taker || y === w.partner, mine = side(me);
  const taken = w.seats.filter(x => side(x) === mine).flatMap(x => w.won[x]!);
  return points(taken) + (w.result?.petit ? ((w.result.petit === 'taker') === mine ? 10 : -10) : 0);
}

function playByLooking(m: Memory, rng: Rng, play: (w: Tarot, id: string, c: TCard) => boolean, worlds = 24): TCard {
  const cards = legal(m.t, m.me);
  if (cards.length === 1) return cards[0]!;
  const total = new Map<string, number>(cards.map(c => [c.id, 0]));
  let n = 0;
  for (let k = 0; k < worlds; k++) {
    const w0 = sample(m, rng);
    if (!w0) continue;
    n++;
    for (const c of cards) {
      const w = structuredClone(w0);
      if (!play(w, m.me, w.hands[m.me]!.find(x => x.id === c.id)!)) continue;
      total.set(c.id, total.get(c.id)! + rollout(w, m.me, rng, play));
    }
  }
  if (!n) return playByRules(m, rng);
  const rules = playByRules(m, rng);   // the rules break the ties (and stay when the simulations agree)
  const best = Math.max(...total.values());
  const top = cards.filter(c => total.get(c.id)! >= best - 0.5 * n);
  return top.some(c => c.id === rules.id) ? rules : top[0]!;
}

// ------------------------------------------------------------------ bids, call, écart, announcements
/** A hand's strength by the usual count (bouts, trumps, Kings, long suits, cuts). */
export function strength(hand: TCard[]) {
  const trumps = hand.filter(c => c.kind === 'trump'), n = trumps.length;
  let s = n * 2 + trumps.filter(c => c.r >= 16).length;
  if (trumps.some(is21)) s += 10;
  if (hand.some(c => c.kind === 'excuse')) s += 8;
  if (trumps.some(isPetit)) s += n >= 5 ? 8 : 4;
  for (const su of SUITS) {
    const cs = hand.filter(c => c.s === su), has = (r: number) => cs.some(c => c.r === r);
    if (has(14)) s += has(13) ? 9 : 6;
    else if (has(13)) s += 3;
    if (cs.length >= 5) s += cs.length === 5 ? 5 : 7;
    if (!cs.length) s += 5;   // a cut
  }
  return s;
}

const NOISE: Record<Level, number> = { facile: 10, moyen: 3, fort: 1 };   // facile: erratic bids (sometimes too bold)
export function aiBid(t: Tarot, me: string, level: Level, rng: Rng): Bid {
  // thresholds from the strength of random hands (2 000 deals: at 4, the best hand of the table is 40 at the median,
  // 52 in 5 % of deals): someone takes in about 4 deals out of 5, a Garde sans is rare, a Garde contre rarer
  const five = t.seats.length === 5, shift = five ? -6 : 0;
  const s = strength(t.hands[me] ?? []) + (rng() * 2 - 1) * NOISE[level];
  const want: Bid = s >= 64 + shift ? 'contre' : s >= 56 + shift ? 'sans' : s >= 44 + shift ? 'garde' : s >= 34 + shift ? 'prise' : 'pass';
  return bidsFor(t).includes(want) ? want : 'pass';
}

/** At 5: a King (Queen…) in a suit where I hold the cards under it, not my own. */
export function aiCall(t: Tarot): string {
  const h = t.hands[t.taker!] ?? [], len = (s?: string) => h.filter(c => c.s === s).length;
  const below = (c: TCard) => h.filter(x => x.s === c.s && x.r >= 11).length;
  return [...callable(t)].sort((a, b) => Number(h.some(x => x.id === a.id)) - Number(h.some(x => x.id === b.id)) || below(b) - below(a) || len(b.s) - len(a.s))[0]!.id;
}

/** The écart: cuts first (the shortest suits emptied), the points that are safe there (Queens, Cavaliers), never a
 *  King or a bout, a trump only when nothing else may go. */
export function aiDiscard(t: Tarot): TCard[] {
  const h = t.hands[t.taker!] ?? [], len = (s?: string) => h.filter(c => c.s === s && c.kind === 'suit').length;
  const kings = (s?: string) => h.some(c => c.s === s && c.r === 14);
  return h.filter(c => canDiscard(t, c)).sort((a, b) => (a.kind === 'trump' ? 1 : 0) - (b.kind === 'trump' ? 1 : 0)
    || Number(kings(a.s)) - Number(kings(b.s)) || len(a.s) - len(b.s) || pts(b) - pts(a)).slice(0, ecartSize(t));
}

/** A poignée before my first card: the taker shows his (it counts for the winners); a defender sometimes. */
export function aiHandful(t: Tarot, me: string, level: Level, rng: Rng): 1 | 2 | 3 | null {
  const lv = handfulLevels(t, me);
  if (!lv.length) return null;
  const top = lv[lv.length - 1]!;
  if (me === t.taker || me === t.partner) return level === 'facile' && rng() < 0.4 ? null : top;
  return rng() < (level === 'facile' ? 0.3 : 0.5) ? top : null;
}

/** A chelem: only a hand that can't lose a trick (nearly all the trumps, the 21 and the Excuse, Kings or cuts). */
export function aiChelem(t: Tarot, me: string, level: Level): boolean {
  if (level === 'facile' || me !== t.taker) return false;
  const h = t.hands[me] ?? [], trumps = h.filter(c => c.kind === 'trump');
  const loose = h.filter(c => c.kind === 'suit' && c.r !== 14).length;
  return trumps.some(is21) && h.some(c => c.kind === 'excuse') && trumps.length >= handfulSizes(t.seats.length)[2]! && loose === 0;
}

// ------------------------------------------------------------------ the decision
/** What a robot does now (its seat's view, its level): a bid, a call, an écart or a card (with a poignée shown before
 *  its first card). `play` is the engine's (to simulate at « fort »). */
export function decide(t: Tarot, me: string, level: Level, rng: Rng, play: (w: Tarot, id: string, c: TCard) => boolean):
  { bid: Bid } | { call: string } | { discard: TCard[] } | { play: TCard; handful: 1 | 2 | 3 | null } {
  if (t.phase === 'bid') return { bid: aiBid(t, me, level, rng) };
  if (t.phase === 'call') return { call: aiCall(t) };
  if (t.phase === 'dog') return { discard: aiDiscard(t) };
  const m = remember(t, me), handful = aiHandful(t, me, level, rng);
  if (level === 'facile' && rng() < 0.35) {   // a beginner's mistake: any card, but never a bout thrown away
    const cards = legal(t, me), plain = cards.filter(c => !isBout(c) || cards.length === 1);
    return { play: plain[Math.floor(rng() * plain.length)] ?? cards[0]!, handful };
  }
  const card = level === 'fort' ? playByLooking(m, rng, play) : playByRules(m, rng);
  return { play: card, handful };
}

export const mult = (b: Exclude<Bid, 'pass'>) => BIDS[b].mult;
