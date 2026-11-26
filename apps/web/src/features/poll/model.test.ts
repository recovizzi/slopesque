import { Poll } from '@slopesque/engines';
import { describe, expect, test } from 'vitest';
import * as M from './model';

describe('the draft', () => {
  test('a row keeps its key when another is removed; the pictures stay with their choice', () => {
    let d = M.emptyDraft();
    d = M.addChoice(M.setChoice(M.setChoice(d, 0, 'Chien'), 1, 'Chat'));
    d = M.setPic(d, 2, { kind: 'sticker', src: 's.png', w: 10, h: 10, stickerId: 'st' });
    const [, k1, k2] = d.keys;
    d = M.removeChoice(d, 0);
    expect(d.choices).toEqual(['Chat', '']);
    expect(d.keys).toEqual([k1, k2]);
    expect(d.pics.map(p => p?.stickerId ?? null)).toEqual([null, 'st']);
  });

  test('a picture arriving late goes to its row wherever it is now, or nowhere if the row was removed', () => {
    let d = M.addChoice(M.emptyDraft());
    const [k0, , k2] = d.keys;
    d = M.removeChoice(d, 0);
    const gif = { kind: 'gif' as const, src: 'https://x.test/g.gif', w: 1, h: 1 };
    expect(M.atRow(d, k0, (x, i) => M.setPic(x, i, gif))).toBe(d);
    expect(M.atRow(d, k2, (x, i) => M.setPic(x, i, gif)).pics).toEqual([null, gif]);
  });

  test('every row of every draft has its own key; 8 choices at most', () => {
    let d = M.emptyDraft('gradient');
    for (let i = 0; i < 10; i++) d = M.addChoice(d);
    expect(d.choices).toHaveLength(Poll.MAX_CHOICES);
    const keys = [...d.keys, ...M.emptyDraft().keys];
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('published: no choices for free answers; pictures for « Choix définis » only, as the server finds them', () => {
    const d = M.setPic(M.setQuestion(M.emptyDraft(), 'Ton animal ?'), 0, {
      kind: 'image',
      src: 'https://x.test/a.webp',
      w: 4,
      h: 3,
      mediaId: 'm1',
    });
    expect(M.publishBody(d)).toEqual({
      kind: 'choices',
      question: 'Ton animal ?',
      choices: ['', ''],
      pics: [{ mediaId: 'm1', stickerId: undefined, gif: undefined }, null],
    });
    expect(M.publishBody(M.setKind(d, 'free'))).toMatchObject({ kind: 'free', choices: [], pics: [] });
    expect(M.publishBody(M.setKind(d, 'gradient')).pics).toEqual([]);
  });

  test('an emoji typed over the selection, the text cut at its maximum, the caret after it', () => {
    expect(M.insertAt('Chat noir', 5, 9, '🐈', 40)).toEqual({ text: 'Chat 🐈', caret: 7 });
    expect(M.insertAt('abc', 3, 3, 'de', 4)).toEqual({ text: 'abcd', caret: 5 });
  });
});

describe('the gradient drawing', () => {
  test('a point drawn, then read back by a click (Poll.fromSvg), is the same point', () => {
    for (const n of [2, 3, 4, 8]) {
      const pts: M.Point[] =
        n === 2
          ? [
              [0, 0],
              [0.25, 0],
              [1, 0],
            ]
          : [[0, 0], [0.2, -0.3], ...Poll.corners(n)];
      for (const p of pts) {
        const [x, y] = M.toSvg(n, p);
        const back = Poll.fromSvg(n, x, y)!;
        expect(back[0]).toBeCloseTo(p[0], 2);
        expect(back[1]).toBeCloseTo(p[1], 2);
      }
    }
    expect(Poll.fromSvg(3, ...M.toSvg(3, [0, 1.2]))).toBeNull(); // outside the triangle
  });

  test('the polygon and the names of its corners', () => {
    expect(M.polygonPoints(4).split(' ')).toEqual(['150.0,34.0', '214.0,98.0', '150.0,162.0', '86.0,98.0']);
    expect(M.labelPlaces(2)).toEqual([
      { x: 18, y: 46, anchor: 'start' },
      { x: 282, y: 46, anchor: 'end' },
    ]);
    expect(M.labelPlaces(4).map(l => l.anchor)).toEqual(['middle', 'start', 'middle', 'end']);
    const [top, , bottom] = M.labelPlaces(4);
    expect(top.y).toBeLessThan(34); // above the top corner
    expect(bottom.y).toBeGreaterThan(162 + 5); // below the bottom one
  });

  test('a proposition without a name, a long name cut', () => {
    expect(M.propositionName(['Mer', ''], 1)).toBe('Proposition 2');
    expect(M.short('Une très longue proposition')).toBe('Une très longue…');
    expect(M.short('Mer')).toBe('Mer');
  });
});

describe('the heatmap', () => {
  test('hottest (red, most opaque) at the answers, transparent far from them', () => {
    const { w, h, data } = M.heatPixels(2, [[0.75, 0]]);
    expect([w, h]).toEqual([200, 1]);
    const px = (i: number) => [...data.slice(i * 4, i * 4 + 4)];
    const [r, g, b, a] = px(150);
    expect([r, g, b]).toEqual(M.hslRgb(0, 0.72, 0.5).map(Math.round)); // the hue of the hottest
    expect(a).toBe(Math.round(0.9 * 255));
    expect(px(0)[3]).toBe(0);
  });

  test('a square of 100 × 100 over the polygon', () => {
    const { w, h, data } = M.heatPixels(3, [[0, 0]]);
    expect([w, h, data.length]).toEqual([100, 100, 40000]);
  });

  test('temperatures: blue for the coldest, red for the hottest, relative to the hottest', () => {
    expect(M.heatColor(0)).toBe('hsl(230 72% 48%)');
    expect(M.heatColor(1)).toBe('hsl(0 72% 48%)');
    expect(M.tempColor(60, [60, 30, 10])).toBe(M.heatColor(1));
    expect(M.tempColor(30, [60, 30, 10])).toBe(M.heatColor(0.5));
    expect(M.tempColor(0, [0, 0])).toBe(M.heatColor(0));
    expect(M.hslRgb(0, 1, 0.5).map(Math.round)).toEqual([255, 0, 0]);
  });
});

describe('times and counts', () => {
  test('the answer time and the time left', () => {
    expect(M.fmtDuration(180)).toBe('3 min');
    expect(M.fmtDuration(10800)).toBe('3 h');
    expect(M.fmtLeft(41_200)).toBe('42 s');
    expect(M.fmtLeft(245_000)).toBe('4:05');
    expect(M.fmtLeft(7_500_000)).toBe('2 h 05 min');
    expect(M.fmtLeftShort(245_000)).toBe('4:05');
    expect(M.fmtLeftShort(7_500_000)).toBe('2 h 05');
    expect(M.fmtLeftShort(-3000)).toBe('0:00');
  });

  test('answers and shares', () => {
    expect([M.answers(0), M.answers(1), M.answers(3)]).toEqual(['0 réponse', '1 réponse', '3 réponses']);
    expect([M.percent(1, 3), M.percent(2, 3), M.percent(0, 0)]).toEqual([33, 67, 0]);
  });
});
