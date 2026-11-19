import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { CacheService } from './cache/cache.service.js';
import { StorageService } from './storage/storage.service.js';
import { HealthController } from './health/health.controller.js';
import { AccountsService } from './accounts/accounts.service.js';
import { RoomsService } from './rooms/rooms.service.js';
import { RoomHub } from './rooms/room-hub.service.js';
import { ChatService } from './chat/chat.service.js';
import { Gateway } from './realtime/gateway.js';

/** What the server and the admin console share (no WebSocket in the console). */
@Module({
  imports: [ConfigModule, DbModule],
  providers: [CacheService, StorageService, AccountsService, RoomsService, ChatService],
  exports: [CacheService, StorageService, AccountsService, RoomsService, ChatService],
})
export class CoreModule {}

@Module({ imports: [CoreModule], providers: [RoomHub, Gateway], controllers: [HealthController] })
export class AppModule {}
