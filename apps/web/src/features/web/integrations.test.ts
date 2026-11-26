// Low Tide's address: the room's (checked by the host) or its own; what a check tells the host.
import { expect, test } from 'vitest';
import { INTEGRATIONS, urlOf, verdictText } from './integrations';

test("the room's address, or Low Tide's own", () => {
  expect(urlOf({ lowtide: 'https://lowtide.test/' })).toBe('https://lowtide.test/');
  expect(urlOf({})).toBe(INTEGRATIONS.lowtide.url);
});

test('what a check says', () => {
  expect(verdictText({ ok: true, url: 'https://x/', name: 'Low Tide' }, 'Low Tide', 'x')).toBe(
    '« Low Tide » trouvé à cette adresse : elle est enregistrée pour le salon.',
  );
  expect(verdictText({ ok: false, reason: 'url', detail: 'https' }, 'Low Tide', 'x')).toContain('https://');
  expect(verdictText({ ok: false, reason: 'offline', detail: 'HTTP 502' }, 'Low Tide', 'https://y')).toBe(
    'Page injoignable (HTTP 502) : https://y. Adresse non enregistrée.',
  );
  expect(verdictText({ ok: false, reason: 'name', found: 'Autre jeu' }, 'Low Tide', 'x')).toBe(
    'Cette page se déclare « Autre jeu », pas « Low Tide » : adresse refusée.',
  );
});
