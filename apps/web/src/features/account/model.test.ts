// The window to change my code: its title, when a code may go on, what the server's check means.
import { describe, expect, test } from 'vitest';
import { checkError, codeReady, codeTitle, sameCode } from './model';

test('the title: the choice, then the way chosen', () => {
  expect(codeTitle(null, false)).toBe('Changer de code utilisateur');
  expect(codeTitle('new', true)).toBe('Choisir mon code');
  expect(codeTitle('new', false)).toBe('Repartir de zéro');
  expect(codeTitle('renew', false)).toBe('Renouveler mon code');
  expect(codeTitle('resume', true)).toBe('Reprendre un compte existant');
});

test('a code may go on: long enough to take an account back, strong enough to be a new one', () => {
  expect(codeReady('resume', 'AAAA-AAAA-AAAA')).toBe(true);
  expect(codeReady('resume', 'AAAA-AAAA')).toBe(false);
  expect(codeReady('new', 'AAAA-AAAA-AAAA')).toBe(false); // too simple
  expect(codeReady('renew', 'K7QF-M2XC-9HRT-WD4P')).toBe(true);
  expect(sameCode('k7qf m2xc', 'K7QF-M2XC')).toBe(true);
});

describe("the server's check", () => {
  const r = (p: object) => ({ exists: false, retired: false, name: null, ...p });

  test('taking an account back: unknown or replaced, the tries left said', () => {
    expect(checkError(r({ triesLeft: 2 }), 'resume')).toBe(
      "Aucun compte avec ce code sur ce serveur. Recopie-le depuis ton autre appareil (Profil → Compte). Encore 2 essais avant 5 min d'attente.",
    );
    expect(checkError(r({ retired: true, retryIn: 240_000 }), 'resume')).toBe(
      'Ce code a été remplacé : tape le nouveau (Profil → Compte sur ton autre appareil). Prochain essai dans 4 min.',
    );
    expect(checkError(r({ exists: true, name: 'Léa' }), 'resume')).toBeNull();
  });

  test('a new code: not one already taken', () => {
    expect(checkError(r({ exists: true }), 'new')).toBe(
      "Ce code est déjà pris : choisis-en un autre, ou « Reprendre un compte existant » si c'est le tien.",
    );
    expect(checkError(r({ retired: true }), 'renew')).toBe('Ce code est déjà pris : choisis-en un autre.');
    expect(checkError(r({}), 'renew')).toBeNull();
  });
});
