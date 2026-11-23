import { describe, expect, it } from 'vitest';
import { Tarot as T } from './index.js';

/** A whole deal played by robots, each on what its seat may see. */
function playOut(t: T.Tarot) {
  for (let k = 0; k < 400 && t.phase !== 'done'; k++) {
    if (t.phase === 'bid') { const id = t.turn!; T.bid(t, id, T.botBid(T.tarotView(t, id), id)); }
    else if (t.phase === 'call') T.call(t, t.taker!, T.botCall(T.tarotView(t, t.taker)));
    else if (t.phase === 'dog') T.discard(t, T.botDiscard(T.tarotView(t, t.taker)));
    else if (t.phase === 'play') { const id = t.turn!; expect(T.play(t, id, T.botPlay(T.tarotView(t, id), id))).toBe(true); }
  }
}

describe('Tarot: the classic deal', () => {
  it('the tricks and the écart gathered, cut, dealt 3 by 3 with the chien: every card once', () => {
    for (const seats of [['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'e']]) {
      let t = T.deal(seats, null);
      for (let n = 0; n < 3; n++) {
        for (let k = 0; k < 400 && t.phase !== 'done'; k++) {
          if (t.phase === 'bid') T.bid(t, t.turn!, T.bidsFor(t).includes('garde') && t.turn === t.seats[0] ? 'garde' : 'pass');
          else if (t.phase === 'call') T.call(t, t.taker!, T.callable(t)[0]!.id);
          else if (t.phase === 'dog') T.discard(t, T.botDiscard(t));
          else T.play(t, t.turn!, T.legal(t, t.turn!)[0]!);
        }
        t = T.deal(seats, t, 'classic');
        const ids = [...seats.flatMap(s => t.hands[s]!.map(c => c.id)), ...t.chien.map(c => c.id)];
        expect([new Set(ids).size, t.chien.length]).toEqual([78, seats.length === 5 ? 3 : 6]);
      }
    }
  });
});

describe('Tarot', () => {
  it('at 4: 18 cards each and a chien of 6; a seat sees only its hand', () => {
    const t = T.deal(['a', 'b', 'c', 'd'], null);
    expect(Object.values(t.hands).map(h => h.length)).toEqual([18, 18, 18, 18]);
    expect(t.chien).toHaveLength(6);
    const v = T.tarotView(t, 'a');
    expect(v.hands.a).toEqual(t.hands.a);
    expect(v.hands.b!.every(c => c.r === 0)).toBe(true);
  });
  it('at 5: the partner hidden from the others until the called card is played', () => {
    for (let n = 0; n < 20; n++) {
      const t = T.deal(['a', 'b', 'c', 'd', 'e'], null);
      for (let k = 0; k < 10 && t.phase === 'bid'; k++) { const id = t.turn!; T.bid(t, id, id === 'a' && t.bids.a === undefined ? 'garde' : 'pass'); }
      if (t.phase !== 'call') continue;
      T.call(t, t.taker!, T.botCall(T.tarotView(t, t.taker)));
      const outsider = t.seats.find(id => id !== t.taker && id !== t.partner)!;
      expect(T.tarotView(t, outsider).partner).toBeNull();
      if (t.partner) expect(T.tarotView(t, t.partner).partner).toBe(t.partner);
      return;
    }
  });
  it('robots finish deals at 4 and 5, with a result and marks adding up to 0', () => {
    for (const seats of [['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'e']]) {
      let t = T.deal(seats, null);
      for (let k = 0; k < 10; k++) { playOut(t); if ((t.phase as string) === 'done' && t.result) break; t = T.deal(seats, t); }
      expect(t.phase).toBe('done');
      if (t.result) expect(Object.values(t.result.marks).reduce((a, b) => a + b, 0)).toBe(0);
    }
  });

  // ---- the FFT bonuses: a deal brought to its last trick, the rest already won
  const card = (id: string): T.TCard => T.deck().find(c => c.id === id)!;
  /** At 4, a (taker, Garde) has won the 17 first tricks (or not); the last trick is played from these hands. */
  function lastTrick(hands: Record<string, string[]>, takerWonAll: boolean) {
    const t = T.deal(['a', 'b', 'c', 'd'], null), last = new Set(Object.values(hands).flat());
    Object.assign(t, { phase: 'play', taker: 'a', bid: 'garde', turn: 'a', bids: { a: 'garde', b: 'pass', c: 'pass', d: 'pass' }, ecart: [], started: ['a', 'b', 'c', 'd'] });
    t.hands = Object.fromEntries(Object.entries(hands).map(([id, h]) => [id, h.map(card)]));
    const rest = T.deck().filter(c => !last.has(c.id));
    const w = takerWonAll ? 'a' : 'b';
    t.won = { a: [], b: [], c: [], d: [] }; t.won[w] = rest;
    t.tricks = { a: [], b: [], c: [], d: [] };
    for (let k = 0; k < 17; k++) { t.tricks[w]!.push([{ by: w, card: rest[k]! }]); t.winners.push(w); }
    return t;
  }
  const playLast = (t: T.Tarot) => { for (const id of ['a', 'b', 'c', 'd']) expect(T.play(t, id, t.hands[id]![0]!)).toBe(true); return t.result!; };

  it('the Petit au bout: 10 × the contract for the side taking the last trick with it', () => {
    const r = playLast(lastTrick({ a: ['T1'], b: ['S2'], c: ['H2'], d: ['C2'] }, true));
    expect(r.petit).toBe('taker');
    const r2 = playLast(lastTrick({ a: ['S3'], b: ['T1'], c: ['H3'], d: ['C3'] }, false));
    expect(r2.petit).toBe('defense');
  });

  it('a chelem: +200 made unannounced, +400 announced; the Excuse led last wins it', () => {
    const t = lastTrick({ a: ['EX'], b: ['S2'], c: ['H2'], d: ['C2'] }, true);
    const r = playLast(t);
    expect(t.winners.at(-1)).toBe('a');   // the Excuse, led by the side that took everything, takes the last trick
    expect(r.chelem).toBe(200);
    const t2 = lastTrick({ a: ['T21'], b: ['S2'], c: ['H2'], d: ['C2'] }, true);
    t2.chelem = 'a';
    expect(playLast(t2).chelem).toBe(400);
    const t3 = lastTrick({ a: ['S3'], b: ['T21'], c: ['H3'], d: ['C3'] }, true);
    t3.chelem = 'a';
    expect(playLast(t3).chelem).toBe(-200);   // announced, one trick lost
  });

  it('a poignée: shown before the first card, its points to the side that wins the deal', () => {
    const t = T.deal(['a', 'b', 'c', 'd'], null);
    Object.assign(t, { phase: 'play', taker: 'a', bid: 'prise', turn: 'b' });
    t.hands.b = [...T.deck().filter(c => c.kind === 'trump').slice(0, 10), ...t.hands.b!.slice(0, 8)];
    expect(T.handfulLevels(t, 'b')).toEqual([1]);
    expect(T.declareHandful(t, 'b', 1)).toBe(true);
    expect(t.handfuls.b!.cards).toHaveLength(10);
    expect(T.declareHandful(t, 'b', 1)).toBe(false);   // once
    t.started.push('c');
    expect(T.handfulLevels(t, 'c')).toEqual([]);       // after one's first card: too late
  });
});
