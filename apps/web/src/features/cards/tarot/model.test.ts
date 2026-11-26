// The Tarot's table in words: the bids, the middle's line, the count, my hand's cards that can be chosen, my choice.
import { describe, expect, test } from 'vitest';
import { Tarot as TA } from '@slopesque/engines';
import {
  bestBid,
  bidName,
  CORNER_BOX,
  handState,
  pick,
  pileText,
  resultLine,
  resultTitle,
  suitCard as S,
  trumpCard as T,
  trumpColors,
  trumpCount,
  trumpLabel,
} from './model';

const deal = (o: Partial<TA.Tarot> = {}): TA.Tarot => ({
  seats: ['a', 'b', 'c', 'd'],
  hands: { a: [S('H', 3), S('H', 14), T(1), T(21), T(0), T(9)], b: [], c: [], d: [] },
  chien: [],
  phase: 'bid',
  called: null,
  partner: null,
  revealed: false,
  bids: {},
  turn: 'a',
  taker: null,
  bid: null,
  ecart: [],
  trick: [],
  lastTrick: [],
  won: {},
  tricks: {},
  lastWinner: null,
  deal: 3,
  startedAt: 0,
  result: null,
  note: '',
  shownChien: [],
  chelem: null,
  handfuls: {},
  started: [],
  winners: [],
  ...o,
});
const name = (id: string) => ({ a: 'Toi', b: 'Biscotte', c: 'Zinzin', d: 'Pépin' })[id]!;

test('the trumps: their label, two colours, the corner box', () => {
  expect([trumpLabel(0), trumpLabel(21)]).toEqual(['★', '21']);
  expect(trumpColors(0)).toEqual(['hsl(210 70% 80%)', 'hsl(250 55% 52%)']);
  expect(CORNER_BOX).toBe('M3.5 3.5H23.5A4 4 0 0 0 19.5 7.5V15.5A5 5 0 0 1 14.5 20.5H7.5A4 4 0 0 0 3.5 24.5Z');
});

test('the bids', () => {
  expect(bidName('pass')).toBe('Passe');
  expect(bidName('sans')).toBe('Garde sans');
  expect(bestBid(deal())).toBeNull();
  expect(bestBid(deal({ bids: { a: 'pass', b: 'garde', c: 'prise' } }))).toBe('garde');
});

describe('the line under the middle', () => {
  test('bids, call, chien', () => {
    expect(pileText(deal(), 'a', name, false)).toBe(
      'Enchères : chacun parle une fois, plus haut que le précédent, ou passe',
    );
    expect(pileText(deal({ bids: { b: 'prise' } }), 'a', name, false)).toBe('Enchère la plus haute : Prise');
    expect(pileText(deal({ phase: 'call', taker: 'b' }), 'a', name, false)).toBe('Biscotte appelle un Roi…');
    expect(pileText(deal({ phase: 'dog', taker: 'a' }), 'a', name, false)).toBe(
      'Le chien, pris par Toi : écarte-en 6 (ni Roi ni bout)',
    );
    expect(pileText(deal({ phase: 'dog', taker: 'c' }), 'a', name, false)).toBe(
      'Le chien, pris par Zinzin : il fait son écart…',
    );
  });
  test('the trick: taken, opened, what is asked', () => {
    const last = [{ by: 'b', card: S('S', 2) }];
    expect(pileText(deal({ phase: 'play', lastTrick: last, lastWinner: 'c' }), 'a', name, true)).toBe(
      'Zinzin remporte le pli',
    );
    expect(pileText(deal({ phase: 'play', lastTrick: last, lastWinner: 'c' }), 'a', name, false)).toBe('Zinzin ouvre');
    expect(pileText(deal({ phase: 'play' }), 'a', name, false)).toBe("À l'entame");
    expect(
      pileText(
        deal({
          phase: 'play',
          trick: [
            { by: 'b', card: T(0) },
            { by: 'c', card: T(4) },
          ],
        }),
        'a',
        name,
        false,
      ),
    ).toBe('Atout demandé : monte si tu peux');
    expect(pileText(deal({ phase: 'play', trick: [{ by: 'b', card: S('D', 4) }] }), 'a', name, false)).toBe(
      '♦️ demandé : fournis, sinon coupe (et surcoupe)',
    );
  });
});

test("the deal's count", () => {
  const result: TA.TResult = {
    taker: 'b',
    partner: null,
    bid: 'garde',
    bouts: 2,
    need: 41,
    made: 47.5,
    won: true,
    score: 62,
    marks: { a: -62, b: 186, c: -62, d: -62 },
    petit: 'defense',
    handfuls: -20,
    chelem: 0,
  };
  const t = deal({ phase: 'done', result });
  expect(resultTitle(t, name)).toBe('Donne 3 : Biscotte gagne');
  expect(resultLine(t)).toBe(
    'Garde · 2 bouts → 41 points à faire · 47,5 faits → (25 + 7) − 10 (Petit au bout) × 2 − 20 (poignée) = 62',
  );
  const five = deal({
    seats: ['a', 'b', 'c', 'd', 'e'],
    phase: 'done',
    result: { ...result, partner: 'a', won: false, bouts: 1 },
  });
  expect(resultTitle(five, name)).toBe('Donne 3 : Biscotte et Toi chutent');
  expect(resultLine(five)).toMatch(/^Garde · 1 bout → .* → −\(25 \+ 7\).* · preneur × 2, partenaire × 1$/);
});

describe('my hand', () => {
  test('in the bids: all to look at, nothing to choose', () => {
    expect(handState(deal(), 'a').active).toBe(false);
  });
  test('the écart: no King, no bout; up to its size', () => {
    const t = deal({ phase: 'dog', taker: 'a' });
    expect(handState(t, 'a')).toEqual({ active: true, ok: new Set(['H3', 'T9']) });
    expect(pick(t, 'a', new Set(), 'H14')).toEqual({ chosen: new Set() });
    expect(pick(t, 'a', new Set(), 'H3')).toEqual({ chosen: new Set(['H3']) });
    expect(pick(t, 'a', new Set(['H3']), 'H3')).toEqual({ chosen: new Set() });
  });
  test('in play: a legal card chosen, then played', () => {
    const t = deal({ phase: 'play', trick: [{ by: 'd', card: S('H', 7) }] });
    expect(handState(t, 'a').ok).toEqual(new Set(['H3', 'H14', 'T0'])); // follow hearts (or the Excuse)
    expect(pick(t, 'a', new Set(), 'H14')).toEqual({ chosen: new Set(['H14']) });
    expect(pick(t, 'a', new Set(['H14']), 'H14')).toEqual({ play: 'H14' });
    expect(pick(t, 'a', new Set(), 'T9')).toBeNull();
    expect(pick({ ...t, turn: 'b' }, 'a', new Set(), 'H14')).toBeNull();
  });
  test('my trumps and bouts', () => expect(trumpCount(deal().hands.a!)).toEqual({ trumps: 4, bouts: 3 }));
});
