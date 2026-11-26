import { Module } from '@nestjs/common';
import { ChatModule } from '../../chat/chat.module.js';
import { RealtimeModule } from '../../realtime/realtime.module.js';
import { EffectsGateway } from './effects.gateway.js';
import { Effects } from './effects.service.js';

@Module({ imports: [RealtimeModule, ChatModule], providers: [Effects, EffectsGateway] })
export class EffectsModule {}
