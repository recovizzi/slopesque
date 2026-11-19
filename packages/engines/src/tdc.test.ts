import { describe, expect, it } from 'vitest';
import { Table, Tdc } from './index.js';

describe('Trou du cul', () => {
  it('deals every card; the 3 of clubs leads the first round; a seat sees only its hand', () => {
    const t = Tdc.deal(['s0', 's1', 's2', 's3'], null, id => id);
    expect(Object.values(t.hands).flat()).toHaveLength(52);
    expect(t.hands[t.turn!]!.some(c => c.id === '3C')).toBe(true);
    const v = Tdc.tdcView(t, 's0');
    expect(v.hands.s0).toEqual(t.hands.s0);
    expect(v.hands.s1!.every(c => c.r === 0)).toBe(true);
    expect(v.hands.s1).toHaveLength(13);
  });
  it('a play must beat the trick with as many cards', () => {
    const t = Tdc.deal(['a', 'b', 'c'], null, id => id);
    t.trick = [{ by: 'a', cards: [{ id: '7H', r: 7, s: 'H' }, { id: '7S', r: 7, s: 'S' }] }];
    expect(Tdc.canPlay(t, [{ id: '9C', r: 9, s: 'C' }, { id: '9D', r: 9, s: 'D' }])).toBe(true);
    expect(Tdc.canPlay(t, [{ id: 'KC', r: 13, s: 'C' }])).toBe(false);
  });
  it('a robot always has a legal move, and robots alone finish a round', () => {
    const t = Tdc.deal(['a', 'b', 'c', 'd'], null, id => id);
    for (let k = 0; k < 500 && t.turn !== null; k++) {
      const m = Tdc.botMove(t, t.turn);
      expect('play' in m ? Tdc.play(t, t.turn, m.play) : Tdc.pass(t, t.turn)).toBe(true);
    }
    expect(t.turn).toBeNull();
    expect(Object.values(t.roles).sort()).toEqual(['president', 'tdc', 'vice', 'vtdc'].sort());
  });
});

describe('table seats', () => {
  it('join a robot seat, leave mid-round (name and points kept), freed at the end', () => {
    let seats = Table.seatTable(['u1'], 3);
    expect(seats.filter(s => !s.user)).toHaveLength(2);
    const j = Table.join(seats, 'u2');
    if (typeof j === 'string') throw new Error(j);
    seats = j.seats;
    expect(Table.join(seats, 'u2')).toBe('seated');
    seats = Table.leave(seats, 'u1', true);
    expect(seats[0]).toMatchObject({ user: null, credit: 'u1' });
    const s = Table.settle(seats);
    expect(s.freed).toEqual(['u1']);
    expect(s.seats[0]!.credit).toBeNull();
  });
});
