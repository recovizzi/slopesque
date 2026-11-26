// A room's own pictures (openspec: chat-activity): its sticker library, its custom emoji, each player's photo. A
// picture nothing uses any more is deleted at once (MediaService.sweep).
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { EmojiView, StickerView } from '@slopesque/shared';
import type { Account } from '../accounts/accounts.service.js';
import { DB, type Db } from '../db/db.module.js';
import { customEmoji, media, roomMembers, stickers } from '../db/schema.js';
import { MediaService, type MediaRow } from '../media/media.service.js';
import { UserError } from '../errors.js';
import { RoomRegistry } from '../rooms/room-registry.js';
import type { RoomRt } from '../rooms/room-rt.js';
import { ChatRoom } from './chat-room.service.js';

@Injectable()
export class RoomLibrary {
  constructor(@Inject(DB) private readonly db: Db, private readonly media: MediaService, private readonly rooms: RoomRegistry,
    private readonly chat: ChatRoom) {}

  // ---------------------------------------------------------------- stickers
  async stickers(rt: RoomRt): Promise<StickerView[]> {
    const rows = await this.db.select({ s: stickers, m: media }).from(stickers).innerJoin(media, eq(media.id, stickers.mediaId))
      .where(eq(stickers.roomId, rt.room.id)).orderBy(desc(stickers.usedAt)).limit(60);
    return rows.map(({ s, m }) => ({ id: s.id, src: this.media.url(m.id), w: m.width, h: m.height }));
  }

  /** A sticker of the room, as a picture (a choice of a poll), or null. */
  async sticker(rt: RoomRt, id: string) {
    const [st] = await this.db.select({ m: media }).from(stickers).innerJoin(media, eq(media.id, stickers.mediaId))
      .where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id)));
    return st ? { src: this.media.url(st.m.id), w: st.m.width, h: st.m.height } : null;
  }

  /** The room's sticker library: a new one first (the same picture once), 60 at most (the oldest go). */
  async addSticker(rt: RoomRt, me: string, pic: MediaRow, send: boolean) {
    const [same] = await this.db.select().from(stickers).where(and(eq(stickers.roomId, rt.room.id), eq(stickers.mediaId, pic.id)));
    if (same) await this.db.update(stickers).set({ usedAt: new Date() }).where(eq(stickers.id, same.id));
    else await this.db.insert(stickers).values({ roomId: rt.room.id, mediaId: pic.id, addedBy: me });
    const extra = (await this.db.select({ id: stickers.id, mediaId: stickers.mediaId }).from(stickers).where(eq(stickers.roomId, rt.room.id))
      .orderBy(desc(stickers.usedAt))).slice(60);
    if (extra.length) { await this.db.delete(stickers).where(inArray(stickers.id, extra.map(x => x.id))); await this.media.sweep(extra.map(x => x.mediaId)); }
    const lib = await this.stickers(rt);
    this.rooms.emit(rt, { type: 'stickers', stickers: lib });
    if (send) await this.chat.sendPicture(rt, me, 'sticker', pic);
    return lib.find(x => x.src === this.media.url(pic.id)) ?? lib[0]!;
  }

  async sendSticker(rt: RoomRt, me: string, id: string, replyTo: number | null = null, text = '') {
    const [s] = await this.db.select().from(stickers).where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id)));
    if (!s) throw new UserError('Ce sticker n\'existe plus.');
    await this.db.update(stickers).set({ usedAt: new Date() }).where(eq(stickers.id, id));
    this.rooms.emit(rt, { type: 'stickers', stickers: await this.stickers(rt) });
    await this.chat.sendPicture(rt, me, 'sticker', (await this.media.get(s.mediaId))!, replyTo, text);
  }

  /** Removed from the library: deleted (and its picture, if no other room uses it). */
  async removeSticker(rt: RoomRt, id: string) {
    const [s] = await this.db.delete(stickers).where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id))).returning();
    if (s) await this.media.sweep([s.mediaId]);
    this.rooms.emit(rt, { type: 'stickers', stickers: await this.stickers(rt) });
  }

  // ---------------------------------------------------------------- custom emoji
  async emoji(rt: RoomRt): Promise<EmojiView[]> {
    const rows = await this.db.select().from(customEmoji).where(eq(customEmoji.roomId, rt.room.id)).orderBy(customEmoji.createdAt);
    return rows.map(e => ({ name: e.name, url: this.media.url(e.mediaId), by: e.addedBy }));
  }

  async addEmoji(rt: RoomRt, me: Account, name: string, pic: MediaRow) {
    const [row] = await this.db.insert(customEmoji).values({ roomId: rt.room.id, name, mediaId: pic.id, addedBy: me.id }).onConflictDoNothing().returning();
    if (!row) throw new UserError(`:${name}: existe déjà dans le salon.`);
    this.rooms.emit(rt, { type: 'emoji', emoji: await this.emoji(rt) });
    await this.rooms.say(rt, `${me.name} a ajouté l'emoji :${name}: pour tout le salon.`, true);
  }

  // ---------------------------------------------------------------- photo
  /** My photo in this room (null: removed); the old one is deleted at once. */
  async setPhoto(rt: RoomRt, me: string, pic: MediaRow | null) {
    const mine = and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me));
    const [before] = await this.db.select({ p: roomMembers.photoId }).from(roomMembers).where(mine);
    await this.db.update(roomMembers).set({ photoId: pic?.id ?? null }).where(mine);
    if (before?.p && before.p !== pic?.id) await this.media.sweep([before.p]);
    await this.rooms.emitMember(rt, me);
  }
}
