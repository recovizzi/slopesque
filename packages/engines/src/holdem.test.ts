// The Hold'em on the spec's situations (openspec: card-games, Texas Hold'em) and whole games played by the robots.
import { describe, expect, it } from 'vitest';
import { Holdem as H, HoldemAI as AI } from './index.js';

const cs = (ids: string) => ids.split(' ').map(H.card);
const ev = (ids: string) => H.evaluate(cs(ids));
/** A hand set by hand: these seats (in table order) and chips, the button, the hole cards and the board to come. */
function table(stacks: Record<string, number>, holes: Record<string, string>, board = 'C2 D3 H9 S11 C13', button?: string) {
  const seats = Object.keys(stacks), btn = button ?? seats.at(-1)!;
  const g = H.newGame(seats, { stack: 1000, every: 0 });
  Object.assign(g, { stacks: { ...stacks }, hand: 0, button: seats[(seats.indexOf(btn) - 1 + seats.length) % seats.length] });
  H.dealHand(g);   // the button moves to btn
  for (const [s, h] of Object.entries(holes)) g.holes[s] = cs(h);
  const b = cs(board);
  g.deck = [b[4]!, H.card('S2'), b[3]!, H.card('S3'), b[2]!, b[1]!, b[0]!, H.card('S4')];   // popped: burn, flop, burn, turn, burn, river
  return g;
}
const play = (g: H.Holdem, ...moves: [string, H.Move['act'], number?][]) => {
  for (const [s, act, to] of moves) expect(H.act(g, s, { act, to }), `${s} ${act} ${to ?? ''}`).toBe(true);
};

describe('Hold\'em hands', () => {
  it('ranks the categories and their kickers', () => {
    const order = ['S2 H5 D9 C11 S13 H3 D7', 'S2 H2 D9 C11 S13 H3 D7', 'S2 H2 D9 C9 S13 H3 D7', 'S2 H2 D2 C9 S13 H3 D7', 'S2 H3 D4 C5 S6 H11 D13',
      'S2 S5 S9 S11 S13 H3 D7', 'S2 H2 D2 C9 S9 H3 D7', 'S2 H2 D2 C2 S9 H3 D7', 'S5 S6 S7 S8 S9 H3 D7'].map(x => ev(x));
    expect(order.map(e => e.cat)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < order.length; i++) expect(order[i]!.score).toBeGreaterThan(order[i - 1]!.score);
    expect(ev('S14 H14 D9 C8 S2 H3 D4').score).toBeGreaterThan(ev('S14 H14 D9 C7 S2 H3 D5').score);   // the kicker
    expect(ev('S14 H2 D3 C4 S5 H9 D11').values).toEqual([5]);   // the wheel: 5-high
    expect(ev('S14 H2 D3 C4 S5 H6 D11').values).toEqual([6]);
    expect(H.handName(ev('S14 S13 S12 S11 S10 H2 D3'))).toBe('Quinte flush royale');
    expect(H.handName(ev('S12 H12 D12 C4 S4 H9 D2'))).toBe('Full aux Dames par les 4');
    expect(H.handName(ev('S14 H14 D9 C8 S2 H3 D4'))).toBe('Paire d\'As');
    expect(ev('S12 H12 D12 C4 S4 H9 D2').five.map(c => c.r).sort()).toEqual([12, 12, 12, 4, 4].sort());
  });
});

describe('Hold\'em betting', () => {
  it('the minimum raise: after a raise to 60 over 10 / 20, the next raise is at least to 100 (all-in still allowed)', () => {
    const g = table({ a: 1000, b: 1000, c: 1000, d: 80 }, {}, undefined, 'd');   // d button, a small blind, b big blind
    expect(g.turn).toBe('c');
    play(g, ['c', 'raise', 60]);
    const o = H.options(g, 'd')!;
    expect(o.raise).toEqual({ min: 80, max: 80 });   // d has only 80: all-in for less
    play(g, ['d', 'allin']);
    expect(H.options(g, 'a')!.raise!.min).toBe(120);   // a short all-in doesn't change the raise size: 80 + 40
    expect(H.act(g, 'a', { act: 'raise', to: 110 })).toBe(false);
  });

  it('a short all-in doesn\'t reopen the betting for who already acted', () => {
    const g = table({ a: 1000, b: 1000, c: 1000, d: 140 }, {}, undefined, 'd');
    play(g, ['c', 'raise', 100], ['d', 'allin'], ['a', 'fold'], ['b', 'call']);   // d all-in to 140: +40, under the 80 of a full raise
    expect(g.turn).toBe('c');
    const o = H.options(g, 'c')!;
    expect(o.raise).toBeNull();
    expect(o.call).toBe(40);
  });

  it('heads-up: the button is the small blind, first before the flop, last after', () => {
    const g = table({ a: 1000, b: 1000 }, {}, undefined, 'a');
    expect([g.button, g.sbSeat, g.bbSeat, g.turn]).toEqual(['a', 'a', 'b', 'a']);
    play(g, ['a', 'call'], ['b', 'check']);
    expect(g.street).toBe('flop');
    expect(g.turn).toBe('b');
  });

  it('the big blind may raise when everyone called', () => {
    const g = table({ a: 1000, b: 1000, c: 1000 }, {}, undefined, 'c');   // c button, a small, b big
    play(g, ['c', 'call'], ['a', 'call']);
    expect(g.turn).toBe('b');
    expect(H.options(g, 'b')!.check).toBe(true);
    play(g, ['b', 'raise', 80]);
    expect(g.turn).toBe('c');
  });

  it('a side pot: Léa all-in for 300 has the best hand, Malo the second: 900 to Léa, 800 to Malo', () => {
    const g = table({ lea: 300, malo: 1000, zoe: 1000 }, { lea: 'S14 H14', malo: 'S13 H13', zoe: 'S7 H2' }, 'C2 D3 H9 S11 C12', 'zoe');
    // zoe button, lea small blind, malo big blind; zoe first
    play(g, ['zoe', 'call'], ['lea', 'allin'], ['malo', 'call'], ['zoe', 'call']);
    expect(g.street).toBe('flop');
    play(g, ['malo', 'raise', 400], ['zoe', 'call']);
    play(g, ['malo', 'check'], ['zoe', 'check'], ['malo', 'check'], ['zoe', 'check']);
    expect(g.street).toBe('showdown');
    expect(g.result!.awards.map(a => [a.amount, a.winners])).toEqual([[900, ['lea']], [800, ['malo']]]);
    expect([g.stacks.lea, g.stacks.malo, g.stacks.zoe]).toEqual([900, 1100, 300]);
  });

  it('a bet nobody calls comes back; the others folded: won without showing', () => {
    const g = table({ a: 1000, b: 1000, c: 1000 }, {}, undefined, 'c');
    play(g, ['c', 'raise', 200], ['a', 'fold'], ['b', 'fold']);
    expect(g.result!.uncontested).toBe(true);
    expect(g.stacks.c).toBe(1030);
    expect(H.holdemView(g, 'a').holes.c!.every(x => x.r === 0)).toBe(true);
  });

  it('a split pot: the odd chip to the first winner left of the button', () => {
    const g = table({ a: 1000, b: 1000, c: 1000 }, { a: 'S2 H3', b: 'D2 C3', c: 'S4 H5' }, 'S14 H13 D12 C11 S10', 'c');   // the board plays: a straight for all
    play(g, ['c', 'fold'], ['a', 'call'], ['b', 'check']);
    for (let k = 0; k < 3; k++) play(g, ['a', 'check'], ['b', 'check']);
    expect(g.result!.awards[0]!.winners).toEqual(['a', 'b']);
    expect(g.stacks.a + g.stacks.b + g.stacks.c).toBe(3000);
    expect(g.stacks.a).toBe(g.stacks.b);
  });

  it('all-in and called: the hands are turned over, the board runs out', () => {
    const g = table({ a: 500, b: 1000 }, { a: 'S14 H14', b: 'S13 H13' }, 'C2 D3 H9 S11 C12', 'a');
    play(g, ['a', 'allin'], ['b', 'call']);
    expect(g.board.length).toBe(5);
    expect(g.street).toBe('showdown');
    expect(H.holdemView(g, 'b').holes.a!.map(c => c.id)).toEqual(['S14', 'H14']);
    expect(g.stacks.a).toBe(1000);
  });

  it('the game: eliminations give the places, the last one with chips wins; the host may end it', () => {
    const g = table({ a: 100, b: 1000, c: 1000 }, { a: 'S2 H7', b: 'S14 H14', c: 'S3 H8' }, 'C2 D3 H9 S11 C12', 'c');
    play(g, ['c', 'fold'], ['a', 'allin'], ['b', 'call']);
    expect(g.out).toEqual(['a']);
    expect(g.places.a).toBe(3);
    expect(H.placePoints(3, 3)).toBe(0);
    H.dealHand(g);
    expect(g.inHand).toEqual(['b', 'c']);
    expect(H.finish(g)).toBe(true);
    expect(g.places).toEqual({ a: 3, b: 1, c: 2 });
    expect(g.stacks.b + g.stacks.c).toBe(2100);
  });

  it('in chips: amounts by 5 (an all-in excepted); a bank as piles, a bet in the fewest chips', () => {
    const g = table({ a: 1000, b: 1000, c: 1000 }, {}, undefined, 'c');
    expect(H.act(g, 'c', { act: 'raise', to: 62 })).toBe(false);
    expect(H.act(g, 'c', { act: 'raise', to: 65 })).toBe(true);
    expect(H.chipsOf(1630)).toEqual([[1000, 1], [500, 1], [100, 1], [25, 1], [5, 1]]);
    expect(H.rackOf(1000)).toEqual([[5, 5], [25, 7], [100, 3], [500, 1]]);
    for (const n of [5, 20, 135, 500, 2000, 4995, 12345 - 0]) expect(H.rackOf(n).reduce((x, [v, k]) => x + v * k, 0)).toBe(Math.floor(n / 5) * 5);
  });

  it('the blinds rise every N hands', () => {
    const g = H.newGame(['a', 'b', 'c'], { stack: 5000, every: 2 });
    expect(g.bb).toBe(20);
    for (let k = 0; k < 2; k++) { while (g.turn) H.act(g, g.turn, { act: 'fold' }); H.dealHand(g); }
    expect([g.hand, g.sb, g.bb, g.levelUp]).toEqual([3, 20, 40, true]);
  });
});

describe('Hold\'em robots', () => {
  it('the Chen formula', () => {
    const c = (a: string, b: string) => AI.chen(H.card(a), H.card(b));
    expect(c('S14', 'H14')).toBe(20);
    expect(c('S13', 'H13')).toBe(16);
    expect(c('S2', 'H2')).toBe(5);
    expect(c('S5', 'H5')).toBe(6);
    expect(c('S14', 'S13')).toBe(12);
    expect(c('S7', 'H2')).toBe(-1);
    expect(c('S10', 'S9')).toBe(8);
  });

  it('the pot odds: a flush draw facing a pot-sized bet on the river\'s eve calls or folds, never raises', () => {
    const g = table({ a: 2000, b: 2000 }, { a: 'S9 S8', b: 'H11 C11' }, 'S2 S6 D11 C13 H4', 'a');
    play(g, ['a', 'call'], ['b', 'check']);
    play(g, ['b', 'check'], ['a', 'check']);   // the flop: S2 S6 D11
    expect(g.street).toBe('turn');
    play(g, ['b', 'raise', 40]);
    for (let k = 0; k < 10; k++) expect(['call', 'fold']).toContain(AI.decide(H.holdemView(g, 'a'), 'a', 'moyen').act);
  });

  it('the robots see their own cards only, and never make an illegal move: whole games at each level', () => {
    for (const level of ['facile', 'moyen', 'fort'] as AI.Level[]) {
      for (let n = 0; n < (level === 'fort' ? 2 : 4); n++) {
        const seats = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, 2 + ((n * 3) % 5));
        const g = H.newGame(seats, { stack: 500, every: 3 });
        const total = 500 * seats.length;
        for (let hands = 0; hands < 300 && !g.over; hands++) {
          for (let k = 0; k < 200 && g.turn; k++) {
            const v = H.holdemView(g, g.turn);
            expect(Object.entries(v.holes).filter(([s]) => s !== g.turn && !g.revealed).every(([, h]) => h.every(x => x.r === 0))).toBe(true);
            const m = AI.decide(v, g.turn, level);
            expect(H.act(g, g.turn, m), JSON.stringify(m)).toBe(true);
          }
          expect(Object.values(g.stacks).reduce((x, y) => x + y, 0)).toBe(total);
          if (!g.over) H.dealHand(g);
        }
        if (!g.over) H.finish(g);
        expect(Object.values(g.places).sort()).toEqual(seats.map((_, i) => i + 1));
      }
    }
  }, 120_000);

  it('« fort » decides quickly enough for a table', () => {
    const g = H.newGame(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], { stack: 1000, every: 10 });
    while (g.street === 'preflop' && g.turn) H.act(g, g.turn, { act: H.options(g, g.turn)!.check ? 'check' : 'call' });
    expect(g.street).toBe('flop');
    const start = performance.now();
    expect(H.options(g, g.turn!)).not.toBeNull();
    AI.decide(H.holdemView(g, g.turn!), g.turn!, 'fort');
    expect(performance.now() - start).toBeLessThan(400);
  });
});
