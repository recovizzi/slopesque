import { Wheel } from '@slopesque/engines';
import { describe, expect, test } from 'vitest';
import * as M from './model';

const item = (label: string, weight = '') => ({ label, weight });

describe('numbers and colours', () => {
  test('a share as written: whole from 10, one decimal below, a decimal comma', () => {
    expect([M.pct(33.333), M.pct(2.55), M.pct(0), M.pct(100)]).toEqual(['33', '2,6', '0', '100']);
  });

  test("a proposition's colour doesn't change when others are added; its name, or « Proposition n »", () => {
    expect(M.itemColor(0)).toBe('hsl(200 62% 62%)');
    expect(M.itemColor(1)).toBe('hsl(338 62% 62%)');
    expect(M.itemName(item('  '), 2)).toBe('Proposition 3');
    expect(M.weightText(item('A', '2,5'))).toBe('poids 2,5');
    expect(M.weightText(item('A', 'x'))).toBe('auto');
  });
});

describe('the sectors', () => {
  test('one per proposition with a share, clockwise from the top', () => {
    const s = M.sectors([item('Pizza', '50'), item('Sushi'), item('Tacos', '0'), item('Ramen')]);
    expect(s.map(x => x.i)).toEqual([0, 1, 3]); // no share, no sector
    expect(s[0].path).toBe('M100 100 L100.00 10.00 A90 90 0 0 1 100.00 190.00 Z');
    expect(s[0].label).toMatchObject({ text: 'Pizza', pct: '50 %' });
  });

  test('a single proposition: the whole disc, its name in the middle', () => {
    const [s] = M.sectors([item('Seul', '100'), item('Rien', '0')]);
    expect(s.path).toBeNull();
    expect(s.label).toMatchObject({ x: '100.00', y: '98.00', pctY: '109.00' });
  });

  test('a name cut to fit its sector; under 5 %, no name (the legend says it)', () => {
    const s = M.sectors([
      item('Une très longue proposition', '80'),
      item('Moyenne proposition', '17'),
      item('Petit', '3'),
    ]);
    expect(s[0].label?.text).toBe('Une très long…');
    expect(s[1].label?.text).toBe('Moyenne …');
    expect(s[2].label).toBeNull();
  });
});

describe('the needle', () => {
  const spin = { items: [], shares: [], angle: 90, winner: 0, at: 1000, from: 300 };

  test('from where the last draw left it to the drawn angle, then stopped', () => {
    expect(M.needleAt(spin, 1000)).toEqual({ deg: 300, done: false });
    expect(M.needleAt(spin, 500)).toEqual({ deg: 300, done: false }); // not started yet
    const end = M.needleAt(spin, 1000 + Wheel.SPIN_MS);
    expect(end.done).toBe(true);
    expect(end.deg).toBeCloseTo(90);
  });

  test('fast first, slowing down to a stop', () => {
    expect(M.ease(0)).toBe(0);
    expect(M.ease(1)).toBe(1);
    expect(M.ease(0.5)).toBeGreaterThan(0.9);
  });

  test("the arrow head on the needle's end", () => {
    expect(M.needleTip()).toBe('M100.00 14.00 L95 24 L105 24 Z');
  });
});

describe('what the editor says', () => {
  test('why the wheel cannot be launched', () => {
    expect(M.editorNote([item('A', '80'), item('B', '30')])).toEqual({
      alert: true,
      text: 'Total des poids : 110 %, au-dessus de 100. Baisse un poids pour lancer la roue.',
    });
    expect(M.editorNote([item('A', 'abc'), item('B')])?.text).toBe('Un poids doit être un nombre positif (ou vide).');
    expect(M.editorNote([item('A', '0'), item('B', '0')])?.text).toBe('Tous les poids sont à 0.');
  });

  test('how the weights are shared out', () => {
    expect(M.editorNote([item('A', '60'), item('B'), item('C')])).toEqual({
      alert: false,
      text: 'Poids donnés : 60 %. Les 40 % restants se partagent entre les 2 propositions sans poids.',
    });
    expect(M.editorNote([item('A', '100'), item('B')])?.text).toBe(
      "Les poids donnés font déjà 100 % : les propositions sans poids n'ont aucune chance.",
    );
    expect(M.editorNote([item('A', '60'), item('B', '20')])?.text).toBe(
      'Total 80 % : ramené à 100 % au lancer, en gardant les proportions.',
    );
    expect(M.editorNote([item('A', '50'), item('B', '50')])).toBeNull();
  });

  test("a draw's result", () => {
    const s = { items: [item('Pizza'), item('')], shares: [50, 50], angle: 212.4, winner: 1, at: 0, from: 0 };
    expect(M.winnerText(s)).toEqual({ label: 'Proposition 2', share: '50', angle: '212' });
  });
});
