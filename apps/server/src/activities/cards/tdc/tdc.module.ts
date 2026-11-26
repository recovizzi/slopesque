import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../../realtime/realtime.module.js';
import { PalmaresModule } from '../../palmares/palmares.module.js';
import { CardsModule } from '../cards.module.js';
import { TdcGame } from './tdc.service.js';

/** The Trou du cul has no intent of its own: cards:play and cards:pass. */
@Module({ imports: [RealtimeModule, CardsModule, PalmaresModule], providers: [TdcGame] })
export class TdcModule {}
