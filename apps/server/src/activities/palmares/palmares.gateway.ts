import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { Palmares } from './palmares.service.js';

@WebSocketGateway()
export class PalmaresGateway {
  constructor(private readonly intents: IntentRunner, private readonly palmares: Palmares) {}

  @SubscribeMessage('palmares:get')
  list(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'palmares:get', b, (_v, rt) => this.palmares.list(rt));
  }
}
