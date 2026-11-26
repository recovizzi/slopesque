import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../../realtime/intent-runner.js';
import { HoldemGame } from './holdem.service.js';

@WebSocketGateway()
export class HoldemGateway {
  constructor(private readonly intents: IntentRunner, private readonly holdem: HoldemGame) {}

  @SubscribeMessage('holdem:act')
  act(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'holdem:act', b, (v, rt, me) => this.holdem.act(rt, me.id, v));
  }

  @SubscribeMessage('holdem:rules')
  rules(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'holdem:rules', b, (v, rt, me) => this.holdem.setRules(rt, me.id, v));
  }

  @SubscribeMessage('holdem:end')
  end(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'holdem:end', b, (_v, rt, me) => this.holdem.end(rt, me.id));
  }
}
