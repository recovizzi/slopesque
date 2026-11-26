import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../realtime/realtime.module.js';
import { PalmaresGateway } from './palmares.gateway.js';
import { Palmares } from './palmares.service.js';

@Module({ imports: [RealtimeModule], providers: [Palmares, PalmaresGateway], exports: [Palmares] })
export class PalmaresModule {}
