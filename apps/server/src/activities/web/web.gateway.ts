import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { WebActivity } from './web.service.js';

@WebSocketGateway()
export class WebGateway {
  constructor(private readonly intents: IntentRunner, private readonly web: WebActivity) {}

  @SubscribeMessage('web:set')
  set(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'web:set', b, async (v, rt, me) => { await this.web.set(rt, me.id, v.integration, v.url); return null; });
  }
}
