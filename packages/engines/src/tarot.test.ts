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
      for (let k = 0; k < 10 && t.phase !== 'done'; k++) { playOut(t); if (t.phase === 'done' && !t.result) t = T.deal(seats, t); }
      expect(t.phase).toBe('done');
      if (t.result) expect(Object.values(t.result.marks).reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});
