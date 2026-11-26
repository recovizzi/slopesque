import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../../realtime/realtime.module.js';
import { PalmaresModule } from '../../palmares/palmares.module.js';
import { CardsModule } from '../cards.module.js';
import { CoincheGateway } from './coinche.gateway.js';
import { CoincheGame } from './coinche.service.js';

@Module({ imports: [RealtimeModule, CardsModule, PalmaresModule], providers: [CoincheGame, CoincheGateway] })
export class CoincheModule {}
