import { describe, expect, it } from 'vitest';
import { castVote, closeVote, needed, startVote } from './votes.js';
import { amountOf, tierOf } from './credit.js';

describe('votes', () => {
  const base = { kind: 'host' as const, by: 'a', target: 'a', label: 'demande à devenir l\'hôte' };
  it('the launcher votes yes; the target of a kick does not vote', () => {
    expect(startVote(base, ['a', 'b', 'c']).yes).toEqual(['a']);
    expect(startVote({ ...base, kind: 'kick', target: 'c' }, ['a', 'b', 'c']).voters).toEqual(['a', 'b']);
  });
  it('half the voters (rounded up) must vote; the majority wins; a tie is no', () => {
    let v = startVote(base, ['a', 'b', 'c', 'd', 'e']);
    expect(needed(v)).toBe(3);
    expect(closeVote(v).result).toBe('quorum');
    v = castVote(v, 'b', false)!.vote;
    expect(closeVote(v).result).toBe('quorum');
    v = castVote(v, 'c', true)!.vote;
    expect(closeVote(v).result).toBe('yes');
    const tie = castVote(startVote(base, ['a', 'b']), 'b', false)!;
    expect(tie.done).toBe(true);
    expect(closeVote(tie.vote).result).toBe('no');
  });
  it('a vote can be changed; outsiders can\'t vote', () => {
    const v = startVote(base, ['a', 'b', 'c']);
    const once = castVote(v, 'b', false)!.vote, twice = castVote(once, 'b', true)!.vote;
    expect([twice.yes, twice.no]).toEqual([['a', 'b'], []]);
    expect(castVote(v, 'z', true)).toBeNull();
  });
});

describe('social credit', () => {
  it('a hieroglyph per step, cut halfway', () => {
    expect([5, 7, 8, 14, 15, 59, 60, 100].map(n => `${tierOf(-n).code}/${tierOf(n).code}`).join(' '))
      .toBe('1301d/13020 1301d/13020 13013/13024 13013/13024 1300f/1304f 1300f/1304f 13012/1302d 13012/1302d');
  });
  it('a whole number from 1 to 1000', () => {
    expect([amountOf('0'), amountOf('12'), amountOf('1000'), amountOf('1001'), amountOf('2.5')]).toEqual([null, 12, 1000, null, null]);
  });
});
