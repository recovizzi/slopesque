import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../realtime/realtime.module.js';
import { WheelGateway } from './wheel.gateway.js';
import { WheelActivity } from './wheel.service.js';

@Module({ imports: [RealtimeModule], providers: [WheelActivity, WheelGateway], exports: [WheelActivity] })
export class WheelModule {}
