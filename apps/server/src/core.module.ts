// What the server and the admin console share (no WebSocket in the console).
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { CacheService } from './cache/cache.service.js';
import { StorageService } from './storage/storage.service.js';
import { AccountsService } from './accounts/accounts.service.js';
import { RoomsService } from './rooms/rooms.service.js';
import { ChatService } from './chat/chat.service.js';
import { MediaService } from './media/media.service.js';

@Module({
  imports: [ConfigModule, DbModule],
  providers: [CacheService, StorageService, AccountsService, RoomsService, ChatService, MediaService],
  exports: [CacheService, StorageService, AccountsService, RoomsService, ChatService, MediaService],
})
export class CoreModule {}
