// My list of rooms: a key typed in any form, a new key not one of mine, the page of a room that can't be entered.
import type { SavedRoom } from '@slopesque/shared';
import { expect, test } from 'vitest';
import { blockedText, freshKey, keyToAdd, retryNote, roomName } from './model';

const rooms: SavedRoom[] = [
  { key: 'ABCD-EFGH', name: ' ', pending: false },
  { key: 'JKMN-PQRS', name: 'Les pays', pending: true },
];

test("a room's name: mine, or its key", () => {
  expect(roomName(rooms[0]!)).toBe('ABCD-EFGH');
  expect(roomName(rooms[1]!)).toBe('Les pays');
});

test('a key to add: any case and spacing, not malformed, not already mine', () => {
  expect(keyToAdd('jkmn pqrt', rooms)).toEqual({ key: 'JKMN-PQRT' });
  expect(keyToAdd('jkmn-pqrs', rooms)).toEqual({ error: 'Déjà dans ta liste : Les pays.' });
  expect(keyToAdd('ABCD', rooms)).toEqual({
    error: 'Une clé a la forme XXXX-XXXX : lettres et chiffres, sans I, L, O, 0 ni 1.',
  });
});

test('a new key: drawn again while it is one of mine', () => {
  const draws = ['ABCD-EFGH', 'JKMN-PQRS', 'TUVW-XYZ2'];
  expect(freshKey(rooms, () => draws.shift()!)).toBe('TUVW-XYZ2');
});

test("the page of a room that can't be entered, and « Réessayer »", () => {
  expect(blockedText('pending', 'x')[0]).toBe('Salon en attente de création');
  expect(blockedText('offline', 'http://s')[1]).toContain('Aucune réponse de http://s.');
  expect(retryNote('pending', 'pending')).toBe('Toujours pas créé : un admin doit encore créer ce salon avec sa clé.');
  expect(retryNote('unknown', 'unknown')).toBe('Toujours la même réponse.');
  expect(retryNote('unknown', 'ok')).toBe('');
});
