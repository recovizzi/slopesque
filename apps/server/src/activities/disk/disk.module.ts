import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../realtime/realtime.module.js';
import { PalmaresModule } from '../palmares/palmares.module.js';
import { DiskGateway } from './disk.gateway.js';
import { DiskActivity } from './disk.service.js';

@Module({ imports: [RealtimeModule, PalmaresModule], providers: [DiskActivity, DiskGateway], exports: [DiskActivity] })
export class DiskModule {}
