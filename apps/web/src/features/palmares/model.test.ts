// The Palmarès counts: rounds played and won by game and period, a rate ranked only after enough rounds, a round
// alone with robots counted as played but not as a level.
import { describe, expect, test } from 'vitest';
import { ago, cells, num, pct, ranked, rows, SORTS, type Filter, type StatEvent } from './model';

const DAY = 86_400_000,
  NOW = 100 * DAY;
const ev = (p: Partial<StatEvent>): StatEvent => ({
  at: NOW - DAY,
  game: 'disk',
  id: 'a',
  name: 'Léa',
  color: 'c',
  won: false,
  ...p,
});
const all: Filter = { game: 'all', sort: 'won', period: 'all' };

describe('rows', () => {
  test('one row per player, the latest name, the games counted', () => {
    const r = rows(
      [
        ev({ won: true, at: NOW - 3 * DAY, name: 'Lea' }),
        ev({ game: 'tdc', role: 'tdc' }),
        ev({ id: 'b', name: 'Hugo', won: true }),
      ],
      all,
      NOW,
    );
    const lea = r.find(x => x.id === 'a')!;
    expect(lea).toMatchObject({ name: 'Léa', played: 2, won: 1, rate: 0.5, games: 2 });
    expect(r).toHaveLength(2);
  });

  test('a game, a period', () => {
    const list = [ev({ won: true }), ev({ game: 'tdc' }), ev({ at: NOW - 40 * DAY, won: true })];
    expect(rows(list, { game: 'disk', sort: 'won', period: 'all' }, NOW)[0]).toMatchObject({ played: 2, won: 2 });
    expect(rows(list, { game: 'disk', sort: 'won', period: 30 }, NOW)[0]).toMatchObject({ played: 1, won: 1 });
    expect(rows(list, { game: 'tarot', sort: 'won', period: 'all' }, NOW)).toEqual([]);
  });

  test('alone with robots: played, not counted', () => {
    const [r] = rows([ev({ game: 'tdc', won: true, humans: 1 }), ev({ game: 'tdc', won: false })], all, NOW);
    expect(r).toMatchObject({ played: 2, counted: 1, won: 0 });
  });

  test("each game's measures: perfects and average, takes and best mark, average place", () => {
    const f = (game: Filter['game']) => ({ game, sort: 'won', period: 'all' }) as Filter;
    expect(rows([ev({ perfect: true, pts: 150 }), ev({ pts: 50 })], f('disk'), NOW)[0]).toMatchObject({
      perfects: 1,
      avg: 100,
    });
    const tarot = [
      ev({ game: 'tarot', taker: true, won: true, pts: 70 }),
      ev({ game: 'tarot', taker: true, pts: -40 }),
    ];
    expect(rows(tarot, f('tarot'), NOW)[0]).toMatchObject({ takes: 2, takesWon: 1, takeRate: 0.5, best: 70 });
    const holdem = [ev({ game: 'holdem', place: 1, of: 4 }), ev({ game: 'holdem', place: 4, of: 4 })];
    expect(rows(holdem, f('holdem'), NOW)[0]).toMatchObject({ avgPlace: 2.5, podiums: 1 });
  });
});

test('a rate ranks the players with enough rounds; the others after, not ranked', () => {
  const list = [
    ...Array.from({ length: 5 }, () => ev({ id: 'a', won: true })),
    ev({ id: 'b', name: 'Hugo', won: true }),
  ];
  const f: Filter = { game: 'disk', sort: 'rate', period: 'all' };
  const r = ranked(rows(list, f, NOW), f);
  expect(r.sort.key).toBe('rate');
  expect(r.ranked.map(x => x.id)).toEqual(['a']);
  expect(r.unranked.map(x => x.id)).toEqual(['b']);
  expect(ranked(rows(list, f, NOW), { ...f, sort: 'nope' }).sort).toBe(SORTS.disk[0]);
});

test('the words: a percentage, a decimal comma, how long ago, a row’s context', () => {
  expect(pct(0.456)).toBe('46 %');
  expect(num(2.5)).toBe('2,5');
  expect(num(3)).toBe('3');
  expect(ago(NOW, NOW)).toBe("aujourd'hui");
  expect(ago(NOW - DAY, NOW)).toBe('hier');
  expect(ago(NOW - 5 * DAY, NOW)).toBe('il y a 5 j');
  const f: Filter = { game: 'disk', sort: 'won', period: 'all' };
  const [r] = rows([ev({ won: true, perfect: true, pts: 150 }), ev({ humans: 1 })], f, NOW);
  expect(cells(r!, f, 'won')).toEqual({
    main: '1',
    sub: ['1 / 1 tours (+1 sans autre joueur)', '100 %', '1 perfect', 'moy. 150'],
  });
});
