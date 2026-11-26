// The chat (openspec: chat-activity): messages, pictures, GIF, stickers, emoji, photos, link previews.
import { Module } from '@nestjs/common';
import { CoreModule } from '../core.module.js';
import { GifService } from '../external/gif.service.js';
import { PreviewService } from '../external/preview.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { ChatRoom } from './chat-room.service.js';
import { ChatGateway } from './chat.gateway.js';
import { RoomLibrary } from './library.service.js';

@Module({
  imports: [CoreModule, RealtimeModule],
  providers: [ChatRoom, RoomLibrary, PreviewService, GifService, ChatGateway],
  exports: [ChatRoom, RoomLibrary],
})
export class ChatModule {}
