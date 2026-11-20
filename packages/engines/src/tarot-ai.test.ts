// The Tarot's robots on the spec's situations (openspec: card-games, Robots honnêtes), each deciding on its seat's view.
import { describe, expect, it } from 'vitest';
import { Tarot as T, TarotAI as AI } from './index.js';

const card = (id: string): T.TCard => T.deck().find(c => c.id === id)!;
/** A seeded chance, for the same decisions each run. */
const rng = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
/** A deal at play, with these seats (in turn order), hands, trick on the table and turn. */
function table(seats: string[], hands: Record<string, string[]>, trick: [string, string][], turn: string, more: Partial<T.Tarot> = {}) {
  const t = T.deal(seats, null);
  Object.assign(t, { phase: 'play', taker: 'a', bid: 'garde', started: [...seats], ...more });
  t.hands = Object.fromEntries(seats.map(id => [id, (hands[id] ?? []).map(card)]));
  t.trick = trick.map(([by, id]) => ({ by, card: card(id) }));
  t.turn = turn;
  return t;
}
const decide = (t: T.Tarot, me: string, level: AI.Level = 'moyen') => {
  const d = AI.decide(T.tarotView(t, me), me, level, rng(), T.play);
  return 'play' in d ? d.play.id : '';
};

describe('Tarot robots', () => {
  it('the partner loads a trick his side is sure to take (he plays last)', () => {
    const t = table(['b', 'c', 'd', 'a', 'e'], { e: ['S13', 'S2', 'C3'], a: ['T4'], b: ['C5'], c: ['C6'], d: ['C7'] },
      [['b', 'S3'], ['c', 'S5'], ['d', 'S6'], ['a', 'T19']], 'e', { called: card('H14'), partner: 'e' });
    t.hands.e!.push(card('H14'));
    expect(decide(t, 'e')).toBe('S13');   // the Dame, not the 2
  });

  it('… but keeps his points when two defenders still play and the trick can be beaten', () => {
    const t = table(['d', 'a', 'e', 'b', 'c'], { e: ['S13', 'C2', 'H14'], a: ['T3'], b: ['T15'], c: ['T16'], d: ['T2'] },
      [['d', 'T5'], ['a', 'T12']], 'e', { called: card('H14'), partner: 'e' });
    expect(decide(t, 'e')).toBe('C2');
  });

  it('a defender gives nothing to the taker\'s trick', () => {
    const t = table(['a', 'b', 'c', 'd'], { b: ['S14', 'S2', 'C4'], a: ['T2'], c: ['T3'], d: ['T4'] }, [['a', 'T18']], 'b');
    t.hands.b = [card('S14'), card('S2'), card('C4')];
    expect(['S2', 'C4']).toContain(decide(t, 'b'));
  });

  it('the Petit is saved under a trick its side takes', () => {
    const t = table(['b', 'c', 'd', 'a', 'e'], { e: ['T1', 'T7', 'H14'], a: ['T4'], b: ['C5'], c: ['C6'], d: ['C7'] },
      [['b', 'S3'], ['c', 'S4'], ['d', 'S6'], ['a', 'T20']], 'e', { called: card('H14'), partner: 'e' });
    expect(decide(t, 'e')).toBe('T1');
  });

  it('a robot never sees what its seat can\'t: the others\' hands are backs in its view', () => {
    const t = T.deal(['a', 'b', 'c', 'd'], null);
    const v = T.tarotView(t, 'a');
    expect(Object.entries(v.hands).filter(([id]) => id !== 'a').every(([, h]) => h.every(c => c.r === 0))).toBe(true);
    const d = AI.decide(v, 'a', 'fort', rng(), T.play);
    expect('bid' in d).toBe(true);
  });

  it('whole deals at every level: legal moves only, a result whose marks add up to 0', () => {
    for (const [level, deals] of [['facile', 15], ['moyen', 15], ['fort', 2]] as [AI.Level, number][]) {
      for (let n = 0; n < deals; n++) {
        const seats = n % 2 ? ['a', 'b', 'c', 'd', 'e'] : ['a', 'b', 'c', 'd'];
        let t = T.deal(seats, null);
        for (let k = 0; k < 8 && !t.result; k++) {
          for (let s = 0; s < 400 && t.phase !== 'done'; s++) {
            const me = t.phase === 'dog' || t.phase === 'call' ? t.taker! : t.turn!;
            const d = AI.decide(T.tarotView(t, me), me, level, Math.random, T.play);
            if ('bid' in d) expect(T.bid(t, me, d.bid)).toBe(true);
            else if ('call' in d) expect(T.call(t, me, d.call)).toBe(true);
            else if ('discard' in d) expect(T.discard(t, d.discard)).toBe(true);
            else { if (d.handful) T.declareHandful(t, me, d.handful); expect(T.play(t, me, d.play)).toBe(true); }
          }
          if (!t.result) t = T.deal(seats, t);
        }
        if (t.result) expect(Object.values(t.result.marks).reduce((x, y) => x + y, 0)).toBe(0);
      }
    }
  }, 120_000);

  it('« fort » decides a card quickly enough for a table (under half a second)', () => {
    const t = T.deal(['a', 'b', 'c', 'd'], null);
    Object.assign(t, { phase: 'play', taker: 'a', bid: 'garde', turn: 'a' });
    const start = performance.now();
    const d = AI.decide(T.tarotView(t, 'a'), 'a', 'fort', rng(), T.play);
    expect('play' in d).toBe(true);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
