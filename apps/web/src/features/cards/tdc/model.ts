// The Trou du cul's table in words (no DOM): a card's name, the plays shown in the middle and the line under them, a
// seat's state, my hint, my choice of cards (one value), how a watcher takes a seat, the rules' roles. The rules of
// the game themselves: engines' Tdc.
import { Tdc as T } from '@slopesque/engines';
import { SUIT_NAME } from '../model';

type Card = T.Card;
type Tdc = T.Tdc;

/** A card's name, said to screen readers: « Dame de cœur ». */
export const cardLabel = (c: Card) => `${T.rankName(c.r)} de ${SUIT_NAME[c.s]}`;

/** A play on the table, slightly turned (always the same way for the same cards), in degrees. */
export const tilt = (cs: Card[]) => ((cs[0]!.r * 7 + cs.length * 13) % 17) - 8;

/** The plays in the middle: the last 3 of the trick, or of the trick just taken (`closed`: dimmed, until the next
 *  play). */
export function shownPlays(t: Tdc) {
  const closed = !t.trick.length && t.lastTrick.length > 0;
  return { closed, plays: (closed ? t.lastTrick : t.trick).slice(-3) };
}

/** The line under the pile: the play to beat, who took the trick, or how to open (nothing once the round is over). */
export function pileText(t: Tdc, me: string, name: (seat: string) => string) {
  if (t.turn === null) return '';
  const last = T.top(t),
    { closed } = shownPlays(t);
  if (last) return `${name(last.by)} : ${T.playName(last.cards)} — à battre avec autant de cartes plus fortes`;
  if (closed) return `${name(t.lastTrick.at(-1)!.by)} ramasse le pli${t.turn === me ? " : à toi d'ouvrir" : ''}`;
  return 'Pli vide : ouvre avec 1 à 4 cartes de même valeur';
}

/** A seat's state under its name: out (its place), or passed in this trick. */
export function seatState(t: Tdc, seat: string) {
  const place = t.out.indexOf(seat);
  if (place >= 0) return `sorti ${place + 1}${place ? 'e' : 'er'}`;
  return t.passed.includes(seat) ? 'passe' : null;
}

/** What my hint says, for the cards I chose. */
export function hint(t: Tdc, me: string, chosen: Card[]) {
  if (t.turn === null) return '';
  if (t.turn !== me) return 'Attends ton tour…';
  if (!chosen.length) return 'Choisis tes cartes (même valeur)';
  return T.canPlay(t, chosen)
    ? `Jouer ${T.playName(chosen)} ?`
    : 'Pas jouable : autant de cartes que le pli, plus fortes';
}

/** A card clicked in my hand: chosen, or no longer; a card of another value starts a new choice. */
export function pick(hand: Card[], chosen: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const card = hand.find(x => x.id === id);
  if (!card) return chosen;
  const next = new Set(chosen);
  if (next.has(id)) next.delete(id);
  else {
    if ([...next].some(x => hand.find(y => y.id === x)?.r !== card.r)) next.clear();
    next.add(id);
  }
  return next;
}

/** The table's seats, for a watcher: the free ones (a robot plays them), mine (a robot plays it since I left), the
 *  robot whose seat I'd take, a table found full. */
export interface JoinSeats {
  free: number;
  total: number;
  mine: boolean;
  takes: string;
  full: boolean;
}
/** The watcher's button and why: take back my seat, take a robot's, or none left. */
export function joinText(s: JoinSeats, over: boolean) {
  const label = s.full
    ? `Table complète (${s.total}/${s.total})`
    : s.mine
      ? 'Reprendre ma place'
      : s.free
        ? `Prendre la place de ${s.takes}`
        : 'Rejoindre la partie';
  const why = s.mine
    ? 'Un robot joue ta main depuis que tu as quitté la table : reprends-la, les points de la manche restent les tiens.'
    : s.free
      ? `${s.free} place${s.free > 1 ? 's' : ''} sur ${s.total} ${s.free > 1 ? 'sont jouées' : 'est jouée'} par un robot : prends-en une, tu joues sa main ${over ? 'à la prochaine manche' : 'tout de suite'} et ses points deviennent les tiens.`
      : `Les ${s.total} places sont prises par des joueurs.`;
  return { label, why };
}

/** The rules: when each role is given. */
export const ROLE_WHEN: Record<T.Role, string> = {
  president: '1er sorti',
  vice: '2e sorti',
  neutre: 'au milieu',
  vtdc: 'avant-dernier',
  tdc: 'dernier',
};
