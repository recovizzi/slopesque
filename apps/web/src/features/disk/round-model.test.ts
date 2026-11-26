// What a round shows to each role: the host's answer is never drawn for the others before the reveal (the server
// doesn't even send it), mine waits « non validé » until I validate it.
import type { DiskView } from '@slopesque/shared';
import { describe, expect, test } from 'vitest';
import {
  amphiMarks,
  canPick,
  diskRays,
  gapText,
  modeOf,
  rankedResults,
  roleOf,
  seatLost,
  type Painter,
} from './round-model';

const view = (p: Partial<DiskView> = {}): DiskView => ({
  rules: { topic: 'Les pays ?', left: 'de gauche', right: 'de droite', roundSeconds: 30, mode: 'ray' },
  pending: null,
  round: 1,
  phase: 'lobby',
  word: '',
  mode: 'ray',
  target: null,
  host: 'h',
  guesses: {},
  results: {},
  hostPoints: null,
  deadline: null,
  ...p,
});
const paint: Painter = {
  color: id => `c-${id}`,
  name: id => (id === 'me' ? 'Toi' : id),
  hostColor: 'c-h',
  hostName: 'Hugo',
};

test('roles', () => {
  expect(roleOf('me', 'me', false)).toBe('host');
  expect(roleOf('h', 'me', true)).toBe('candidate');
  expect(roleOf('h', 'me', false)).toBe('spectator');
  expect(roleOf(null, 'me', false)).toBe('spectator');
});

test("the round's board: the rules' until it starts, then its own", () => {
  expect(modeOf(view({ rules: { ...view().rules, mode: 'amphi' } }))).toBe('amphi');
  expect(modeOf(view({ phase: 'guessing', mode: 'ray', rules: { ...view().rules, mode: 'amphi' } }))).toBe('ray');
});

test('who may pick: the host before the round, a candidate until he validates', () => {
  expect(canPick(view(), 'host', 'me')).toBe(true);
  expect(canPick(view({ phase: 'writing' }), 'candidate', 'me')).toBe(false);
  expect(canPick(view({ phase: 'guessing' }), 'candidate', 'me')).toBe(true);
  expect(canPick(view({ phase: 'guessing', guesses: { me: 3 } }), 'candidate', 'me')).toBe(false);
  expect(canPick(view({ phase: 'guessing' }), 'host', 'me')).toBe(false);
  expect(canPick(view({ phase: 'reveal' }), 'candidate', 'me')).toBe(false);
});

describe('the rays', () => {
  test("the host's own ray while he places it", () => {
    expect(diskRays(view(), 'host', 'h', 42, paint)).toEqual([
      { id: 'target', value: 42, color: 'c-h', kind: 'target' },
    ]);
    expect(diskRays(view(), 'candidate', 'me', 42, paint)).toEqual([]);
  });

  test('while guessing: no target (hidden), the validated rays, mine « non validé »', () => {
    const d = view({ phase: 'guessing', guesses: { a: 10 } });
    expect(diskRays(d, 'candidate', 'me', 30, paint)).toEqual([
      { id: 'a', value: 10, color: 'c-a', kind: 'player', label: 'a' },
      { id: 'me', value: 30, color: 'c-me', kind: 'mine', label: 'Toi (non validé)' },
    ]);
    expect(diskRays(view({ phase: 'guessing', guesses: { me: 12 } }), 'candidate', 'me', 30, paint)).toEqual([
      { id: 'me', value: 12, color: 'c-me', kind: 'mine', label: 'Toi' },
    ]);
  });

  test("at the reveal: the host's answer as the target", () => {
    const rays = diskRays(view({ phase: 'reveal', target: 55, guesses: { a: 50 } }), 'candidate', 'me', null, paint);
    expect(rays[0]).toEqual({ id: 'target', value: 55, color: 'c-h', kind: 'target', label: 'Hugo (hôte)' });
    expect(rays).toHaveLength(2);
  });
});

describe('the seats', () => {
  test("the host's column filled while he chooses it, then a band", () => {
    expect(amphiMarks(view(), 'host', 'h', 7, paint).column).toEqual({ col: 7, color: 'c-h', style: 'fill' });
    expect(amphiMarks(view({ phase: 'reveal', target: 7 }), 'candidate', 'me', null, paint).column).toEqual({
      col: 7,
      color: 'c-h',
      style: 'band',
    });
    expect(amphiMarks(view({ phase: 'guessing' }), 'candidate', 'me', null, paint).column).toBeNull();
  });

  test('the seats taken, mine pending', () => {
    const m = amphiMarks(view({ phase: 'guessing', guesses: { a: 84 } }), 'candidate', 'me', 85, paint);
    expect(m.seats).toEqual([
      { seat: 84, color: 'c-a', kind: 'player', label: 'a' },
      { seat: 85, color: 'c-me', kind: 'pending', label: 'Toi (non validé)' },
    ]);
  });

  test('my seat taken by someone else first: lost', () => {
    const d = view({ phase: 'guessing', mode: 'amphi', guesses: { a: 85 } });
    expect(seatLost(d, 'me', 85)).toBe(true);
    expect(seatLost(d, 'me', 86)).toBe(false);
    expect(seatLost({ ...d, mode: 'ray' }, 'me', 85)).toBe(false);
  });
});

test('the results: the gap in degrees or columns, best first', () => {
  expect(gapText('ray', 10)).toBe('à 18°');
  expect(gapText('amphi', 0)).toBe('dans la colonne');
  expect(gapText('amphi', 1)).toBe('à 1 colonne');
  expect(gapText('amphi', 3)).toBe('à 3 colonnes');
  const d = view({
    results: { a: { distance: 9, points: 20, perfect: false }, b: { distance: 1, points: 150, perfect: true } },
  });
  expect(rankedResults(d).map(([id]) => id)).toEqual(['b', 'a']);
});
