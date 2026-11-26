// A room's chat as it is played (openspec: chat-activity): a player's message, picture or GIF sent to everyone, its
// first link's preview after it, the reactions. The room's own lines (system) are the RoomRegistry's `say`.
import { Injectable } from '@nestjs/common';
import type { GifRef } from '@slopesque/shared';
import type { MediaRow } from '../media/media.service.js';
import { PreviewService } from '../external/preview.service.js';
import { UserError } from '../errors.js';
import { RoomRegistry } from '../rooms/room-registry.js';
import type { RoomRt } from '../rooms/room-rt.js';
import { ChatService } from './chat.service.js';

@Injectable()
export class ChatRoom {
  constructor(private readonly chat: ChatService, private readonly rooms: RoomRegistry, private readonly previews: PreviewService) {}

  /** A player's message (and the message it answers). */
  async post(rt: RoomRt, from: string, text: string, replyTo: number | null = null) {
    const message = await this.chat.send(rt.room.id, from, text, replyTo, 'text', null);
    this.rooms.emit(rt, { type: 'message', message });
    this.preview(rt, message.id, text);
    return message;
  }

  /** A picture in the chat, with what was written with it (and the message it answers). */
  async sendPicture(rt: RoomRt, from: string, kind: 'image' | 'sticker', pic: MediaRow, replyTo: number | null = null, text = '') {
    const message = await this.chat.sendMedia(rt.room.id, from, kind, pic, replyTo, text);
    this.rooms.emit(rt, { type: 'message', message });
    this.preview(rt, message.id, text);
  }

  async sendGif(rt: RoomRt, from: string, gif: GifRef, replyTo: number | null = null, text = '') {
    const message = await this.chat.sendGif(rt.room.id, from, gif, replyTo, text);
    this.rooms.emit(rt, { type: 'message', message });
    this.preview(rt, message.id, text);
  }

  /** My reaction added, or removed when I had it. */
  async react(rt: RoomRt, me: string, id: number, emoji: string) {
    const r = await this.chat.react(rt.room.id, id, me, emoji);
    if (!r) throw new UserError('Ce message n\'existe plus.');
    this.rooms.emit(rt, { type: 'reactions', id, reactions: r });
  }

  /** The first link's preview of a player's text, when its site gives one (it arrives after the message). */
  private preview(rt: RoomRt, id: number, text: string) {
    if (!text) return;
    void this.previews.forText(text).then(async p => {
      if (!p) return;
      const updated = await this.chat.setPreview(id, p);
      if (updated && this.rooms.isLive(rt)) this.rooms.emit(rt, { type: 'message-updated', message: updated });
    });
  }
}
