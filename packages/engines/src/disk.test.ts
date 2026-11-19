import { describe, expect, it } from 'vitest';
import { diskView, guess, newDisk, nextRound, reveal, score, scoreSeat, seatOf, setRules, startRound, allValidated } from './disk.js';

describe('Demi-disque scoring', () => {
  it('perfect within the tolerance, 0 from 30 away', () => {
    expect(score(52, 50)).toMatchObject({ points: 150, perfect: true });
    expect(score(80, 50).points).toBe(0);
    expect(score(60, 50).points).toBe(74);
  });
  it('Amphithéâtre: by columns', () => {
    expect(scoreSeat(4, 4)).toMatchObject({ points: 150, perfect: true });
    expect(scoreSeat(5, 4).points).toBe(100);
    expect(scoreSeat(12, 4).points).toBe(0);
  });
});

describe('a round', () => {
  it('hides the host\'s ray from the others until the reveal; scores everyone', () => {
    let s = startRound(nextRound(newDisk()), 'h', 'France', 60, 0);
    expect(diskView(s, 'a').target).toBeNull();
    expect(diskView(s, 'h').target).toBe(60);
    s = guess(s, 'a', 61); s = guess(s, 'b', 30);
    expect(() => guess(s, 'a', 10)).toThrow('déjà validé');
    expect(allValidated(s, ['a', 'b'])).toBe(true);
    const r = reveal(s);
    expect(r.points.a).toBe(150);
    expect(r.best?.[0]).toBe('a');
    expect(r.state.hostPoints).toBe(Math.round(100 * ((1 - 1 / 30) + (1 - 30 / 30)) / 2));
    expect(diskView(r.state, 'a').target).toBe(60);
  });
  it('Amphithéâtre: a seat taken is refused', () => {
    let s = startRound(nextRound(newDisk({ ...newDisk().rules, mode: 'amphi' })), 'h', 'Chat', 4, 0);
    s = guess(s, 'a', seatOf(4, 2));
    expect(() => guess(s, 'b', seatOf(4, 2))).toThrow('pris');
  });
  it('rules changed during the round wait for its end', () => {
    let s = startRound(nextRound(newDisk()), 'h', 'X', 10, 0);
    const r = setRules(s, { roundSeconds: 60 });
    expect(r.now).toBe(false);
    s = reveal(r.state).state;
    expect(s.rules.roundSeconds).toBe(60);
  });
});
