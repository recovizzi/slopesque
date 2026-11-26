// The activities (refactor-architecture, design decision 1): each one a module on the Activity contract, listed here
// once under the ACTIVITIES token, in the order the hub runs them (cancelled rounds are said in this order).
import { Module } from '@nestjs/common';
import { ACTIVITIES, type Activity } from '../rooms/activity.js';
import { DiskModule } from './disk/disk.module.js';
import { DiskActivity } from './disk/disk.service.js';
import { PalmaresModule } from './palmares/palmares.module.js';

@Module({
  imports: [DiskModule, PalmaresModule],
  providers: [{ provide: ACTIVITIES, useFactory: (...list: Activity[]) => list, inject: [DiskActivity] }],
  exports: [ACTIVITIES],
})
export class ActivitiesModule {}
