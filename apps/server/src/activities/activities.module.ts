// The activities (refactor-architecture, design decision 1): each one a module on the Activity contract, listed here
// once under the ACTIVITIES token, in the order the hub runs them (cancelled rounds are said in this order).
import { Module } from '@nestjs/common';
import { ACTIVITIES, type Activity } from '../rooms/activity.js';
import { CardsModule } from './cards/cards.module.js';
import { CardsActivity } from './cards/cards.activity.js';
import { CoincheModule } from './cards/coinche/coinche.module.js';
import { HoldemModule } from './cards/holdem/holdem.module.js';
import { TarotModule } from './cards/tarot/tarot.module.js';
import { TdcModule } from './cards/tdc/tdc.module.js';
import { DiskModule } from './disk/disk.module.js';
import { DiskActivity } from './disk/disk.service.js';
import { EffectsModule } from './effects/effects.module.js';
import { PalmaresModule } from './palmares/palmares.module.js';
import { PollModule } from './poll/poll.module.js';
import { PollActivity } from './poll/poll.service.js';
import { WebModule } from './web/web.module.js';
import { WebActivity } from './web/web.service.js';
import { WheelModule } from './wheel/wheel.module.js';
import { WheelActivity } from './wheel/wheel.service.js';

@Module({
  imports: [DiskModule, PollModule, WheelModule, WebModule, CardsModule, TdcModule, TarotModule, HoldemModule, CoincheModule,
    EffectsModule, PalmaresModule],
  providers: [{ provide: ACTIVITIES, useFactory: (...list: Activity[]) => list,
    inject: [DiskActivity, PollActivity, WheelActivity, WebActivity, CardsActivity] }],
  exports: [ACTIVITIES],
})
export class ActivitiesModule {}
