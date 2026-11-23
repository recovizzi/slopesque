// The Coinche on the spec's situations (openspec: card-games, Coinche) and whole games played by the robots.
import { describe, expect, it } from 'vitest';
import { Coinche as C, CoincheAI as AI } from './index.js';

const cs = (ids: string) => ids.split(' ').map(C.card);
/** A deal at play with this contract, these hands (seats a b c d: teams a & c, b & d), the trick on the table. */
function table(contract: Partial<C.Contract>, hands: Record<string, string>, trick: [string, string][] = [], turn = 'a') {
  const g = C.newGame(['a', 'b', 'c', 'd']);
  Object.assign(g, { phase: 'play', contract: { by: 'a', value: 80, suit: 'H', mult: 1, ...contract }, turn });
  g.hands = Object.fromEntries(['a', 'b', 'c', 'd'].map(s => [s, hands[s] ? cs(hands[s]) : []]));
  g.trick = trick.map(([by, id]) => ({ by, card: C.card(id) }));
  return g;
}
const ids = (cards: C.CCard[]) => cards.map(x => x.id).sort();

describe('Coinche: the bidding', () => {
  it('higher each time; three passes end it; four passes: a new deal', () => {
    const g = C.newGame(['a', 'b', 'c', 'd']);
    expect(g.turn).toBe('a');
    expect(C.bid(g, 'a', { kind: 'bid', value: 90, suit: 'S' })).toBe(true);
    expect(C.bid(g, 'b', { kind: 'bid', value: 90, suit: 'H' })).toBe(false);
    expect(C.bid(g, 'b', { kind: 'bid', value: 100, suit: 'H' })).toBe(true);
    for (const s of ['c', 'd', 'a']) C.bid(g, s, { kind: 'pass' });
    expect(g.phase).toBe('play');
    expect(g.contract).toMatchObject({ by: 'b', value: 100, suit: 'H', mult: 1 });
    expect(g.turn).toBe('a');   // the dealer's left leads
    const h = C.newGame(['a', 'b', 'c', 'd']);
    for (const s of ['a', 'b', 'c', 'd']) C.bid(h, s, { kind: 'pass' });
    expect([h.phase, h.note]).toEqual(['done', 'Tout le monde a passé : nouvelle donne.']);
  });

  it('a coinche by an opponent ends the bidding; the bidders may surcoinche; no coinche on a partner or a capot', () => {
    const g = C.newGame(['a', 'b', 'c', 'd']);
    C.bid(g, 'a', { kind: 'bid', value: 120, suit: 'S' });
    expect(C.options(g, 'b')!.coinche).toBe(true);
    C.bid(g, 'b', { kind: 'pass' });
    expect(C.options(g, 'c')!.coinche).toBe(false);   // his partner's bid
    C.bid(g, 'c', { kind: 'pass' });
    C.bid(g, 'd', { kind: 'coinche' });
    expect([g.contract!.mult, g.turn]).toEqual([2, 'a']);
    expect(C.bid(g, 'a', { kind: 'bid', value: 130, suit: 'S' })).toBe(false);
    C.bid(g, 'a', { kind: 'pass' });
    expect(g.turn).toBe('c');
    C.bid(g, 'c', { kind: 'surcoinche' });
    expect([g.phase, g.contract!.mult]).toEqual(['play', 4]);
    const h = C.newGame(['a', 'b', 'c', 'd']);
    C.bid(h, 'a', { kind: 'bid', value: C.CAPOT, suit: 'H' });
    expect(h.phase).toBe('play');
  });
});

describe('Coinche: the hand', () => {
  it('sorted with the trump first, by its order (Valet, 9, As, 10…), then the colours alternating', () => {
    expect(C.sortHand(cs('S7 H14 H11 C10 D13 H9 S14 H7'), 'H').map(x => x.id)).toEqual(['H11', 'H9', 'H14', 'H7', 'S14', 'S7', 'D13', 'C10']);
    expect(C.suitOrder('C')).toEqual(['C', 'H', 'S', 'D']);
  });
});

describe('Coinche: the tricks', () => {
  it('follow the suit (no need to beat it)', () => {
    const g = table({}, { b: 'S7 S14 H7' }, [['a', 'S10']], 'b');
    expect(ids(C.legal(g, 'b'))).toEqual(['S14', 'S7']);
  });
  it('on a trump lead, go higher if possible', () => {
    const g = table({ suit: 'H' }, { b: 'H7 H9 S7' }, [['a', 'H14']], 'b');
    expect(ids(C.legal(g, 'b'))).toEqual(['H9']);
  });
  it('without the suit, an opponent master: trump; over his trump, overtrump, else a lower trump (pisser)', () => {
    expect(ids(C.legal(table({ suit: 'H' }, { b: 'H7 C7' }, [['a', 'S10']], 'b'), 'b'))).toEqual(['H7']);
    expect(ids(C.legal(table({ suit: 'H' }, { c: 'H7 H11 D8' }, [['a', 'S10'], ['b', 'H9']], 'c'), 'c'))).toEqual(['H11']);
    expect(ids(C.legal(table({ suit: 'H' }, { c: 'H7 H8 D8' }, [['a', 'S10'], ['b', 'H9']], 'c'), 'c'))).toEqual(['H7', 'H8']);
  });
  it('the partner master: free (no need to trump)', () => {
    const g = table({ suit: 'H' }, { c: 'H7 D8' }, [['a', 'S14'], ['b', 'S7']], 'c');
    expect(ids(C.legal(g, 'c'))).toEqual(['D8', 'H7']);
  });
  it('the trick: the highest trump, else the highest of the suit led', () => {
    expect(C.winner([{ by: 'a', card: C.card('S10') }, { by: 'b', card: C.card('S14') }, { by: 'c', card: C.card('D14') }, { by: 'd', card: C.card('H7') }], 'H')).toBe('d');
    expect(C.winner([{ by: 'a', card: C.card('H9') }, { by: 'b', card: C.card('H11') }], 'H')).toBe('b');
    expect(C.winner([{ by: 'a', card: C.card('S9') }, { by: 'b', card: C.card('S11') }], 'H')).toBe('b');   // plain: the Jack over the 9
  });
});

describe('Coinche: the count', () => {
  it('a whole deal counted (made, failed, coinched), the scores adding up', () => {
    let seen = 0;
    for (let n = 0; n < 200 && seen < 3; n++) {
      const g = C.newGame(['a', 'b', 'c', 'd']);
      C.bid(g, 'a', { kind: 'bid', value: 100, suit: 'H' });
      C.bid(g, 'b', { kind: 'coinche' });
      C.bid(g, 'c', { kind: 'pass' }); C.bid(g, 'a', { kind: 'pass' });   // the bidders answer, in turn
      for (let k = 0; k < 40 && g.phase === 'play'; k++) C.play(g, g.turn!, C.legal(g, g.turn!)[0]!);
      const r = g.result!;
      expect(r.points[0] + r.points[1]).toBe(r.capot !== null ? 250 : 162);
      const bel = (t: 0 | 1) => (r.belote === t ? 20 : 0);
      if (r.made) expect(r.score[0]).toBe(C.round10(r.points[0]) + 200 + bel(0));
      else expect(r.score).toEqual([bel(0), 160 + 200 + bel(1)]);
      expect(r.made).toBe(r.points[0] + bel(0) >= 100);
      seen++;
    }
    expect(seen).toBe(3);
  });
  it('the game ends after the deal that reaches the target; the higher team wins', () => {
    const g = C.newGame(['a', 'b', 'c', 'd'], 1000);
    g.scores = [950, 400];
    C.bid(g, 'a', { kind: 'bid', value: 80, suit: 'S' });
    for (const s of ['b', 'c', 'd']) C.bid(g, s, { kind: 'pass' });
    for (let k = 0; k < 40 && g.phase === 'play'; k++) C.play(g, g.turn!, C.legal(g, g.turn!)[0]!);
    if (Math.max(...g.scores) >= 1000 && g.scores[0] !== g.scores[1]) expect([g.over, g.winner]).toEqual([true, g.scores[0] > g.scores[1] ? 0 : 1]);
    else expect(g.over).toBe(false);
  });
  it('belote-rebelote: said when the trump King and Queen are played by their holder', () => {
    const g = table({ suit: 'H' }, { a: 'H13 H12', b: 'S7 S8', c: 'S9 S10', d: 'C7 C8' });
    g.belote = { by: 'a', said: 0 };
    C.play(g, 'a', C.card('H13'));
    expect(g.belote.said).toBe(1);
  });
});

describe('Coinche robots', () => {
  const rng = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  it('the partner loads a sure trick (he plays last): his 10, not a 7', () => {
    const h = table({ by: 'a', suit: 'H' }, { c: 'C10 C7 D8' }, [['d', 'S9'], ['a', 'S14'], ['b', 'S7']], 'c');
    const d = AI.decide(C.coincheView(h, 'c'), 'c', 'moyen', rng());
    expect('play' in d && d.play.id).toBe('C10');
  });
  it('a robot only sees its own hand', () => {
    const g = C.newGame(['a', 'b', 'c', 'd']);
    const v = C.coincheView(g, 'a');
    expect(Object.entries(v.hands).filter(([s]) => s !== 'a').every(([, h]) => h.every(x => x.r === 0))).toBe(true);
    expect('say' in AI.decide(v, 'a', 'fort', rng())).toBe(true);
  });
  it('whole games at every level: legal words and cards only, the scores adding up', () => {
    for (const [level, games] of [['facile', 3], ['moyen', 3], ['fort', 1]] as [AI.Level, number][]) {
      for (let n = 0; n < games; n++) {
        const g = C.newGame(['a', 'b', 'c', 'd'], 1000);
        for (let deals = 0; deals < 40 && !g.over; deals++) {
          for (let k = 0; k < 80 && g.phase !== 'done'; k++) {
            const me = g.turn!, d = AI.decide(C.coincheView(g, me), me, level);
            if ('say' in d) expect(C.bid(g, me, d.say), JSON.stringify(d.say)).toBe(true);
            else expect(C.play(g, me, d.play), d.play.id).toBe(true);
          }
          C.passedOut(g);
          if (!g.over) C.dealHand(g);
        }
        expect(g.history.reduce((t, h) => t + h.score[0] + h.score[1], 0)).toBe(g.scores[0] + g.scores[1]);
      }
    }
  }, 180_000);
});
