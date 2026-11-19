// The rooms being played, in memory (openspec: realtime-sync, design decision 4): who is connected, presence with a
// 15 s grace (a page change doesn't make a player blink away), the host, numbered events. Durable facts go to Postgres.
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Server, Socket } from 'socket.io';
import type postgres from 'postgres';
import { defaultHue } from '@slopesque/engines';
import { PRESENCE, type EmojiView, type GifRef, type MemberView, type RoomEvent, type RoomState, type StickerView } from '@slopesque/shared';
import { DB, SQL, type Db } from '../db/db.module.js';
import { accounts, customEmoji, media, roomMembers, rooms, stickers } from '../db/schema.js';
import { MediaService, type MediaRow } from '../media/media.service.js';
import { PreviewService } from '../external/preview.service.js';
import { ChatService } from '../chat/chat.service.js';
import { UserError } from '../errors.js';
import { ADMIN_CHANNEL, RoomsService, type AdminNotice, type Room } from './rooms.service.js';
import type { Account } from '../accounts/accounts.service.js';

interface MemberRt { sockets: Set<string>; awaySince: number | null; grace: NodeJS.Timeout | null }
interface RoomRt { room: Room; seq: number; members: Map<string, MemberRt> }
export interface SocketData { account: Account; ip: string; roomId: string | null }

@Injectable()
export class RoomHub implements OnModuleInit {
  private readonly log = new Logger('Salons');
  io!: Server;
  private readonly live = new Map<string, RoomRt>();

  constructor(@Inject(DB) private readonly db: Db, @Inject(SQL) private readonly sql: postgres.Sql,
    private readonly rooms: RoomsService, readonly chat: ChatService, private readonly media: MediaService, private readonly previews: PreviewService) {}

  async onModuleInit() {
    await this.sql.listen(ADMIN_CHANNEL, payload => { try { this.onAdmin(JSON.parse(payload) as AdminNotice); } catch { /* malformed */ } });
  }

  // ---------------------------------------------------------------- join / leave
  async join(socket: Socket, key: string): Promise<RoomState> {
    const room = await this.rooms.byKey(key);
    if (!room) throw new UserError('unknown');
    const data = socket.data as SocketData, me = data.account.id;
    if (data.roomId && data.roomId !== room.id) this.leave(socket);
    const rt = this.live.get(room.id) ?? { room, seq: 0, members: new Map() };
    this.live.set(room.id, rt);

    const existing = await this.db.query.roomMembers.findFirst({ where: and(eq(roomMembers.roomId, room.id), eq(roomMembers.accountId, me)) });
    if (!existing) {
      const taken = (await this.db.select({ hue: roomMembers.hue }).from(roomMembers).where(eq(roomMembers.roomId, room.id))).map(r => r.hue);
      await this.db.insert(roomMembers).values({ roomId: room.id, accountId: me, hue: data.account.hue ?? defaultHue(taken) }).onConflictDoNothing();
    }
    if (!rt.room.hostId) {   // a new room: its first player hosts it
      await this.db.update(rooms).set({ hostId: me }).where(eq(rooms.id, room.id));
      rt.room = { ...rt.room, hostId: me };
      this.emit(rt, { type: 'host', hostId: me });
    }

    const m = rt.members.get(me) ?? { sockets: new Set(), awaySince: null, grace: null };
    rt.members.set(me, m);
    const wasHere = m.sockets.size > 0 || m.grace !== null;
    if (m.grace) { clearTimeout(m.grace); m.grace = null; }
    m.sockets.add(socket.id);
    m.awaySince = null;
    data.roomId = room.id;
    await socket.join(`room:${room.id}`);
    if (!existing) await this.say(rt, null, `${data.account.name} rejoint le salon.`);
    if (!wasHere || !existing) await this.emitMember(rt, me);
    return this.state(rt, me);
  }

  /** The socket leaves its room; the player is away after the grace if it was his last connection there. */
  leave(socket: Socket) {
    const data = socket.data as SocketData;
    const rt = data.roomId ? this.live.get(data.roomId) : null;
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
      void this.db.update(roomMembers).set({ lastSeenAt: new Date(since) }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me)));
      void this.emitMember(rt, me);
    }, PRESENCE.graceMs);
    m.grace.unref?.();
  }

  // ---------------------------------------------------------------- state
  async state(rt: RoomRt, me: string): Promise<RoomState> {
    return { seq: rt.seq, room: { key: rt.room.key, name: rt.room.name, createdAt: rt.room.createdAt.getTime() }, me, hostId: rt.room.hostId,
      members: await this.members(rt), chat: await this.chat.page(rt.room.id, rt.room.createdAt), serverTime: Date.now(),
      stickers: await this.stickerViews(rt), emoji: await this.emojiViews(rt) };
  }

  private async members(rt: RoomRt, only?: string): Promise<MemberView[]> {
    const rows = await this.db.select({ m: roomMembers, a: accounts }).from(roomMembers).innerJoin(accounts, eq(accounts.id, roomMembers.accountId))
      .where(only ? and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, only)) : eq(roomMembers.roomId, rt.room.id))
      .orderBy(roomMembers.joinedAt);
    const photoIds = rows.map(r => r.m.photoId).filter((x): x is string => !!x);
    const known = new Set(photoIds.length ? (await this.db.select({ id: media.id }).from(media).where(inArray(media.id, photoIds))).map(x => x.id) : []);
    return rows.map(({ m, a }) => {
      const live = rt.members.get(a.id), here = !!live && (live.sockets.size > 0 || live.grace !== null);
      const awaySince = here ? null : live?.awaySince ?? m.lastSeenAt.getTime();
      const presence = here ? 'here' : Date.now() - awaySince! >= PRESENCE.goneMs ? 'gone' : 'away';
      return { id: a.id, name: a.name, hue: m.hue, photo: m.photoId && known.has(m.photoId) ? this.media.url(m.photoId) : null, presence, awaySince, playing: m.playing, score: m.score, credit: m.credit, joinedAt: m.joinedAt.getTime() };
    });
  }

  roomOf(socket: Socket) {
    const id = (socket.data as SocketData).roomId, rt = id ? this.live.get(id) : null;
    if (!rt) throw new UserError('Tu n\'es dans aucun salon.');
    return rt;
  }

  // ---------------------------------------------------------------- events
  emit(rt: RoomRt, e: RoomEvent) {
    rt.seq++;
    this.io?.to(`room:${rt.room.id}`).emit('event', { ...e, seq: rt.seq });
  }
  async emitMember(rt: RoomRt, id: string) {
    const [member] = await this.members(rt, id);
    if (member) this.emit(rt, { type: 'member', member });
  }
  async say(rt: RoomRt, from: string | null, text: string, replyTo: number | null = null) {
    const message = await this.chat.send(rt.room.id, from, text, replyTo, from ? 'text' : 'system');
    this.emit(rt, { type: 'message', message });
    if (from) void this.previews.forText(text).then(async p => {   // the first link's preview, when its site gives one
      if (!p) return;
      const updated = await this.chat.setPreview(message.id, p);
      if (updated && this.live.get(rt.room.id) === rt) this.emit(rt, { type: 'message-updated', message: updated });
    });
    return message;
  }

  // ---------------------------------------------------------------- pictures
  /** A picture just uploaded, for this usage (an upload is only good for the usage of its ticket). */
  async picture(id: string, usage: string): Promise<MediaRow> {
    const row = await this.media.get(id);
    if (!row || row.usage !== usage) throw new UserError('Image introuvable : envoie-la de nouveau.');
    return row;
  }

  async sendPicture(socket: Socket, kind: 'image' | 'sticker', pic: MediaRow, replyTo: number | null = null) {
    const rt = this.roomOf(socket);
    const message = await this.chat.sendMedia(rt.room.id, (socket.data as SocketData).account.id, kind, pic, replyTo);
    this.emit(rt, { type: 'message', message });
  }

  async sendGif(socket: Socket, gif: GifRef) {
    const rt = this.roomOf(socket);
    this.emit(rt, { type: 'message', message: await this.chat.sendGif(rt.room.id, (socket.data as SocketData).account.id, gif) });
  }

  private async stickerViews(rt: RoomRt): Promise<StickerView[]> {
    const rows = await this.db.select({ s: stickers, m: media }).from(stickers).innerJoin(media, eq(media.id, stickers.mediaId))
      .where(eq(stickers.roomId, rt.room.id)).orderBy(desc(stickers.usedAt)).limit(60);
    return rows.map(({ s, m }) => ({ id: s.id, src: this.media.url(m.id), w: m.width, h: m.height }));
  }
  private async emojiViews(rt: RoomRt): Promise<EmojiView[]> {
    const rows = await this.db.select().from(customEmoji).where(eq(customEmoji.roomId, rt.room.id)).orderBy(customEmoji.createdAt);
    return rows.map(e => ({ name: e.name, url: this.media.url(e.mediaId), by: e.addedBy }));
  }

  /** The room's sticker library: a new one first (the same picture once), 60 at most (the oldest go). */
  async addSticker(socket: Socket, pic: MediaRow, send: boolean) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    const [same] = await this.db.select().from(stickers).where(and(eq(stickers.roomId, rt.room.id), eq(stickers.mediaId, pic.id)));
    if (same) await this.db.update(stickers).set({ usedAt: new Date() }).where(eq(stickers.id, same.id));
    else await this.db.insert(stickers).values({ roomId: rt.room.id, mediaId: pic.id, addedBy: me });
    const extra = (await this.db.select({ id: stickers.id, mediaId: stickers.mediaId }).from(stickers).where(eq(stickers.roomId, rt.room.id)).orderBy(desc(stickers.usedAt))).slice(60);
    if (extra.length) { await this.db.delete(stickers).where(inArray(stickers.id, extra.map(x => x.id))); await this.media.sweep(extra.map(x => x.mediaId)); }
    this.emit(rt, { type: 'stickers', stickers: await this.stickerViews(rt) });
    if (send) await this.sendPicture(socket, 'sticker', pic);
  }

  async sendSticker(socket: Socket, id: string) {
    const rt = this.roomOf(socket);
    const [s] = await this.db.select().from(stickers).where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id)));
    if (!s) throw new UserError('Ce sticker n\'existe plus.');
    await this.db.update(stickers).set({ usedAt: new Date() }).where(eq(stickers.id, id));
    this.emit(rt, { type: 'stickers', stickers: await this.stickerViews(rt) });
    await this.sendPicture(socket, 'sticker', (await this.media.get(s.mediaId))!);
  }

  /** Removed from the library: deleted (and its picture, if no other room uses it). */
  async removeSticker(socket: Socket, id: string) {
    const rt = this.roomOf(socket);
    const [s] = await this.db.delete(stickers).where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id))).returning();
    if (s) await this.media.sweep([s.mediaId]);
    this.emit(rt, { type: 'stickers', stickers: await this.stickerViews(rt) });
  }

  async addEmoji(socket: Socket, name: string, pic: MediaRow) {
    const rt = this.roomOf(socket), a = (socket.data as SocketData).account;
    const [row] = await this.db.insert(customEmoji).values({ roomId: rt.room.id, name, mediaId: pic.id, addedBy: a.id }).onConflictDoNothing().returning();
    if (!row) throw new UserError(`:${name}: existe déjà dans le salon.`);
    this.emit(rt, { type: 'emoji', emoji: await this.emojiViews(rt) });
    await this.say(rt, null, `${a.name} a ajouté l'emoji :${name}: pour tout le salon.`);
  }

  /** My photo in this room (null: removed); the old one is deleted at once. */
  async setPhoto(socket: Socket, pic: MediaRow | null) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    const [before] = await this.db.select({ p: roomMembers.photoId }).from(roomMembers).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me)));
    await this.db.update(roomMembers).set({ photoId: pic?.id ?? null }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me)));
    if (before?.p && before.p !== pic?.id) await this.media.sweep([before.p]);
    await this.emitMember(rt, me);
  }

  /** A profile changed: every room where the player is shown hears it. */
  async profileChanged(accountId: string) {
    for (const rt of this.live.values()) if (rt.members.has(accountId)) await this.emitMember(rt, accountId);
  }

  async giveHost(socket: Socket, to: string) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    if (rt.room.hostId !== me) throw new UserError('Seul l\'hôte peut donner son rôle.');
    const [target] = await this.members(rt, to);
    if (!target) throw new UserError('Ce joueur n\'est pas dans le salon.');
    await this.db.update(rooms).set({ hostId: to }).where(eq(rooms.id, rt.room.id));
    rt.room = { ...rt.room, hostId: to };
    this.emit(rt, { type: 'host', hostId: to });
    await this.say(rt, null, `${target.name} devient l'hôte.`);
  }

  // ---------------------------------------------------------------- the console's notices
  private onAdmin(n: AdminNotice) {
    if (n.type === 'room-deleted') {
      for (const [id, rt] of this.live) if (rt.room.key === n.key) {
        this.io.to(`room:${id}`).emit('room-gone', { key: n.key });
        this.io.in(`room:${id}`).socketsLeave(`room:${id}`);
        for (const m of rt.members.values()) if (m.grace) clearTimeout(m.grace);
        this.live.delete(id);
        this.log.log(`salon ${n.key} supprimé par un admin`);
      }
    } else if (n.type === 'code-reset') this.kickAccount(n.accountId, null);
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
