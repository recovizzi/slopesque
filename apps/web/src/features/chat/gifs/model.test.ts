import { describe, expect, test } from 'vitest';
import { gifColumns, gifCredit, gifStatus, nearEnd, pushRecentGif, queryOf, type Gif } from './model';

const gif = (id: string, w = 100, h = 100): Gif => ({
  id,
  provider: 'KLIPY',
  url: `https://g.test/${id}.gif`,
  w,
  h,
  title: id,
});

describe('GIF window', () => {
  test('the one sent goes first in the recent ones, once, 50 at most', () => {
    const list = Array.from({ length: 50 }, (_, i) => gif(`g${i}`));
    const next = pushRecentGif(list, gif('g7'));
    expect(next.map(g => g.id).slice(0, 2)).toEqual(['g7', 'g0']);
    expect(next.filter(g => g.id === 'g7')).toHaveLength(1);
    expect(pushRecentGif(list, gif('new'))).toHaveLength(50);
  });

  test('a query of 2 characters or more; less is no query (Tendances)', () => {
    expect(queryOf('  chat ')).toBe('chat');
    expect(queryOf('c')).toBe('');
  });

  test('each GIF in the shorter column; a new page never moves the first ones', () => {
    const first = [gif('tall', 100, 300), gif('a'), gif('b'), gif('c')];
    const cols = gifColumns(first);
    expect(cols.map(c => c.map(g => g.id))).toEqual([['tall'], ['a', 'b', 'c']]);
    const more = gifColumns([...first, gif('d'), gif('e', 0, 0)]);
    expect(more[0]!.slice(0, 1)).toEqual(cols[0]);
    expect(more[1]!.slice(0, 3)).toEqual(cols[1]);
    expect(more.flat()).toHaveLength(6);
  });

  test('the next page near the end of the list', () => {
    expect(nearEnd({ scrollTop: 0, clientHeight: 400, scrollHeight: 700 })).toBe(true);
    expect(nearEnd({ scrollTop: 0, clientHeight: 400, scrollHeight: 701 })).toBe(false);
  });

  test('its status line', () => {
    const base = { tab: 'trending' as const, query: '', count: 0, loading: false, hasNext: false, error: null };
    expect(gifStatus({ ...base, loading: true })).toBe('Chargement…');
    expect(gifStatus({ ...base, error: 'no-key' })).toContain('aucune clé');
    expect(gifStatus({ ...base, count: 24, hasNext: true })).toBe('');
    expect(gifStatus({ ...base, count: 24 })).toBe('Plus de résultats.');
    expect(gifStatus({ ...base, query: 'chat' })).toBe('Aucun GIF pour « chat ».');
    expect(gifStatus(base)).toBe('Aucun GIF.');
    expect(gifStatus({ ...base, tab: 'recent' })).toBe("Aucun GIF envoyé pour l'instant.");
    expect(gifStatus({ ...base, tab: 'favorites', count: 1 })).toBe('');
  });

  test('who gives them', () => {
    expect(gifCredit('KLIPY-PUB')).toBe('GIF via KLIPY');
    expect(gifCredit(null)).toBe('');
  });
});
