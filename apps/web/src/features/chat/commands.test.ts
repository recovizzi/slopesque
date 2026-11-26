import { describe, expect, test } from 'vitest';
import { parseCommand, screamEmoji } from './commands';

describe('parseCommand', () => {
  test('the command and its argument; case and accents left out', () => {
    expect(parseCommand('/activity cartes tarot')).toEqual({ name: 'activity', word: 'activity', arg: 'cartes tarot' });
    expect(parseCommand('/Activité')).toEqual({ name: 'activity', word: 'Activité', arg: '' });
    expect(parseCommand('/HÔTE')).toMatchObject({ name: 'host' });
  });

  test('its other names', () => {
    for (const w of ['credit-social', 'credit', 'creditsocial', 'credit-score'])
      expect(parseCommand(`/${w} Léa +5`)).toMatchObject({ name: 'credit', arg: 'Léa +5' });
    for (const w of ['effet', 'effect', 'effets']) expect(parseCommand(`/${w}`).name).toBe('effect');
    expect(parseCommand('/host').name).toBe('host');
    expect(parseCommand('/kick Hugo')).toMatchObject({ name: 'kick', arg: 'Hugo' });
  });

  test('unknown: its word as typed', () => {
    expect(parseCommand('/nimporte quoi')).toEqual({ name: null, word: 'nimporte', arg: 'quoi' });
  });
});

describe('screamEmoji', () => {
  test('an emoji or a :code: after « screamer »; a word or nothing is not one', () => {
    expect(screamEmoji('screamer 😱')).toBe('😱');
    expect(screamEmoji('screamer :pepe:')).toBe(':pepe:');
    expect(screamEmoji('screamer')).toBe(null);
    expect(screamEmoji('screamer bouh')).toBe(null);
    expect(screamEmoji('screamer 😱 2')).toBe(null);
  });
});
