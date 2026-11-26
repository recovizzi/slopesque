// The Amphithéâtre's geometry: 25 columns × 7 rows of seats, a seat the number column × 7 + row.
import { colOf, COLS, rowOf, ROWS, seatOf } from '@slopesque/engines';
import { describe, expect, test } from 'vitest';
import {
  columnBand,
  inColumn,
  isHover,
  pickOf,
  SEAT_PATHS,
  seatAt,
  seatClass,
  seatKey,
  seatPath,
  slackOf,
  type ColumnMark,
} from './amphi-model';
import { CX, CY, point } from './model';

/** The middle of a seat, in the viewBox. */
const middle = (col: number, row: number) => point((col + 0.5) * (100 / COLS), 47 + row * 7.6 + 3.1);

describe('the seats', () => {
  test('175 paths, in seat order', () => {
    expect(SEAT_PATHS).toHaveLength(COLS * ROWS);
    expect(SEAT_PATHS[seatOf(3, 5)]).toBe(seatPath(3, 5));
    expect(seatOf(12, 0)).toBe(84);
    expect([colOf(84), rowOf(84)]).toEqual([12, 0]);
  });

  test('the seat under a point is the one drawn there', () => {
    for (const col of [0, 7, 12, 24])
      for (const row of [0, 3, 6]) {
        const [x, y] = middle(col, row);
        expect(seatAt(x, y, 2.5)).toBe(seatOf(col, row));
      }
  });

  test('outside the rows: nothing, but a column can be picked a bit further out', () => {
    expect(seatAt(CX, CY - 20, 2.5)).toBeNull(); // in the tribune
    expect(seatAt(CX, CY - 104, slackOf('seat'))).toBeNull(); // beyond the last row
    expect(seatAt(CX, CY - 104, slackOf('column'))).toBe(seatOf(12, 6));
  });

  test('the host’s column: a band from the tribune to beyond the seats, two solid ends', () => {
    const b = columnBand(0);
    expect(b.band.startsWith('M')).toBe(true);
    expect(b.caps).toHaveLength(2);
  });
});

describe('picking', () => {
  const taken = new Set([seatOf(4, 2)]);

  test('the host picks a column, a candidate a free seat', () => {
    expect(pickOf('column', seatOf(4, 2), taken)).toBe(4);
    expect(pickOf('seat', seatOf(4, 2), taken)).toBeNull();
    expect(pickOf('seat', seatOf(4, 3), taken)).toBe(seatOf(4, 3));
    expect(pickOf(null, 0, taken)).toBeNull();
  });

  test('lit: the whole column (host), the free seat itself (candidate), nothing otherwise', () => {
    expect(isHover('column', seatOf(4, 0), seatOf(4, 6), taken)).toBe(true);
    expect(isHover('column', seatOf(4, 0), seatOf(5, 0), taken)).toBe(false);
    expect(isHover('seat', seatOf(4, 3), seatOf(4, 3), taken)).toBe(true);
    expect(isHover('seat', seatOf(4, 2), seatOf(4, 2), taken)).toBe(false);
    expect(isHover(null, 0, 0, taken)).toBe(false);
  });

  test('the keyboard: ← → columns, ↑ ↓ rows for a seat only, Home / End, from the middle column', () => {
    expect(seatKey('ArrowRight', 'seat', null)).toEqual({ move: seatOf(13, 0) });
    expect(seatKey('ArrowUp', 'seat', seatOf(2, 6))).toEqual({ move: seatOf(2, 6) });
    expect(seatKey('ArrowUp', 'column', seatOf(2, 1))).toBeNull();
    expect(seatKey('ArrowDown', 'seat', seatOf(2, 1))).toEqual({ move: seatOf(2, 0) });
    expect(seatKey('Home', 'column', seatOf(9, 3))).toEqual({ move: seatOf(0, 3) });
    expect(seatKey('End', 'column', null)).toEqual({ move: seatOf(24, 0) });
    expect(seatKey('ArrowLeft', 'seat', seatOf(0, 4))).toEqual({ move: seatOf(0, 4) });
    expect(seatKey('Enter', 'seat', seatOf(3, 3))).toEqual({ pick: seatOf(3, 3) });
    expect(seatKey('x', 'seat', null)).toBeNull();
  });
});

test('a seat’s classes', () => {
  const band: ColumnMark = { col: 4, color: 'c', style: 'band' };
  expect(inColumn(seatOf(4, 6), band)).toBe(true);
  expect(inColumn(seatOf(5, 0), band)).toBe(false);
  expect(seatClass(seatOf(4, 1), band, { seat: 29, color: 'x', kind: 'player' }, true, false)).toBe(
    'seat is-col col-band is-player is-taken',
  );
  expect(seatClass(0, null, { seat: 0, color: 'x', kind: 'pending' }, false, true)).toBe('seat is-pending is-hover');
  expect(seatClass(0, { col: 0, color: 'c', style: 'fill' }, undefined, false, false)).toBe('seat is-col col-fill');
});
