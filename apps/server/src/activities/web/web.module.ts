import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../realtime/realtime.module.js';
import { WebGateway } from './web.gateway.js';
import { WebActivity } from './web.service.js';

@Module({ imports: [RealtimeModule], providers: [WebActivity, WebGateway], exports: [WebActivity] })
export class WebModule {}
