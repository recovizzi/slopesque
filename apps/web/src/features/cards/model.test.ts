// The card table's pure logic: who plays a seat, the pills' columns, my hand's fan, the clock.
import { describe, expect, test } from 'vitest';
import type { CardSeatView, MemberView } from '@slopesque/shared';
import { fanOf, fmtClock, handAngle, paidWho, plural, preDealTitle, ROBOT_COLOR, seatCols, seatWho } from './model';

const member = (id: string, name: string, hue: number, photo: string | null = null) =>
  ({ id, name, hue, photo, presence: 'here', awaySince: null }) as unknown as MemberView;
const members = new Map([member('u1', 'Léa', 222, 'https://x/léa.png'), member('u2', 'Hugo', 12)].map(m => [m.id, m]));
const seats: CardSeatView[] = [
  { id: 's1', user: 'u1', credit: 'u1', bot: 'Pépin' },
  { id: 's2', user: null, credit: 'u2', bot: 'Zinzin' }, // Hugo left: a robot plays his seat
  { id: 's3', user: null, credit: null, bot: 'Biscotte' }, // a robot from the start
];

describe('seatWho', () => {
  const who = seatWho(seats, members, 'u1');
  test('me: « Toi », my colour and my photo', () => {
    expect(who('s1')).toEqual({
      name: 'Toi',
      hue: 222,
      color: 'hsl(222 58% 50%)',
      bot: false,
      photo: 'https://x/léa.png',
    });
  });
  test('a player who left: his name and colour, a robot plays, no photo', () => {
    expect(who('s2')).toEqual({ name: 'Hugo', hue: 12, color: 'hsl(12 58% 50%)', bot: true, photo: null });
  });
  test('a robot from the start: its name, the grey', () => {
    expect(who('s3')).toEqual({ name: 'Biscotte', hue: null, color: ROBOT_COLOR, bot: true, photo: null });
  });
  test('an unknown seat', () => expect(who('zz').name).toBe('?'));
  test("someone else's view: Léa by her name", () => expect(seatWho(seats, members, 'u2')('s1').name).toBe('Léa'));
});

describe('paidWho', () => {
  const who = seatWho(seats, members, 'u1');
  const paid = paidWho({ s1: 'u1', s2: 'u2', s3: null }, members, 'u1', who);
  test('the points went to a player (me, or one who left)', () => {
    expect(paid('s1')).toMatchObject({ name: 'Toi', bot: false });
    expect(paid('s2')).toMatchObject({ name: 'Hugo', hue: 12, bot: false });
  });
  test('a robot: no points', () => expect(paid('s3')).toMatchObject({ name: 'Biscotte', bot: true }));
});

test('seatCols: one row up to 4 pills, else two', () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7].map(seatCols)).toEqual([1, 1, 2, 3, 4, 3, 3, 4]);
});

describe('the fan', () => {
  test('one card: no angle', () => expect(fanOf(1, 600, 58, 82)).toEqual({ r: 656, step: 0 }));
  test('a wide hand: 0.06 rad between two cards at most', () => expect(fanOf(5, 2000, 58, 82).step).toBe(0.06));
  test('a flat arc: the outer cards rise 34 px at most', () => {
    const { r, step } = fanOf(18, 2000, 58, 82);
    expect(r * (1 - Math.cos((step * 17) / 2))).toBeCloseTo(34, 5);
  });
  test('a narrow hand: the outer cards stay inside', () => {
    const { r, step } = fanOf(18, 300, 48, 68),
      edge = Math.sin((step * 17) / 2) * (r + 68 / 2);
    expect(edge).toBeCloseTo(300 / 2 - 48 / 2 - 4, 5);
  });
  test('the angles, centred, as --a takes them', () => {
    expect([0, 1, 2].map(i => handAngle(i, 3, 0.05))).toEqual(['-0.0500', '0.0000', '0.0500']);
  });
});

test('fmtClock: mm:ss, then h:mm:ss', () => {
  expect(fmtClock(0)).toBe('00:00');
  expect(fmtClock(-400)).toBe('00:00');
  expect(fmtClock(65_900)).toBe('01:05');
  expect(fmtClock(3_725_000)).toBe('1:02:05');
});

test('plural', () => {
  expect(plural(1, 'joueur')).toBe('1 joueur');
  expect(plural(3, 'place')).toBe('3 places');
});

test('preDealTitle: the game and its seats', () => {
  const s = { tdc: 5, tarot: 4, holdem: 6, coinche: 4 };
  expect(['tdc', 'tarot', 'holdem', 'coinche'].map(g => preDealTitle(g as 'tdc', s))).toEqual([
    'Trou du cul à 5',
    'Tarot à 4',
    "Texas Hold'em à 6",
    'Coinche, 2 contre 2',
  ]);
});
