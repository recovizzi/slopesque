import { Module } from '@nestjs/common';
import { ChatModule } from '../../chat/chat.module.js';
import { CoreModule } from '../../core.module.js';
import { RealtimeModule } from '../../realtime/realtime.module.js';
import { ChatPolls } from './chat-poll.service.js';
import { PollGateway } from './poll.gateway.js';
import { PollActivity } from './poll.service.js';

@Module({ imports: [CoreModule, RealtimeModule, ChatModule], providers: [PollActivity, ChatPolls, PollGateway], exports: [PollActivity] })
export class PollModule {}
