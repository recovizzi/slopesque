// The rooms being played (openspec: realtime-sync, game-session): joining and leaving, the full state, switching
// activity (each activity says what the switch cancels or continues), the host, the social credit, the rankings reset,
// the console's notices. The rooms in memory are the RoomRegistry's; the activities, ACTIVITIES' (activities/).
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { Socket } from 'socket.io';
import type postgres from 'postgres';
import { creditWord, defaultHue, tierOf } from '@slopesque/engines';
import { PRESENCE, READY_ACTIVITIES, READY_CARD_GAMES, SCORE_NAMES, scoreKey, type ActivityChoice, type RoomState }
  from '@slopesque/shared';
import type { Account } from '../accounts/accounts.service.js';
import { ChatService } from '../chat/chat.service.js';
import { RoomLibrary } from '../chat/library.service.js';
import { DB, SQL, type Db } from '../db/db.module.js';
import { messages, roomMembers, rooms } from '../db/schema.js';
import { UserError } from '../errors.js';
import { ACTIVITIES, type Activity } from './activity.js';
import { RoomRegistry } from './room-registry.js';
import type { RoomRt, RoomSlots, SocketData } from './room-rt.js';
import { ADMIN_CHANNEL, RoomsService, type AdminNotice, type Room } from './rooms.service.js';
import { Votes } from './votes.service.js';

@Injectable()
export class RoomHub implements OnModuleInit {
  private readonly log = new Logger('Salons');

  constructor(@Inject(DB) private readonly db: Db, @Inject(SQL) private readonly sql: postgres.Sql, private readonly store: RoomsService,
    private readonly chat: ChatService, private readonly library: RoomLibrary, private readonly rooms: RoomRegistry,
    private readonly votes: Votes, @Inject(ACTIVITIES) private readonly activities: Activity[]) {}

  async onModuleInit() {
    this.rooms.useSwitch((rt, choice) => this.setActivity(rt, choice));
    this.votes.on('host', async (rt, v) => {
      if (!v.target) return;
      await this.rooms.setHost(rt, v.target);
      await this.rooms.say(rt, `${await this.rooms.nameOf(rt, v.target)} devient l'hôte (vote accepté).`, true);
    });
    this.votes.on('activity', async (rt, v) => { if (v.choice) await this.setActivity(rt, v.choice as ActivityChoice); });
    await this.votes.cancelOpen();
    await this.sql.listen(ADMIN_CHANNEL, payload => {
      try { this.onAdmin(JSON.parse(payload) as AdminNotice); } catch { /* malformed */ }
    });
  }

  /** A room starts being played (first player since the server started): each activity from the saved rules; a round
   *  that was running when the server stopped is cancelled, and it is said (in the chat, and in a window). */
  private async load(room: Room): Promise<RoomRt> {
    const rt: RoomRt = { room, seq: 0, members: new Map(), vote: null, notice: null, slots: {} as RoomSlots };
    for (const a of this.activities) a.init?.(rt);
    const lost: string[] = [];
    for (const a of this.activities) { const l = await a.restore?.(rt); if (l) lost.push(l); }
    if (lost.length) {
      const what = lost.join(' et '), several = lost.length > 1;
      const text = `Le serveur a redémarré pendant ${what} : ${several ? 'ils sont annulés' : 'la partie est annulée'}. `
        + 'Tout reprend à son début ; l\'hôte peut relancer.';
      rt.notice = { id: randomUUID(), title: 'Partie perdue', text, at: Date.now() };
      const said = `Le serveur a redémarré : ${what} en cours ${several ? 'sont annulés' : 'est annulé(e)'}.`;
      await this.chat.send(room.id, null, said, null, 'system');
    }
    return rt;
  }

  // ---------------------------------------------------------------- join / leave
  async join(socket: Socket, key: string, after?: number): Promise<RoomState> {
    const room = await this.store.byKey(key);
    if (!room) throw new UserError('unknown');
    const data = socket.data as SocketData, me = data.account.id;
    if (data.roomId && data.roomId !== room.id) this.leave(socket);
    const rt = this.rooms.get(room.id) ?? await this.load(room);
    this.rooms.add(rt);

    const inRoom = eq(roomMembers.roomId, room.id);
    const existing = await this.db.query.roomMembers.findFirst({ where: and(inRoom, eq(roomMembers.accountId, me)) });
    if (!existing) {
      const taken = (await this.db.select({ hue: roomMembers.hue }).from(roomMembers).where(inRoom)).map(x => x.hue);
      const hue = data.account.hue ?? defaultHue(taken);
      await this.db.insert(roomMembers).values({ roomId: room.id, accountId: me, hue }).onConflictDoNothing();
    }
    if (!rt.room.hostId) await this.rooms.setHost(rt, me);   // a new room: its first player hosts it

    const m = rt.members.get(me) ?? { sockets: new Set(), awaySince: null, grace: null };
    rt.members.set(me, m);
    const wasHere = m.sockets.size > 0 || m.grace !== null;
    if (m.grace) { clearTimeout(m.grace); m.grace = null; }
    m.sockets.add(socket.id);
    m.awaySince = null;
    data.roomId = room.id;
    await socket.join(`room:${room.id}`);
    if (!existing) await this.rooms.say(rt, `${data.account.name} rejoint le salon.`, true);
    if (!wasHere || !existing) await this.rooms.emitMember(rt, me);
    return this.state(rt, me, after);
  }

  /** The socket leaves its room; the player is away after the grace if it was his last connection there. */
  leave(socket: Socket) {
    const data = socket.data as SocketData;
    const rt = data.roomId ? this.rooms.get(data.roomId) : null;
    data.roomId = null;
    if (!rt) return;
    void socket.leave(`room:${rt.room.id}`);
    const me = data.account.id, m = rt.members.get(me);
    if (!m) return;
    m.sockets.delete(socket.id);
    if (m.sockets.size || m.grace) return;
    const since = Date.now();
    m.grace = setTimeout(() => {
      m.grace = null;
      if (m.sockets.size) return;
      m.awaySince = since;
      const mine = and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me));
      void this.db.update(roomMembers).set({ lastSeenAt: new Date(since) }).where(mine);
      void this.rooms.emitMember(rt, me);
      for (const a of this.activities) void a.left?.(rt, me);
    }, PRESENCE.graceMs);
    m.grace.unref?.();
  }

  // ---------------------------------------------------------------- state
  async state(rt: RoomRt, me: string, after?: number): Promise<RoomState> {
    const r = rt.room;
    return { seq: rt.seq, room: { key: r.key, name: r.name, createdAt: r.createdAt.getTime() }, me, hostId: r.hostId,
      members: await this.rooms.members(rt),
      chat: after ? await this.chat.since(r.id, r.createdAt, after) : await this.chat.page(r.id, r.createdAt), serverTime: Date.now(),
      stickers: await this.library.stickers(rt), emoji: await this.library.emoji(rt),
      activity: this.rooms.activity(rt), scope: this.rooms.scope(rt),
      notice: this.notice(rt), ...Object.assign({}, ...this.activities.map(a => a.view(rt, me))) } as RoomState;
  }

  /** A game lost by a restart, said to whoever comes within 30 min. */
  private notice(rt: RoomRt) {
    return rt.notice && Date.now() - rt.notice.at < 30 * 60_000 ? { id: rt.notice.id, title: rt.notice.title, text: rt.notice.text } : null;
  }

  /** The activity played now (none for the chat). */
  private current(rt: RoomRt) { return this.activities.find(a => a.key === this.rooms.activity(rt).activity); }

  // ---------------------------------------------------------------- activity, host, social credit, rankings
  /** The activity changes: each activity cancels its round (said in the chat) or carries it on elsewhere — the one
   *  chosen keeps its own (a round that just started switches to its activity); then a new session. */
  private async setActivity(rt: RoomRt, choice: ActivityChoice) {
    const before = this.rooms.activity(rt);
    if (before.activity !== choice.activity || (choice.activity === 'cards' && (before.cardGame ?? 'tdc') !== (choice.cardGame ?? 'tdc'))) {
      const lost: string[] = [];
      for (const a of this.activities) { const l = await a.cancel?.(rt, choice); if (l) lost.push(l); }
      const said = `Changement d'activité : ${lost.join(' et ')} en cours ${lost.length > 1 ? 'sont annulés' : 'est annulé(e)'}.`;
      if (lost.length) await this.rooms.say(rt, said, true);
    }
    for (const a of this.activities) await a.choose?.(rt, choice);
    const scope = ((rt.room.rules.scope as number | undefined) ?? 0) + 1;   // a new session
    rt.room = { ...rt.room, rules: { ...rt.room.rules, activity: choice, scope } };
    await this.db.update(rooms).set({ rules: rt.room.rules }).where(eq(rooms.id, rt.room.id));
    this.rooms.emit(rt, { type: 'activity', activity: choice, scope: this.rooms.scope(rt) });
    for (const a of this.activities) await a.chosen?.(rt, choice);
  }

  async giveHost(rt: RoomRt, me: string, to: string) {
    if (rt.room.hostId !== me) throw new UserError('Seul l\'hôte peut donner son rôle.');
    const [target] = await this.rooms.members(rt, to);
    if (!target) throw new UserError('Ce joueur n\'est pas dans le salon.');
    await this.rooms.setHost(rt, to);
    await this.rooms.say(rt, `${target.name} devient l'hôte.`, true);
  }

  /** /hote: the host already; the host away for 5 min or more (or gone): the role at once; else a vote. */
  async askHost(rt: RoomRt, me: Account): Promise<'already' | 'taken' | 'vote'> {
    if (rt.room.hostId === me.id) return 'already';
    const [host] = rt.room.hostId ? await this.rooms.members(rt, rt.room.hostId) : [];
    if (!host || host.presence === 'gone') {
      await this.rooms.setHost(rt, me.id);
      const mins = host?.awaySince ? Math.floor((Date.now() - host.awaySince) / 60_000) : 0;
      const why = host ? `${host.name} n'était plus là depuis ${mins} min` : 'l\'hôte avait quitté le salon';
      await this.rooms.say(rt, `${me.name} devient l'hôte : ${why}.`, true);
      return 'taken';
    }
    await this.votes.launch(rt, { kind: 'host', by: me.id, target: me.id, label: `demande à devenir l'hôte, à la place de ${host.name}` });
    return 'vote';
  }

  /** /activity: the host changes it at once; another player proposes it to a vote. */
  async chooseActivity(rt: RoomRt, me: Account, choice: ActivityChoice, label: string): Promise<'applied' | 'vote'> {
    const ready = READY_ACTIVITIES.includes(choice.activity)
      && (choice.activity !== 'cards' || READY_CARD_GAMES.includes(choice.cardGame ?? 'tdc'));
    if (!ready) {
      throw new UserError('Cette activité arrive bientôt.');
    }
    if (rt.room.hostId === me.id) {
      await this.setActivity(rt, choice);
      await this.rooms.say(rt, `${me.name} passe à ${label}.`, true);
      return 'applied';
    }
    await this.votes.launch(rt, { kind: 'activity', by: me.id, choice, label: `propose de passer à ${label}` });
    return 'vote';
  }

  /** /credit-social: never to oneself; said in the chat with the change. */
  async giveCredit(rt: RoomRt, me: string, to: string, delta: number) {
    if (to === me) throw new UserError('Impossible de se donner du crédit soi-même.');
    const [row] = await this.db.update(roomMembers).set({ credit: sql`${roomMembers.credit} + ${delta}` })
      .where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, to))).returning();
    if (!row) throw new UserError('Ce joueur n\'est plus dans le salon.');
    const data = { by: me, to, delta, tier: tierOf(delta).name, words: creditWord(Math.abs(delta)) };
    const [m] = await this.db.insert(messages).values({ roomId: rt.room.id, authorId: null, kind: 'credit', data }).returning();
    this.rooms.emit(rt, { type: 'message', message: this.chat.view(m!) });
    await this.rooms.emitMember(rt, to);
  }

  /** « Réinitialiser la partie »: the ranking of the game being played back to zero (the others, and the Palmarès,
   *  kept); its activity starts again from its first round (the Demi-disque). */
  async gameReset(rt: RoomRt, me: string) {
    this.rooms.hostOnly(rt, me);
    const key = scoreKey(this.rooms.activity(rt));
    if (!key) throw new UserError('Cette activité n\'a pas de classement.');
    await this.db.update(roomMembers).set({ scores: sql`${roomMembers.scores} - ${key}::text` }).where(eq(roomMembers.roomId, rt.room.id));
    await this.current(rt)?.reset?.(rt);
    for (const m of await this.rooms.members(rt)) await this.rooms.emitMember(rt, m.id);   // the absent ones too
    await this.rooms.say(rt, `Le classement ${SCORE_NAMES[key]} est remis à zéro (le palmarès est gardé).`);
  }

  // ---------------------------------------------------------------- the console's notices
  private onAdmin(n: AdminNotice) {
    if (n.type === 'room-deleted') {
      for (const rt of this.rooms.all()) if (rt.room.key === n.key) {
        const id = rt.room.id;
        this.rooms.io.to(`room:${id}`).emit('room-gone', { key: n.key });
        this.rooms.io.in(`room:${id}`).socketsLeave(`room:${id}`);
        for (const m of rt.members.values()) if (m.grace) clearTimeout(m.grace);
        this.rooms.remove(id);
        this.log.log(`salon ${n.key} supprimé par un admin`);
      }
    } else if (n.type === 'code-reset') this.rooms.kickAccount(n.accountId, null);
    else if (n.type === 'message-removed') {
      const rt = this.rooms.get(n.roomId);
      if (rt) this.rooms.emit(rt, { type: 'message-removed', id: n.id });
    }
    else if (n.type === 'members-changed' || n.type === 'room-changed') {
      for (const rt of this.rooms.all()) if ('roomId' in n ? rt.room.id === n.roomId : rt.room.key === n.key) void this.resync(rt);
    }
  }

  /** Something changed behind the room's back (the console): each player gets the room's full state again. */
  private async resync(rt: RoomRt) {
    const [fresh] = await this.db.select().from(rooms).where(eq(rooms.id, rt.room.id));
    if (fresh) rt.room = fresh;
    rt.seq++;
    for (const s of await this.rooms.io.in(`room:${rt.room.id}`).fetchSockets()) {
      s.emit('state', await this.state(rt, (s.data as SocketData).account.id));
    }
  }
}
