import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../../realtime/realtime.module.js';
import { PalmaresModule } from '../../palmares/palmares.module.js';
import { CardsModule } from '../cards.module.js';
import { HoldemGateway } from './holdem.gateway.js';
import { HoldemGame } from './holdem.service.js';

@Module({ imports: [RealtimeModule, CardsModule, PalmaresModule], providers: [HoldemGame, HoldemGateway] })
export class HoldemModule {}
