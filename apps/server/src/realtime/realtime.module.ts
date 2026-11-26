// What every module's gateway uses to run its intents.
import { Module } from '@nestjs/common';
import { CoreModule } from '../core.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { IntentRunner } from './intent-runner.js';

@Module({ imports: [CoreModule, RoomsModule], providers: [IntentRunner], exports: [IntentRunner, RoomsModule] })
export class RealtimeModule {}
