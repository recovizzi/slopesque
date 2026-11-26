// The chat's intents (openspec: chat-activity): messages, reactions, pictures (a ticket, then the upload over HTTP),
// GIF, stickers, emoji, my photo in the room.
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { AccountsService } from '../accounts/accounts.service.js';
import { GifService } from '../external/gif.service.js';
import { MediaService } from '../media/media.service.js';
import { IntentRunner } from '../realtime/intent-runner.js';
import { RoomRegistry } from '../rooms/room-registry.js';
import { ChatRoom } from './chat-room.service.js';
import { ChatService } from './chat.service.js';
import { RoomLibrary } from './library.service.js';

@WebSocketGateway()
export class ChatGateway {
  constructor(private readonly intents: IntentRunner, private readonly rooms: RoomRegistry, private readonly chat: ChatService,
    private readonly room: ChatRoom, private readonly library: RoomLibrary, private readonly media: MediaService,
    private readonly gifs: GifService, private readonly accounts: AccountsService) {}

  @SubscribeMessage('chat:history')
  history(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'chat:history', b, (v, rt) => this.chat.page(rt.room.id, rt.room.createdAt, v.before));
  }

  @SubscribeMessage('chat:send')
  send(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'chat:send', b, async (v, rt, me) => {
      await this.intents.limit(s, 'messages');
      await this.room.post(rt, me.id, v.text, v.replyTo ?? null);
      return null;
    });
  }

  @SubscribeMessage('chat:react')
  react(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'chat:react', b, async (v, rt, me) => {
      await this.intents.limit(s, 'reactions');
      await this.room.react(rt, me.id, v.id, v.emoji);
      return null;
    });
  }

  // ---------------------------------------------------------------- pictures, stickers, emoji, photo
  @SubscribeMessage('media:ticket')
  ticket(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('media:ticket', b, v => this.media.ticket(this.intents.me(s).id, v.usage));
  }

  @SubscribeMessage('chat:media')
  chatMedia(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('chat:media', b, async v => {
      await this.intents.limit(s, 'messages');
      const pic = await this.media.picture(v.mediaId, 'chat');
      await this.room.sendPicture(this.rooms.roomOf(s), this.intents.me(s).id, 'image', pic, v.replyTo ?? null, v.text ?? '');
      return null;
    });
  }

  @SubscribeMessage('chat:gif')
  chatGif(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('chat:gif', b, async v => {
      await this.intents.limit(s, 'messages');
      await this.room.sendGif(this.rooms.roomOf(s), this.intents.me(s).id, v.gif, v.replyTo ?? null, v.text ?? '');
      return null;
    });
  }

  @SubscribeMessage('sticker:add')
  stickerAdd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('sticker:add', b, async v => {
      const pic = await this.media.picture(v.mediaId, 'sticker');
      return this.library.addSticker(this.rooms.roomOf(s), this.intents.me(s).id, pic, v.send);
    });
  }

  @SubscribeMessage('sticker:send')
  stickerSend(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('sticker:send', b, async v => {
      await this.intents.limit(s, 'messages');
      await this.library.sendSticker(this.rooms.roomOf(s), this.intents.me(s).id, v.id, v.replyTo ?? null, v.text ?? '');
      return null;
    });
  }

  @SubscribeMessage('sticker:remove')
  stickerRemove(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'sticker:remove', b, (v, rt) => this.library.removeSticker(rt, v.id));
  }

  @SubscribeMessage('emoji:add')
  emojiAdd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('emoji:add', b, async v => {
      const pic = await this.media.picture(v.mediaId, 'emoji');
      await this.library.addEmoji(this.rooms.roomOf(s), this.intents.me(s), v.name, pic);
      return null;
    });
  }

  @SubscribeMessage('photo:set')
  photo(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('photo:set', b, async v => {
      const pic = v.mediaId ? await this.media.picture(v.mediaId, 'photo') : null;
      await this.library.setPhoto(this.rooms.roomOf(s), this.intents.me(s).id, pic);
      return null;
    });
  }

  // ---------------------------------------------------------------- GIF
  @SubscribeMessage('gif:search')
  gifSearch(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('gif:search', b, async v => {
      await this.intents.limit(s, 'gifs');
      return this.gifs.page(v.q, v.page, v.provider);
    });
  }

  @SubscribeMessage('gif:trending')
  gifTrending(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('gif:trending', b, async v => {
      await this.intents.limit(s, 'gifs');
      return this.gifs.page(null, v.page, v.provider);
    });
  }

  @SubscribeMessage('gif:favorites')
  gifFavorites(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('gif:favorites', b, v => this.accounts.saveGifFavorites(this.intents.me(s).id, v.favorites));
  }
}
