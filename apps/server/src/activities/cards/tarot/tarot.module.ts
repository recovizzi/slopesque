import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../../realtime/realtime.module.js';
import { PalmaresModule } from '../../palmares/palmares.module.js';
import { CardsModule } from '../cards.module.js';
import { TarotGateway } from './tarot.gateway.js';
import { TarotGame } from './tarot.service.js';

@Module({ imports: [RealtimeModule, CardsModule, PalmaresModule], providers: [TarotGame, TarotGateway] })
export class TarotModule {}
