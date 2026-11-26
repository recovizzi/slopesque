// The user code (openspec: player-account): what the window to change it asks and says — its title, whether a code
// typed may go on, what the server's check of a code means. Pure: CodeModal.tsx asks the server and saves.
import { canonicalCode, CODE_MIN_LEN, codeStrength } from '@slopesque/engines';
import type { IntentResults } from '@slopesque/shared';

/** Renew my code (same account), take back an existing account (its code), or start again (a new, empty one). */
export type CodeMode = 'renew' | 'resume' | 'new';

export const SAMPLE_HINT =
  'Tape le code affiché sur ton autre appareil (Profil → Compte). Majuscules, minuscules et tirets ne comptent pas.';

/** The window's title: the choice first, then the way chosen (from the first launch, « new » is choosing my code). */
export function codeTitle(mode: CodeMode | null, first: boolean) {
  if (mode === 'renew') return 'Renouveler mon code';
  if (mode === 'resume') return 'Reprendre un compte existant';
  if (mode === 'new') return first ? 'Choisir mon code' : 'Repartir de zéro';
  return 'Changer de code utilisateur';
}

/** A code typed may go on: long enough to take an account back, strong enough to be a new one. */
export const codeReady = (mode: CodeMode, code: string) =>
  mode === 'resume' ? canonicalCode(code).length >= CODE_MIN_LEN : codeStrength(code).level >= 2;

/** The same code as mine, whatever its capitals and dashes. */
export const sameCode = (a: string, b: string) => canonicalCode(a) === canonicalCode(b);

/** What the server's check of a code means for this way: why it can't go on, or null (the confirmation). */
export function checkError(r: IntentResults['account:find'], mode: CodeMode): string | null {
  const left = r.triesLeft
    ? ` Encore ${r.triesLeft} essai${r.triesLeft > 1 ? 's' : ''} avant 5 min d'attente.`
    : r.retryIn
      ? ` Prochain essai dans ${Math.round(r.retryIn / 60000)} min.`
      : '';
  if (r.retired)
    return mode === 'resume'
      ? `Ce code a été remplacé : tape le nouveau (Profil → Compte sur ton autre appareil).${left}`
      : 'Ce code est déjà pris : choisis-en un autre.';
  if (mode === 'resume' && !r.exists)
    return `Aucun compte avec ce code sur ce serveur. Recopie-le depuis ton autre appareil (Profil → Compte).${left}`;
  if (mode !== 'resume' && r.exists)
    return "Ce code est déjà pris : choisis-en un autre, ou « Reprendre un compte existant » si c'est le tien.";
  return null;
}
