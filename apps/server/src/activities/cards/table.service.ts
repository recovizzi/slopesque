// The card table every card game plays on: its seats, the round's game (each game joins the table at start), what each
// player sees of it, whose turn has lasted too long. The games depend on it; it knows them only as CardGames.
import { Inject, Injectable } from '@nestjs/common';
import { KICK_AFTER_MS, Table } from '@slopesque/engines';
import type { CardGameKey, CardsView } from '@slopesque/shared';
import { ENV, type Env } from '../../config/config.module.js';
import { MediaService } from '../../media/media.service.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';
import type { CardGame } from './table.js';

@Injectable()
export class CardsTable {
  private readonly games = new Map<CardGameKey, CardGame>();

  constructor(@Inject(ENV) readonly env: Env, private readonly rooms: RoomRegistry, private readonly media: MediaService) {}

  /** A card game joins the table (its service, when the server starts). */
  register(game: CardGame) { this.games.set(game.key, game); }
  game(key: CardGameKey) { return this.games.get(key)!; }
  /** The game the table plays now. */
  current(rt: RoomRt) { return this.game(rt.slots.cards.game); }

  init(rt: RoomRt) {
    const settings = { tdc: 4, tarot: 4, holdem: 6, coinche: 4, ...((rt.room.rules.cards as object | undefined) ?? {}) };
    rt.slots.cards = { game: 'tdc', players: 4, settings, showTricks: true, settled: false, seats: [], paid: {}, turnSince: 0,
      robot: null, late: null, art: {} };
    for (const g of this.games.values()) g.init(rt);
  }

  /** Every game's round dropped. */
  clear(rt: RoomRt) { for (const g of this.games.values()) g.clear(rt); }
  inRound(rt: RoomRt) { return this.current(rt).inRound(rt); }
  turnOf(rt: RoomRt) { return this.current(rt).turn(rt); }
  /** After a move or a change of seats, in the game played now. */
  after(rt: RoomRt, before: string | null = null) { return this.current(rt).after(rt, before); }

  /** What a player sees: the seats, his own hand (the others' as backs), the last round's points, the late seat. */
  view(rt: RoomRt, me: string): CardsView {
    const c = rt.slots.cards, mine = Table.seatOfUser(c.seats, me)?.id ?? null;
    const games = Object.assign({}, ...[...this.games.values()].map(g => g.view(rt, mine))) as Partial<CardsView>;
    const art = Object.fromEntries(Object.entries(c.art).map(([n, id]) => [n, this.media.url(id)]));
    return { game: c.game, players: c.players, settings: c.settings, showTricks: c.showTricks, seats: c.seats,
      tdc: null, tarot: null, holdem: null, coinche: null, next: null, ...games,
      paid: c.paid, turnSince: c.turnSince, late: this.lateSeat(rt), art };
  }
  async emit(rt: RoomRt) { await this.rooms.emitEach(rt, me => ({ type: 'cards', cards: this.view(rt, me) })); }

  /** The name at a seat: its player's (or the player whose points it plays for), else its robot's. */
  async seatName(rt: RoomRt, seat: string) {
    const s = rt.slots.cards.seats.find(x => x.id === seat), uid = s ? s.user ?? s.credit : null;
    if (!uid) return s?.bot ?? '?';
    return this.rooms.nameOf(rt, uid);
  }

  /** The player whose turn has lasted 30 s or more (a player, not a robot): /kick may propose to make him leave. */
  lateSeat(rt: RoomRt) {
    const c = rt.slots.cards, turn = this.turnOf(rt), s = turn !== null ? c.seats.find(x => x.id === turn) : null;
    if (!s?.user || Date.now() - c.turnSince < KICK_AFTER_MS) return null;
    return { seat: s.id, user: s.user, secs: Math.floor((Date.now() - c.turnSince) / 1000) };
  }

  /** The table of a card game, before its first deal (or another number of seats): the players already seated keep
   *  their seat, robots on the others; players take a seat before the host deals (the robots wait for the deal). */
  prepare(rt: RoomRt, game: CardGameKey) {
    const c = rt.slots.cards, n = c.settings[game];
    if (this.inRound(rt) && c.game === game) return;
    if (c.game === game && c.seats.length === n) return;
    const seated = c.seats.map(s => s.user).filter((u): u is string => !!u).slice(0, n);
    c.seats = Table.seatTable(seated, n).slice(0, n);
    c.game = game; c.players = n; this.clear(rt); c.paid = {};
  }

  /** A step of the round: the clock of the turn starts again when the turn moves; the timers of the step before go. */
  restart(rt: RoomRt, turn: string | null, before: string | null) {
    const c = rt.slots.cards;
    if (turn !== before) c.turnSince = Date.now();
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
  }

  /** A player's turn: at 30 s, the « Exclure ? » button appears on his seat. */
  waitFor(rt: RoomRt) { rt.slots.cards.late = setTimeout(() => void this.emit(rt), KICK_AFTER_MS + 200); }

  /** A new round: each seat's points go to whoever sits there now. */
  credit(rt: RoomRt) { rt.slots.cards.seats = rt.slots.cards.seats.map(s => ({ ...s, credit: s.user })); }
}
