// The rooms being played, in memory (openspec: realtime-sync, design decision 4): who is connected, presence with a
// 15 s grace (a page change doesn't make a player blink away), the host, numbered events. Durable facts go to Postgres.
// The core every module depends on (refactor-architecture, design decision 1): it never names an activity.
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Server, Socket } from 'socket.io';
import { PRESENCE, type ActivityChoice, type MemberView, type RoomEvent } from '@slopesque/shared';
import { DB, type Db } from '../db/db.module.js';
import { accounts, media, roomMembers, rooms } from '../db/schema.js';
import { ChatService } from '../chat/chat.service.js';
import { MediaService } from '../media/media.service.js';
import { UserError } from '../errors.js';
import type { RoomRt, SocketData } from './room-rt.js';

type Switch = (rt: RoomRt, choice: ActivityChoice) => Promise<void>;

@Injectable()
export class RoomRegistry {
  io!: Server;
  private readonly live = new Map<string, RoomRt>();
  private switcher: Switch | null = null;

  constructor(@Inject(DB) private readonly db: Db, private readonly chat: ChatService, private readonly media: MediaService) {}

  // ---------------------------------------------------------------- the rooms in memory
  get(id: string) { return this.live.get(id); }
  add(rt: RoomRt) { this.live.set(rt.room.id, rt); }
  remove(id: string) { this.live.delete(id); }
  all() { return [...this.live.values()]; }
  /** Still the room being played (not deleted by the console since). */
  isLive(rt: RoomRt) { return this.live.get(rt.room.id) === rt; }

  roomOf(socket: Socket) {
    const id = (socket.data as SocketData).roomId, rt = id ? this.live.get(id) : null;
    if (!rt) throw new UserError('Tu n\'es dans aucun salon.');
    return rt;
  }

  /** The room's Socket.IO channel. */
  to(rt: RoomRt) { return this.io.to(`room:${rt.room.id}`); }

  // ---------------------------------------------------------------- presence
  /** The players connected now (or within their grace): the voters of a vote launched now, the candidates of a round. */
  connected(rt: RoomRt) { return [...rt.members].filter(([, m]) => m.sockets.size > 0 || m.grace !== null).map(([id]) => id); }

  async members(rt: RoomRt, only?: string): Promise<MemberView[]> {
    const rows = await this.db.select({ m: roomMembers, a: accounts }).from(roomMembers)
      .innerJoin(accounts, eq(accounts.id, roomMembers.accountId))
      .where(only ? and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, only)) : eq(roomMembers.roomId, rt.room.id))
      .orderBy(roomMembers.joinedAt);
    const photoIds = rows.map(r => r.m.photoId).filter((x): x is string => !!x);
    const found = photoIds.length ? await this.db.select({ id: media.id }).from(media).where(inArray(media.id, photoIds)) : [];
    const known = new Set(found.map(x => x.id));
    return rows.map(({ m, a }) => {
      const live = rt.members.get(a.id), here = !!live && (live.sockets.size > 0 || live.grace !== null);
      const awaySince = here ? null : live?.awaySince ?? m.lastSeenAt.getTime();
      const presence = here ? 'here' : Date.now() - awaySince! >= PRESENCE.goneMs ? 'gone' : 'away';
      const photo = m.photoId && known.has(m.photoId) ? this.media.url(m.photoId) : null;
      return { id: a.id, name: a.name, hue: m.hue, photo, presence, awaySince, playing: m.playing, scores: m.scores, credit: m.credit,
        joinedAt: m.joinedAt.getTime() };
    });
  }

  /** A player's current name in the room (« ? » when he is no longer in it). */
  async nameOf(rt: RoomRt, id: string) { return (await this.members(rt, id))[0]?.name ?? '?'; }

  // ---------------------------------------------------------------- events
  emit(rt: RoomRt, e: RoomEvent) {
    rt.seq++;
    this.io?.to(`room:${rt.room.id}`).emit('event', { ...e, seq: rt.seq });
  }
  /** Each player gets the event as he may see it (the host's answer hidden until the reveal, his own hand…). */
  async emitEach(rt: RoomRt, event: (me: string) => RoomEvent) {
    rt.seq++;
    for (const s of await this.io.in(`room:${rt.room.id}`).fetchSockets()) {
      s.emit('event', { ...event((s.data as SocketData).account.id), seq: rt.seq });
    }
  }
  async emitMember(rt: RoomRt, id: string) {
    const [member] = await this.members(rt, id);
    if (member) this.emit(rt, { type: 'member', member });
  }
  /** A line from the room: it belongs to the activity being played (shown during it only) unless general. */
  async say(rt: RoomRt, text: string, general = false) {
    const message = await this.chat.send(rt.room.id, null, text, null, 'system', general ? null : this.scope(rt));
    this.emit(rt, { type: 'message', message });
    return message;
  }

  // ---------------------------------------------------------------- rules, activity
  /** A part of the room's rules changed: in memory first, then the whole of them written — two writes at the same
   *  time can't put back an older copy (each writes the latest). */
  async saveRules(rt: RoomRt, key: string, value: unknown) {
    rt.room = { ...rt.room, rules: { ...rt.room.rules, [key]: value } };
    await this.db.update(rooms).set({ rules: rt.room.rules }).where(eq(rooms.id, rt.room.id));
  }
  /** A game is running (its kind) or not (null): kept in the room's rules, to say it is lost after a restart. */
  async setLive(rt: RoomRt, what: string, on: string | null) {
    const live = { ...((rt.room.rules.live ?? {}) as Record<string, string>) };
    if (on) live[what] = on; else delete live[what];
    await this.saveRules(rt, 'live', live);
  }
  /** What a restart found running (setLive): `what`'s kind, or undefined. */
  wasLive(rt: RoomRt, what: string) { return ((rt.room.rules.live ?? {}) as Record<string, string | undefined>)[what]; }

  activity(rt: RoomRt): ActivityChoice { return (rt.room.rules.activity as ActivityChoice | undefined) ?? { activity: 'chat' }; }
  /** The session of the activity: a new one each time an activity is chosen. */
  scope(rt: RoomRt) { return `${this.activity(rt).activity}#${(rt.room.rules.scope as number | undefined) ?? 0}`; }

  /** A round starts from another activity (« Distribuer » from the chat…): the room switches to its activity first.
   *  The switch is the hub's (installed at start): the core can't depend on the hub, which depends on every activity. */
  async enter(rt: RoomRt, choice: ActivityChoice) { if (this.activity(rt).activity !== choice.activity) await this.switcher!(rt, choice); }
  useSwitch(fn: Switch) { this.switcher = fn; }

  // ---------------------------------------------------------------- host, players, rankings
  hostOnly(rt: RoomRt, me: string) { if (rt.room.hostId !== me) throw new UserError('Seul l\'hôte peut faire ça.'); }

  async setHost(rt: RoomRt, to: string) {
    await this.db.update(rooms).set({ hostId: to }).where(eq(rooms.id, rt.room.id));
    rt.room = { ...rt.room, hostId: to };
    this.emit(rt, { type: 'host', hostId: to });
  }

  /** The players who joined (« Participer », or seated at a card table). */
  async playingIds(rt: RoomRt) {
    const rows = await this.db.select({ id: roomMembers.accountId }).from(roomMembers)
      .where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.playing, true)));
    return new Set(rows.map(r => r.id));
  }
  async setPlaying(rt: RoomRt, user: string, playing: boolean) {
    await this.db.update(roomMembers).set({ playing }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, user)));
    await this.emitMember(rt, user);
  }

  /** A player's points in one game's ranking (disk, tdc, tarot, holdem, coinche). */
  async addScore(rt: RoomRt, user: string, game: string, pts: number) {
    const total = sql`to_jsonb(coalesce((${roomMembers.scores}->>${game})::int, 0) + ${pts}::int)`;
    await this.db.update(roomMembers).set({ scores: sql`jsonb_set(${roomMembers.scores}, ${`{${game}}`}::text[], ${total})` })
      .where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, user)));
  }

  // ---------------------------------------------------------------- accounts
  /** A profile changed: every room where the player is shown hears it. */
  async profileChanged(accountId: string) {
    for (const rt of this.live.values()) if (rt.members.has(accountId)) await this.emitMember(rt, accountId);
  }

  /** The account's code was replaced: its connections end (« Ce code a été remplacé »), except `keep`. */
  kickAccount(accountId: string, keep: string | null) {
    for (const s of this.io.sockets.sockets.values()) {
      if ((s.data as SocketData).account?.id !== accountId || s.id === keep) continue;
      s.emit('fatal', { reason: 'replaced' });
      s.disconnect(true);
    }
  }
}
