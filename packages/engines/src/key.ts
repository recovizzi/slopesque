// Room keys: XXXX-XXXX in the keys' alphabet (openspec: game-session).
import { KEY_ALPHABET } from '@slopesque/shared';

/** A key as typed (any case, with or without the dash) → XXXX-XXXX, or null if it can't be one. */
export function normalizeKey(s: string): string | null {
  const raw = s.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== 8 || [...raw].some(c => !KEY_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function newKey() {
  const raw = [...crypto.getRandomValues(new Uint32Array(8))].map(v => KEY_ALPHABET[v % KEY_ALPHABET.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
