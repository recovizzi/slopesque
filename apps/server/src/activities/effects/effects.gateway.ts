import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import { Effects } from './effects.service.js';

@WebSocketGateway()
export class EffectsGateway {
  constructor(private readonly intents: IntentRunner, private readonly rooms: RoomRegistry, private readonly effects: Effects) {}

  @SubscribeMessage('effect:play')
  play(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('effect:play', b, async v => {
      await this.intents.limit(s, 'effects');
      await this.effects.play(this.rooms.roomOf(s), this.intents.me(s).id, v);
      return null;
    });
  }
}
