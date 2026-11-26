// The Trou du cul's table in words: the line under the pile, a seat's state, my hint, my choice, the watcher's way in.
import { describe, expect, test } from 'vitest';
import { Tdc as T } from '@slopesque/engines';
import { cardLabel, hint, joinText, pick, pileText, seatState, shownPlays, tilt } from './model';

const C = (r: number, s: T.Suit): T.Card => ({ id: `${r}${s}`, r, s });
const round = (o: Partial<T.Tdc> = {}): T.Tdc => ({
  seats: ['a', 'b', 'c'],
  hands: { a: [C(5, 'H'), C(5, 'S'), C(9, 'C')], b: [], c: [] },
  trick: [],
  lastTrick: [],
  turn: 'a',
  passed: [],
  out: [],
  roles: {},
  round: 2,
  startedAt: 0,
  exchanges: [],
  ...o,
});
const name = (id: string) => ({ a: 'Toi', b: 'Biscotte', c: 'Zinzin' })[id]!;

test('a card and a play on the table', () => {
  expect(cardLabel(C(12, 'H'))).toBe('Dame de cœur');
  expect(cardLabel(C(15, 'S'))).toBe('2 de pique');
  expect(tilt([C(7, 'H')])).toBe(tilt([C(7, 'S')])); // the same way for the same value and count
  expect(Math.abs(tilt([C(14, 'C'), C(14, 'D')]))).toBeLessThanOrEqual(8);
});

describe('the middle of the table', () => {
  test('the last 3 plays; the trick just taken, closed', () => {
    const plays = [3, 4, 5, 6].map(r => ({ by: 'b', cards: [C(r, 'C')] }));
    expect(shownPlays(round({ trick: plays })).plays.map(p => p.cards[0]!.r)).toEqual([4, 5, 6]);
    expect(shownPlays(round({ lastTrick: plays })).closed).toBe(true);
  });
  test('the play to beat', () => {
    const t = round({ trick: [{ by: 'b', cards: [C(7, 'H'), C(7, 'S')] }] });
    expect(pileText(t, 'a', name)).toBe('Biscotte : une paire de 7 — à battre avec autant de cartes plus fortes');
  });
  test('who took the trick, my turn to open', () => {
    const t = round({ lastTrick: [{ by: 'c', cards: [C(15, 'H')] }] });
    expect(pileText(t, 'a', name)).toBe("Zinzin ramasse le pli : à toi d'ouvrir");
    expect(pileText({ ...t, turn: 'c' }, 'a', name)).toBe('Zinzin ramasse le pli');
  });
  test('an empty trick; nothing once the round is over', () => {
    expect(pileText(round(), 'a', name)).toBe('Pli vide : ouvre avec 1 à 4 cartes de même valeur');
    expect(pileText(round({ turn: null }), 'a', name)).toBe('');
  });
});

test("a seat's state: out (its place) or passed", () => {
  const t = round({ out: ['c', 'b'], passed: ['a'] });
  expect([seatState(t, 'c'), seatState(t, 'b'), seatState(t, 'a')]).toEqual(['sorti 1er', 'sorti 2e', 'passe']);
  expect(seatState(round(), 'a')).toBeNull();
});

describe('my hint', () => {
  const pair = [C(5, 'H'), C(5, 'S')];
  test('not my turn, nothing chosen, playable or not', () => {
    expect(hint(round({ turn: 'b' }), 'a', [])).toBe('Attends ton tour…');
    expect(hint(round(), 'a', [])).toBe('Choisis tes cartes (même valeur)');
    expect(hint(round(), 'a', pair)).toBe('Jouer une paire de 5 ?');
    expect(hint(round({ trick: [{ by: 'b', cards: [C(9, 'H'), C(9, 'D')] }] }), 'a', pair)).toBe(
      'Pas jouable : autant de cartes que le pli, plus fortes',
    );
  });
  test('the round over: nothing', () => expect(hint(round({ turn: null }), 'a', pair)).toBe(''));
});

test('my choice: cards of one value, a click again takes one back', () => {
  const hand = round().hands.a!;
  let chosen = pick(hand, new Set(), '5H');
  chosen = pick(hand, chosen, '5S');
  expect([...chosen]).toEqual(['5H', '5S']);
  expect([...pick(hand, chosen, '5H')]).toEqual(['5S']);
  expect([...pick(hand, chosen, '9C')]).toEqual(['9C']); // another value: a new choice
  expect(pick(hand, chosen, 'zz')).toBe(chosen);
});

describe("the watcher's way in", () => {
  const s = { free: 2, total: 4, mine: false, takes: 'Biscotte', full: false };
  test("a robot's seat", () => {
    expect(joinText(s, false)).toEqual({
      label: 'Prendre la place de Biscotte',
      why: '2 places sur 4 sont jouées par un robot : prends-en une, tu joues sa main tout de suite et ses points deviennent les tiens.',
    });
    expect(joinText({ ...s, free: 1 }, true).why).toBe(
      '1 place sur 4 est jouée par un robot : prends-en une, tu joues sa main à la prochaine manche et ses points deviennent les tiens.',
    );
  });
  test('my own seat back, a full table, none free', () => {
    expect(joinText({ ...s, mine: true }, false).label).toBe('Reprendre ma place');
    expect(joinText({ ...s, full: true }, false).label).toBe('Table complète (4/4)');
    expect(joinText({ ...s, free: 0 }, false)).toEqual({
      label: 'Rejoindre la partie',
      why: 'Les 4 places sont prises par des joueurs.',
    });
  });
});
