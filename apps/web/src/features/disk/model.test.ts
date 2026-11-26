// The half disk's geometry: a value 0 → 100 is an angle 0 → 180° (value × 1.8°), from the left end to the right one.
import { describe, expect, test } from 'vitest';
import {
  CX,
  CY,
  drawOrder,
  f,
  OUTLINE,
  point,
  R,
  rayKey,
  rayShape,
  spoke,
  TICKS,
  valueAt,
  wedge,
  type Ray,
} from './model';

const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('a value is an angle', () => {
  test('0 left, 50 up, 100 right, on the radius', () => {
    const [x0, y0] = point(0),
      [x50, y50] = point(50),
      [x100, y100] = point(100);
    near(x0, CX - R);
    near(y0, CY);
    near(x50, CX);
    near(y50, CY - R);
    near(x100, CX + R);
    near(y100, CY);
  });

  test('angle = value × 1.8° from the left end', () => {
    for (const v of [0, 10, 25, 33.3, 90]) {
      const [x, y] = point(v);
      const deg = (Math.atan2(CY - y, CX - x) * 180) / Math.PI;
      near(deg, v * 1.8);
    }
  });

  test('valueAt is point read back (to the tenth), anywhere along the ray', () => {
    for (const v of [0, 0.5, 12.3, 50, 77.7, 100])
      for (const r of [10, 60, R]) {
        const [x, y] = point(v, r);
        expect(valueAt(x, y)).toBeCloseTo(v, 5);
      }
  });

  test('outside the half disk: null (a little slack on the edges)', () => {
    expect(valueAt(CX, CY - R - 7)).toBeNull();
    expect(valueAt(CX, CY + 7)).toBeNull();
    expect(valueAt(CX + R + 5, CY)).toBe(100);
    expect(valueAt(CX - 20, CY + 3)).toBe(0); // just below the base: the nearest end
  });
});

describe('what is drawn', () => {
  test('the outline, nine graduations (the middle one longer), a spoke from the centre', () => {
    expect(OUTLINE).toBe('M12 120 A108 108 0 0 1 228 120 Z');
    expect(TICKS).toHaveLength(9);
    const len = (t: (typeof TICKS)[number]) => Math.hypot(+t.x2 - +t.x1, +t.y2 - +t.y1);
    expect(len(TICKS[4]!)).toBeCloseTo(10, 1);
    expect(len(TICKS[0]!)).toBeCloseTo(5, 1);
    expect(spoke(50)).toEqual({ x1: CX, y1: CY, x2: '120.00', y2: '12.00' });
  });

  test('the target: a wedge as wide as its tolerance, kept on the disk', () => {
    const xy = (v: number) => point(v).map(f).join(' ');
    expect(wedge(47, 53)).toBe(`M120 120 L${xy(47)} A108 108 0 0 1 ${xy(53)} Z`);
    expect(wedge(-3, 3)).toContain('L12.00 120.00');
  });

  test('targets first, mine last (on top), a dot on the edge bigger for mine', () => {
    const rays: Ray[] = [
      { id: 'me', value: 10, color: 'a', kind: 'mine' },
      { id: 'b', value: 20, color: 'b', kind: 'player' },
      { id: 'target', value: 30, color: 'c', kind: 'target' },
    ];
    const { targets, others } = drawOrder(rays);
    expect(targets.map(r => r.id)).toEqual(['target']);
    expect(others.map(r => r.id)).toEqual(['b', 'me']);
    expect(rayShape(rays[0]!).dot.r).toBe(5);
    expect(rayShape(rays[1]!).dot.r).toBe(4);
    expect(rayShape(rays[1]!).line).toEqual(spoke(20, R - 9));
  });
});

describe('the keyboard', () => {
  test('← → by 1, Shift by 5, Home / End, kept within 0..100, from the middle at first', () => {
    expect(rayKey('ArrowRight', false, null)).toEqual({ move: 51 });
    expect(rayKey('ArrowLeft', true, 40)).toEqual({ move: 35 });
    expect(rayKey('ArrowDown', false, 0)).toEqual({ move: 0 });
    expect(rayKey('ArrowUp', true, 98)).toEqual({ move: 100 });
    expect(rayKey('Home', false, 40)).toEqual({ move: 0 });
    expect(rayKey('End', false, 40)).toEqual({ move: 100 });
  });

  test('Enter or Space places the ray shown; other keys are left alone', () => {
    expect(rayKey('Enter', false, 42)).toEqual({ pick: 42 });
    expect(rayKey(' ', false, null)).toEqual({ pick: 50 });
    expect(rayKey('a', false, 42)).toBeNull();
  });
});
