import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { Coinche } from '@slopesque/engines';
import { IntentRunner } from '../../../realtime/intent-runner.js';
import { CoincheGame } from './coinche.service.js';

@WebSocketGateway()
export class CoincheGateway {
  constructor(private readonly intents: IntentRunner, private readonly coinche: CoincheGame) {}

  @SubscribeMessage('coinche:say')
  say(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'coinche:say', b, async (v, rt, me) => {
      const say = (v.kind === 'bid' ? { kind: 'bid', value: v.value ?? 0, suit: v.suit ?? 'S' } : { kind: v.kind }) as Coinche.Say;
      await this.coinche.act(rt, me.id, { say });
      return null;
    });
  }

  @SubscribeMessage('coinche:next')
  next(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'coinche:next', b, (_v, rt, me) => this.coinche.ready(rt, me.id));
  }

  @SubscribeMessage('coinche:target')
  target(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'coinche:target', b, (v, rt, me) => this.coinche.setTarget(rt, me.id, v.target));
  }
}
