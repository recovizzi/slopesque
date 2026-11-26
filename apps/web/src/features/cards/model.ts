// The card table's pure logic, shared by every card game (no DOM): the suits, who plays a seat, the pills' columns,
// my hand's fan, the clock. The components (PlayingCard, SeatPill, Hand, TableHead…) draw from it.
import { hueColor } from '@slopesque/engines';
import type { CardGameKey, CardSeatView, CardsView, Intent, IntentName, MemberView } from '@slopesque/shared';

export type Suit = 'S' | 'H' | 'D' | 'C';
export const SUIT_EMOJI: Record<Suit, string> = { S: '♠️', H: '♥️', D: '♦️', C: '♣️' };
export const SUIT_NAME: Record<Suit, string> = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
export const isRed = (s: Suit) => s === 'H' || s === 'D';

/** A seat no player is behind (a robot from the start): the table's grey (cards.css). */
export const ROBOT_COLOR = 'var(--cg-robot)';

/** Who a seat shows: a name (« Toi » for me), a colour (`hue` null: a robot's grey), a robot playing it, a photo. */
export interface Seated {
  name: string;
  color: string;
  hue: number | null;
  bot: boolean;
  photo: string | null;
}
export type WhoOf = (seat: string) => Seated;

/** Who plays each seat: its player, or the robot that replaced him (his name and colour until the end of the round,
 *  no photo), or a robot from the start (its own name, grey). */
export function seatWho(seats: CardSeatView[], members: ReadonlyMap<string, MemberView>, me: string): WhoOf {
  return id => {
    const s = seats.find(x => x.id === id),
      uid = s ? (s.user ?? s.credit) : null,
      m = uid ? members.get(uid) : undefined;
    return {
      name: uid === me ? 'Toi' : (m?.name ?? s?.bot ?? '?'),
      hue: m ? m.hue : null,
      color: m ? hueColor(m.hue) : ROBOT_COLOR,
      bot: !s?.user,
      photo: s?.user ? (m?.photo ?? null) : null,
    };
  };
}

/** Who got a seat's points in the last round (the Trou du cul's results): its last player, or a robot (no points). */
export function paidWho(
  paid: Record<string, string | null>,
  members: ReadonlyMap<string, MemberView>,
  me: string,
  who: WhoOf,
): WhoOf {
  return id => {
    const u = paid[id],
      m = u ? members.get(u) : undefined;
    if (!u) return { ...who(id), bot: true };
    return {
      name: u === me ? 'Toi' : (m?.name ?? '?'),
      hue: m ? m.hue : null,
      color: m ? hueColor(m.hue) : ROBOT_COLOR,
      bot: false,
      photo: null,
    };
  };
}

/** A player's turn has lasted 30 s (`secs`): a vote can make a robot play for him (`vote`: one is running). */
export interface Late {
  seat: string;
  secs: number;
  vote: boolean;
}

/** What a table can ask (CardsStage answers): an intent to the server (its refusal shown under the table), take a
 *  seat (a full table: said on the button), propose a kick, open the rules. */
export interface TableActions {
  send: <N extends IntentName>(name: N, body?: Intent<N>) => void;
  join: () => void;
  kick: () => void;
  rules: () => void;
}

/** How many pills per row: all on one row up to 4, else two rows. */
export const seatCols = (n: number) => (n <= 4 ? Math.max(1, n) : Math.ceil(n / 2));

export interface Fan {
  r: number;
  step: number;
}
/** My hand's fan for the hand's width `w` and a card's size: every card turns around the same point `r` below it, a
 *  flat arc (it rises 34 px at most), the outer cards inside the hand, 0.06 rad between two cards at most. */
export function fanOf(n: number, w: number, cw: number, ch: number): Fan {
  const r = ch * 8;
  const wide = Math.asin(Math.min(1, Math.max(0, (w / 2 - cw / 2 - 4) / (r + ch / 2)))),
    flat = Math.acos(1 - 34 / r);
  return { r, step: n > 1 ? Math.min(0.06, (2 * Math.min(wide, flat)) / (n - 1)) : 0 };
}
/** The i-th card's angle in a fan of n (radians, as the CSS custom property --a takes it). */
export const handAngle = (i: number, n: number, step: number) => ((i - (n - 1) / 2) * step).toFixed(4);

/** The game's clock: mm:ss, h:mm:ss after an hour. */
export function fmtClock(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
}

/** « 1 joueur », « 2 joueurs »: a count and its word, in the plural from 2. */
export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Before the first deal: the game and its number of seats, from the host's settings. */
export function preDealTitle(game: CardGameKey, settings: CardsView['settings']) {
  if (game === 'tarot') return `Tarot à ${settings.tarot}`;
  if (game === 'holdem') return `Texas Hold'em à ${settings.holdem ?? 2}`;
  if (game === 'coinche') return 'Coinche, 2 contre 2';
  return `Trou du cul à ${settings.tdc}`;
}
