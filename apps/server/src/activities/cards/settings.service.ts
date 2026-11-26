// The host's choices at the card table: the robots' level, the number of seats of each game, the way of dealing, the
// last trick shown, the trumps' pictures (each trump of the Tarot dressed with a picture of the room).
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { TarotAI } from '@slopesque/engines';
import { CARD_PLAYERS, type CardGameKey } from '@slopesque/shared';
import { DB, type Db } from '../../db/db.module.js';
import { trumpArt } from '../../db/schema.js';
import { MediaService } from '../../media/media.service.js';
import { UserError } from '../../errors.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';
import { GAME_NAME } from './table.js';
import { CardsTable } from './table.service.js';

/** Each game's numbers of seats, in words (CARD_PLAYERS). */
const SEATS: Record<CardGameKey, string> = { tarot: 'Le Tarot se joue à 4 ou à 5.', tdc: 'Le Trou du cul se joue de 3 à 8.',
  holdem: 'Le Texas Hold\'em se joue de 2 à 8.', coinche: 'La Coinche se joue à 4 (deux équipes de deux).' };

@Injectable()
export class CardsSettings {
  constructor(@Inject(DB) private readonly db: Db, private readonly rooms: RoomRegistry, private readonly table: CardsTable,
    private readonly media: MediaService) {}

  /** The robots' level at the card games. */
  async bots(rt: RoomRt, me: string, level: TarotAI.Level) {
    this.rooms.hostOnly(rt, me);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, bots: level };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    await this.rooms.say(rt, `Robots des cartes : niveau ${TarotAI.LEVELS[level]}.`);
    await this.table.emit(rt);
  }

  /** The number of seats for a game (robots complete them), from the next deal. */
  async players(rt: RoomRt, me: string, game: CardGameKey, players: number) {
    this.rooms.hostOnly(rt, me);
    if (!(CARD_PLAYERS[game] as readonly number[]).includes(players)) throw new UserError(SEATS[game]);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, [game]: players };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    if (!this.table.inRound(rt)) this.table.prepare(rt, game);
    const later = this.table.inRound(rt) ? (game === 'holdem' ? ', à partir de la partie suivante' : ', à partir de la donne suivante')
      : '';
    await this.rooms.say(rt, `${GAME_NAME[game]} à ${players} joueurs${later} : des robots complètent les places libres.`);
    await this.table.emit(rt);
  }

  /** The way of dealing at the Tarot and the Coinche (from the next deal): random, or as at a table. */
  async dealMode(rt: RoomRt, me: string, mode: 'random' | 'classic') {
    this.rooms.hostOnly(rt, me);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, dealMode: mode };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    await this.rooms.say(rt, mode === 'classic'
      ? 'Distribution à l\'ancienne : les plis ramassés, coupés, distribués par paquets (plus de mains déséquilibrées), '
        + 'à partir de la donne suivante.'
      : 'Distribution aléatoire : le paquet mélangé à chaque donne, à partir de la donne suivante.');
    await this.table.emit(rt);
  }

  async tricks(rt: RoomRt, me: string, show: boolean) {
    this.rooms.hostOnly(rt, me);
    rt.slots.cards.showTricks = show;
    await this.table.emit(rt);
  }

  /** A trump dressed with a picture (its « trump » format), or given back its default look (null). */
  async art(rt: RoomRt, me: string, card: number, mediaId: string | null) {
    this.rooms.hostOnly(rt, me);
    const c = rt.slots.cards, key = String(card), old = c.art[key];
    if (mediaId) {
      const m = await this.media.picture(mediaId, 'trump');
      await this.db.insert(trumpArt).values({ roomId: rt.room.id, card: key, mediaId: m.id })
        .onConflictDoUpdate({ target: [trumpArt.roomId, trumpArt.card], set: { mediaId: m.id } });
      c.art[key] = m.id;
    } else {
      await this.db.delete(trumpArt).where(and(eq(trumpArt.roomId, rt.room.id), eq(trumpArt.card, key)));
      delete c.art[key];
    }
    if (old && old !== mediaId) void this.media.sweep([old]);   // no longer used: deleted (unless used elsewhere)
    await this.table.emit(rt);
  }

  async artReset(rt: RoomRt, me: string) {
    this.rooms.hostOnly(rt, me);
    const old = Object.values(rt.slots.cards.art);
    await this.db.delete(trumpArt).where(eq(trumpArt.roomId, rt.room.id));
    rt.slots.cards.art = {};
    if (old.length) void this.media.sweep(old);
    await this.rooms.say(rt, 'Les atouts reprennent leur habillage par défaut.');
    await this.table.emit(rt);
  }
}
