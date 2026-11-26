// The hub of the rooms: what joins the core (RoomsModule), the chat and the activities.
import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { CoreModule } from '../core.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { RoomHub } from './room-hub.service.js';
import { RoomsGateway } from './rooms.gateway.js';

@Module({ imports: [CoreModule, RealtimeModule, ChatModule, ActivitiesModule], providers: [RoomHub, RoomsGateway], exports: [RoomHub] })
export class HubModule {}
