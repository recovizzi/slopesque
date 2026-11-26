// The card table shared by the card games (openspec: define-game-concept, Cartes): its seats (players and robots),
// who got each seat's points, the clock of the turn, the robots' timers, the host's settings, the trumps' pictures.
// Each game (cards/<game>) keeps its round in its own slot and joins the table as a CardGame.
import type { Table } from '@slopesque/engines';
import type { CardGameKey, CardsView } from '@slopesque/shared';
import type { RoomRt } from '../../rooms/room-rt.js';

export interface TableRt {
  game: CardGameKey;
  players: number;
  /** The host's choices (from the next deal), kept in the room's rules (`cards`). */
  settings: CardsView['settings'];
  showTricks: boolean;
  seats: Table.CardSeat[];
  /** The last round: who got each seat's points (null: a robot). */
  paid: Record<string, string | null>;
  /** The round's end counted (once). */
  settled: boolean;
  turnSince: number;
  /** The next step of the table (a robot's move, the next hand or deal). */
  robot: NodeJS.Timeout | null;
  /** A player's turn: « Exclure ? » shown after 30 s. */
  late: NodeJS.Timeout | null;
  /** Tarot: the room's pictures of the trumps (« 0 » the Excuse … « 21 »), their media. */
  art: Record<string, string>;
}
declare module '../../rooms/room-rt.js' { interface RoomSlots { cards: TableRt } }

export type CardMove = { play: string[] } | { pass: true };

/** A card game at the table: what the table asks of it (its round, its turn, its view) and its steps. */
export interface CardGame {
  readonly key: CardGameKey;
  /** Its slot in a room that starts being played: no round. */
  init(rt: RoomRt): void;
  /** Its round dropped (another table, or the activity changed during it). */
  clear(rt: RoomRt): void;
  /** A round is being played. */
  inRound(rt: RoomRt): boolean;
  /** The seat whose turn it is. */
  turn(rt: RoomRt): string | null;
  /** Its part of the table's view (CardsView), as this seat may see it (null: a spectator). */
  view(rt: RoomRt, seat: string | null): Partial<CardsView>;
  /** The seats no player may take (Hold'em: eliminated), or null. */
  out?(rt: RoomRt): string[] | null;
  /** « Distribuer » (the host). */
  deal(rt: RoomRt): Promise<void>;
  /** cards:play / cards:pass. */
  move(rt: RoomRt, me: string, move: CardMove): Promise<void>;
  /** After a move or a change of seats: the clock of the turn, the round's end, the robots. */
  after(rt: RoomRt, before?: string | null): Promise<void>;
}

/** What a change of activity or a restart cancels, in words. */
export const GAME_ROUND: Record<CardGameKey, string> = { tdc: 'la manche du Trou du cul', tarot: 'la donne de Tarot',
  holdem: 'la partie de Texas Hold\'em', coinche: 'la partie de Coinche' };
export const GAME_NAME: Record<CardGameKey, string> = { tdc: 'Trou du cul', tarot: 'Tarot', holdem: 'Texas Hold\'em', coinche: 'Coinche' };
