// KLIPY with ads: the ads flagged are hidden and the page filled from the next ones, without a GIF twice or lost.
import { describe, expect, it } from 'vitest';
import { fillWithoutAds } from '../src/external/gif.service.js';

const gif = (n: number) => ({ id: n, type: 'gif', title: `g${n}`, file: { sm: { webp: { url: `https://x/${n}`, width: 200, height: 150 } } } });
const ad = (n: number) => ({ id: `ad${n}`, type: 'ad', content: '<div>pub</div>' });
// 3 pages of 24 from KLIPY: 2 ads on the first, 1 on the second
const pages = [[...Array(10).keys()].map(gif).concat([ad(1)], [...Array(12).keys()].map(i => gif(10 + i)), [ad(2)]),
  [...Array(23).keys()].map(i => gif(22 + i)).concat([ad(3)]), [...Array(24).keys()].map(i => gif(45 + i))];
const raw = async (_q: string | null, page: number) => ({ list: pages[page - 1] ?? [], hasNext: page < pages.length });

describe('KLIPY with ads', () => {
  it('hides the flagged ads, fills each page to 24, loses nothing', async () => {
    const seen: string[] = [];
    let cursor: number | null = 0, calls = 0;
    while (cursor !== null && calls++ < 10) {
      const p = await fillWithoutAds(raw, 'chat', cursor);
      if (p.next !== null) expect(p.items).toHaveLength(24);
      seen.push(...p.items.map(x => x.id));
      cursor = p.next;
    }
    expect(seen).toEqual([...Array(69).keys()].map(String));   // every GIF once, in order, no ad
  });
});
