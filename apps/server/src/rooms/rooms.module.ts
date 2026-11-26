// The rooms' core (refactor-architecture, design decision 1): the rooms in memory and the votes, which every activity
// may use; it depends on no activity.
import { Module } from '@nestjs/common';
import { CoreModule } from '../core.module.js';
import { RoomRegistry } from './room-registry.js';
import { Votes } from './votes.service.js';

@Module({ imports: [CoreModule], providers: [RoomRegistry, Votes], exports: [RoomRegistry, Votes] })
export class RoomsModule {}
