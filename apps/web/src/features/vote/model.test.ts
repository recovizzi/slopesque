import { describe, expect, test } from 'vitest';
import { fmtLeft, voteCount } from './model';

describe('vote', () => {
  test('its time left, m:ss, never below zero', () => {
    expect(fmtLeft(61_000)).toBe('1:01');
    expect(fmtLeft(999)).toBe('0:01');
    expect(fmtLeft(-5000)).toBe('0:00');
  });

  test('its count', () => {
    expect(voteCount(2, 0, 2, 3)).toBe('Oui 2 · Non 0 · il faut 2 votes pour que ça compte (3 connectés)');
    expect(voteCount(0, 1, 1, 1)).toBe('Oui 0 · Non 1 · il faut 1 vote pour que ça compte (1 connecté)');
  });
});
