import { describe, expect, it } from 'vitest';
import { Poll, Wheel } from './index.js';

describe('Sondage', () => {
  it('groups free answers whatever the case, accents and final punctuation', () => {
    const p = { kind: 'free' as const, question: 'Un mot ?', choices: [], pics: [], answers: { a: 'Fromage !', b: 'fromage', c: 'Chocolat' } };
    const o = Poll.outcome(p, 'h');
    expect(o.ranked[0]).toMatchObject({ value: 2 });
    expect(o.winner).toBe('fromage');
  });
  it('a tie for number 1 is broken by the host\'s answer', () => {
    const p = { kind: 'choices' as const, question: 'Où ?', choices: ['Japon', 'Islande'], pics: [null, null], answers: { a: 0, b: 1, h: 1 } as Record<string, Poll.PollAnswer> };
    expect(Poll.outcome(p, 'h')).toMatchObject({ winner: '1', hostEdge: false });
    const tie = { ...p, answers: { a: 0, h: 1 } };
    expect(Poll.outcome(tie, 'h')).toMatchObject({ winner: '1', hostEdge: true });
  });
  it('gradient: a corner takes all, the centre shares equally', () => {
    const cs = Poll.corners(4);
    expect(Poll.shares(cs[0]!, cs)[0]).toBeCloseTo(1);
    expect(Poll.shares([0, 0], cs).map(v => Math.round(v * 100))).toEqual([25, 25, 25, 25]);
  });
});

describe('Roulette', () => {
  it('propositions without weight share what is left of 100; over 100 is refused', () => {
    const items = [{ label: 'Pizza', weight: '50' }, { label: 'Sushi', weight: '' }, { label: 'Tacos', weight: '' }];
    expect(Wheel.shares(items).map(Math.round)).toEqual([50, 25, 25]);
    expect(Wheel.problem([{ label: 'A', weight: '80' }, { label: 'B', weight: '30' }])).toBe('over');
  });
  it('the winner is the sector under the drawn angle', () => {
    expect(Wheel.sectorAt([50, 25, 25], 10)).toBe(0);
    expect(Wheel.sectorAt([50, 25, 25], 200)).toBe(1);
    const s = Wheel.draw([{ label: 'A', weight: '' }, { label: 'B', weight: '' }]);
    expect(s.winner).toBe(Wheel.sectorAt(s.shares, s.angle));
  });
});
