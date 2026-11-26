import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../../realtime/intent-runner.js';
import { TarotGame } from './tarot.service.js';

@WebSocketGateway()
export class TarotGateway {
  constructor(private readonly intents: IntentRunner, private readonly tarot: TarotGame) {}

  @SubscribeMessage('tarot:bid')
  bid(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:bid', b, (v, rt, me) => this.tarot.act(rt, me.id, { bid: v.bid }));
  }

  @SubscribeMessage('tarot:call')
  call(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:call', b, (v, rt, me) => this.tarot.act(rt, me.id, { call: v.card }));
  }

  @SubscribeMessage('tarot:discard')
  discard(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:discard', b, (v, rt, me) => this.tarot.act(rt, me.id, { discard: v.cards }));
  }

  @SubscribeMessage('tarot:handful')
  handful(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:handful', b, (v, rt, me) => this.tarot.handful(rt, me.id, v.level));
  }

  @SubscribeMessage('tarot:chelem')
  chelem(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:chelem', b, (_v, rt, me) => this.tarot.chelem(rt, me.id));
  }
}
