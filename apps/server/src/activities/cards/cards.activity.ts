// The Cartes activity (openspec: define-game-concept, Cartes): the table of the game chosen with the activity, its
// round cancelled when another activity or game is chosen, players taking a robot's seat or leaving it, /kick.
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Table } from '@slopesque/engines';
import { cardGameOf, type ActivityChoice, type CardGameKey } from '@slopesque/shared';
import type { Account } from '../../accounts/accounts.service.js';
import { DB, type Db } from '../../db/db.module.js';
import { trumpArt } from '../../db/schema.js';
import { UserError } from '../../errors.js';
import type { Activity } from '../../rooms/activity.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';
import { Votes } from '../../rooms/votes.service.js';
import { GAME_ROUND, type CardMove } from './table.js';
import { CardsTable } from './table.service.js';

@Injectable()
export class CardsActivity implements Activity {
  readonly key = 'cards';

  constructor(@Inject(DB) private readonly db: Db, private readonly rooms: RoomRegistry, private readonly table: CardsTable,
    private readonly votes: Votes) {
    votes.on('kick', async (rt, v) => {
      if (!v.target) return;
      await this.rooms.say(rt, `${await this.rooms.nameOf(rt, v.target)} doit quitter la table : vote accepté.`);
      await this.leave(rt, v.target);
    });
  }

  init(rt: RoomRt) { this.table.init(rt); }

  /** The trumps' pictures; a game running when the server stopped is lost. */
  async restore(rt: RoomRt) {
    for (const a of await this.db.select().from(trumpArt).where(eq(trumpArt.roomId, rt.room.id))) rt.slots.cards.art[a.card] = a.mediaId;
    const live = this.rooms.wasLive(rt, 'cards');
    return live ? GAME_ROUND[live as CardGameKey] ?? 'la partie de cartes' : null;
  }

  view(rt: RoomRt, me: string) { return { cards: this.table.view(rt, me) }; }

  async cancel(rt: RoomRt, to: ActivityChoice) {
    const c = rt.slots.cards;
    if (!this.table.inRound(rt) || (to.activity === 'cards' && cardGameOf(to) === c.game)) return null;
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
    const lost = GAME_ROUND[c.game];
    this.table.clear(rt); c.paid = {}; c.settled = false;
    await this.rooms.setLive(rt, 'cards', null); await this.table.emit(rt);
    return lost;
  }

  /** The game chosen (the Tarot with its number of players): its table. */
  async choose(rt: RoomRt, to: ActivityChoice) {
    if (to.cardGame === 'tarot' && to.tarotPlayers) rt.slots.cards.settings = { ...rt.slots.cards.settings, tarot: to.tarotPlayers };
    if (to.activity === 'cards') this.table.prepare(rt, cardGameOf(to));
  }
  async chosen(rt: RoomRt, to: ActivityChoice) { if (to.activity === 'cards') await this.table.emit(rt); }

  /** « Distribuer » (host): a new round of the game chosen with the activity. */
  async deal(rt: RoomRt, me: string) {
    this.rooms.hostOnly(rt, me);
    await this.table.game(cardGameOf(this.rooms.activity(rt))).deal(rt);
  }

  async move(rt: RoomRt, me: string, move: CardMove) { await this.table.current(rt).move(rt, me, move); }

  /** Watching: take a seat a robot plays (my own first); its hand and this round's points become mine. */
  async join(rt: RoomRt, me: Account): Promise<'ok' | 'full'> {
    const c = rt.slots.cards;
    if (Table.seatOfUser(c.seats, me.id)) return 'ok';
    const out = this.table.current(rt).out?.(rt);
    const r = Table.join(out ? c.seats.filter(s => !out.includes(s.id)) : c.seats, me.id);   // Hold'em: an eliminated seat is not taken
    if (r === 'seated') return 'ok';
    if (r === 'full') return 'full';
    c.seats = c.seats.map(s => r.seats.find(x => x.id === s.id) ?? s);
    await this.rooms.setPlaying(rt, me.id, true);   // seated: a player, not a spectator
    const inRound = this.table.inRound(rt);
    const hand = inRound ? ' et joue sa main en cours : les points de la manche seront les siens' : '';
    await this.rooms.say(rt, r.was.owner === me.id ? `${me.name} reprend sa place.`
      : `${me.name} prend la place de ${r.was.name}${hand}.`);
    await this.table.after(rt, this.table.turnOf(rt));
    return 'ok';
  }

  async leave(rt: RoomRt, user: string) {
    const c = rt.slots.cards;
    if (!Table.seatOfUser(c.seats, user)) return;
    const inRound = this.table.inRound(rt);
    c.seats = Table.leave(c.seats, user, inRound);
    await this.rooms.setPlaying(rt, user, false);
    const name = await this.rooms.nameOf(rt, user);
    await this.rooms.say(rt, inRound
      ? `${name} quitte la table : un robot finit la manche à sa place (les points de la manche restent les siens).`
      : `${name} quitte la table : un robot prend sa place.`);
    await this.table.after(rt, this.table.turnOf(rt));
  }

  /** /kick (or the button on his seat): a vote to make the late player leave the table. */
  async askKick(rt: RoomRt, me: string, name?: string): Promise<'vote'> {
    const playing = this.rooms.activity(rt).activity === 'cards' && this.table.inRound(rt);
    if (!playing) throw new UserError('/kick sert pendant une partie de cartes.');
    const late = this.table.lateSeat(rt);
    const lateName = late ? await this.rooms.nameOf(rt, late.user) : '';
    if (name && (!late || lateName.toLowerCase() !== name.toLowerCase())) {
      throw new UserError(`${name} ne fait pas attendre la table : seul le joueur dont le tour dure depuis 30 s peut être exclu.`);
    }
    if (!late) throw new UserError('Personne ne fait attendre la table : /kick vise le joueur dont le tour dure depuis 30 s.');
    const label = `propose d'exclure ${lateName} de la table : son tour dure depuis ${late.secs} s`;
    await this.votes.launch(rt, { kind: 'kick', by: me, target: late.user, label });
    return 'vote';
  }
}
