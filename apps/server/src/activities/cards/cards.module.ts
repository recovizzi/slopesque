// The card table, shared by the card games (cards/tdc, tarot, holdem, coinche: each its own module, joining the table).
import { Module } from '@nestjs/common';
import { CoreModule } from '../../core.module.js';
import { RealtimeModule } from '../../realtime/realtime.module.js';
import { CardsActivity } from './cards.activity.js';
import { CardsGateway } from './cards.gateway.js';
import { CardsSettings } from './settings.service.js';
import { CardsTable } from './table.service.js';

@Module({ imports: [CoreModule, RealtimeModule], providers: [CardsTable, CardsActivity, CardsSettings, CardsGateway],
  exports: [CardsTable, CardsActivity] })
export class CardsModule {}
