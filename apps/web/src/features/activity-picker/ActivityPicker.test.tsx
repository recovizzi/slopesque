// The /activity window: six kinds with their picture, the current one marked, a kind's formats, what a choice does.
import { renderToStaticMarkup as html } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ActivityPicker } from './ActivityPicker';
import { howText, kindOf, kindOff, KINDS } from './kinds';

const noop = () => {};
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('every kind, its picture, the current one', () => {
  const s = html(
    <ActivityPicker kind={null} current="lowtide" host busy={false} onKind={noop} onPick={noop} onClose={noop} />,
  );
  expect(count(s, /class="act-tile/g)).toBe(6);
  expect(count(s, /<svg class="act-art"/g)).toBe(6);
  expect(s).toContain('class="act-tile is-current"');
  expect(s).toContain('<span class="act-now">en cours</span>');
  expect(s).toContain('class="modal act-picker" role="dialog" aria-modal="true" aria-label="Changer d&#x27;activité"');
  expect(s).toContain('aria-label="Fermer"');
});

test("a kind's formats; locked for a player while a vote runs", () => {
  const s = html(
    <ActivityPicker kind="cards" current="chat" host={false} busy onKind={noop} onPick={noop} onClose={noop} />,
  );
  expect(count(s, /class="act-format"/g)).toBe(4);
  expect(count(s, /disabled=""/g)).toBe(4);
  expect(s).toContain('class="note act-how is-busy"');
  expect(s).toContain('← Toutes les activités');
});

test('the kinds', () => {
  expect(KINDS.map(k => k.id)).toEqual(['disk', 'poll', 'wheel', 'chat', 'cards', 'web']);
  expect(kindOf('lowtide')).toBe('web');
  expect(KINDS.some(kindOff)).toBe(false);
  expect(howText(true, true)).toBe("Tu es l'hôte : l'activité change tout de suite.");
  expect(howText(false, true)).toBe('Un vote est déjà en cours dans le chat : attends sa fin.');
});
