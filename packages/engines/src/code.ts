// The user code: a player's identity, with no password (openspec: player-account). Drawn at random, or chosen by
// hand when hard enough to guess. Two codes are the same whatever the case, the dashes or the spaces.
import { KEY_ALPHABET } from '@slopesque/shared';

const draw = (n: number) => [...crypto.getRandomValues(new Uint32Array(n))].map(v => KEY_ALPHABET[v % KEY_ALPHABET.length]).join('');

/** 16 signs of the keys' alphabet in groups of 4 (about 79 bits). */
export const newCode = () => draw(16).match(/.{4}/g)!.join('-');

/** What identifies a code: its letters and digits, in capitals. */
export const canonicalCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** As typed, tidied: capitals, spaces become dashes, no dash at either end. */
export const tidyCode = (s: string) => s.toUpperCase().trim().replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

export const CODE_MIN_LEN = 12, CODE_MAX_LEN = 32, CODE_MIN_BITS = 60, CODE_GOOD_BITS = 75;
const COMMON = ['PASSWORD', 'MOTDEPASSE', 'AZERTY', 'QWERTY', 'SLOPESQUE', 'ADMIN', 'BONJOUR', 'SOLEIL', '123456', '000000'];

/** How hard a code is to guess: 0 not a code, 1 too simple (refused), 2 enough, 3 strong; why (French). */
export interface Strength { level: 0 | 1 | 2 | 3; bits: number; reason: string }
export function codeStrength(code: string): Strength {
  const t = tidyCode(code), c = canonicalCode(t);
  if (/[^A-Z0-9-]/.test(t)) return { level: 0, bits: 0, reason: 'Lettres sans accent, chiffres et tirets seulement.' };
  if (c.length < CODE_MIN_LEN) return { level: 1, bits: 0, reason: `${CODE_MIN_LEN} lettres ou chiffres au moins (${c.length} pour l'instant, sans compter les tirets).` };
  if (c.length > CODE_MAX_LEN) return { level: 0, bits: 0, reason: `${CODE_MAX_LEN} lettres ou chiffres au plus.` };
  if (new Set(c).size < 6) return { level: 1, bits: 0, reason: 'Trop de signes répétés : 6 différents au moins.' };
  for (let i = 0; i + 3 < c.length; i++) {
    const d = [1, 2, 3].map(k => c.charCodeAt(i + k) - c.charCodeAt(i + k - 1));
    if (d.every(x => x === 0)) return { level: 1, bits: 0, reason: `Pas de signe répété 4 fois de suite (${c.slice(i, i + 4)}).` };
    if (d.every(x => x === 1) || d.every(x => x === -1)) return { level: 1, bits: 0, reason: `Pas de suite comme ${c.slice(i, i + 4)}.` };
  }
  const word = COMMON.find(w => c.includes(w));
  if (word) return { level: 1, bits: 0, reason: `« ${word} » est trop connu.` };
  const pool = (/[A-Z]/.test(c) ? 26 : 0) + (/[0-9]/.test(c) ? 10 : 0);
  const bits = Math.round(c.length * Math.log2(pool));
  if (bits < CODE_MIN_BITS) return { level: 1, bits, reason: 'Trop simple : allonge-le, ou mêle lettres et chiffres.' };
  return { level: bits < CODE_GOOD_BITS ? 2 : 3, bits, reason: bits < CODE_GOOD_BITS ? 'Correct : plus long, il serait plus sûr.' : 'Solide.' };
}
