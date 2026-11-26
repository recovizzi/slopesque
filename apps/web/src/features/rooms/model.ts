// My rooms (openspec: game-session): the list kept with my account, what its windows check before saving it, what
// the page of a room that can't be entered says. Pure: the components ask the server and save.
import { newKey, normalizeKey } from '@slopesque/engines';
import type { SavedRoom } from '@slopesque/shared';
import type { RoomStatus } from '../../app/store';

/** A room's name in my list: the one I gave it, or its key. */
export const roomName = (r: SavedRoom) => r.name.trim() || r.key;

/** A key typed to add a room: its normal form, or why it can't be added. */
export function keyToAdd(typed: string, rooms: SavedRoom[]): { key: string } | { error: string } {
  const key = normalizeKey(typed);
  if (!key) return { error: 'Une clé a la forme XXXX-XXXX : lettres et chiffres, sans I, L, O, 0 ni 1.' };
  const known = rooms.find(r => r.key === key);
  if (known) return { error: `Déjà dans ta liste : ${roomName(known)}.` };
  return { key };
}

/** A new room's key, not one of mine. */
export function freshKey(rooms: SavedRoom[], draw = newKey) {
  let k = draw();
  while (rooms.some(r => r.key === k)) k = draw();
  return k;
}

export type BlockedStatus = Exclude<RoomStatus, 'ok' | 'loading' | 'none'>;

/** The page of a room that can't be entered: its title and what to do. */
export function blockedText(status: BlockedStatus, server: string): [title: string, text: string] {
  return {
    pending: [
      'Salon en attente de création',
      "Ce salon n'existe pas encore sur le serveur. Contacte un admin pour qu'il le crée avec cette clé :",
    ],
    unknown: [
      'Salon inconnu',
      'Le serveur ne connaît aucun salon avec cette clé. Vérifie-la, ou demande la bonne à un membre du salon :',
    ],
    offline: [
      'Serveur injoignable',
      `Aucune réponse de ${server}. Vérifie l'adresse du serveur dans Paramètres → Extension, ou ta connexion.`,
    ],
  }[status] as [string, string];
}

/** After « Réessayer »: nothing when the room's state changed, else that it is still the same. */
export function retryNote(before: RoomStatus, now: RoomStatus) {
  if (now !== before) return '';
  return before === 'pending'
    ? 'Toujours pas créé : un admin doit encore créer ce salon avec sa clé.'
    : 'Toujours la même réponse.';
}
