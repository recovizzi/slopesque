import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { DiskActivity } from './disk.service.js';

@WebSocketGateway()
export class DiskGateway {
  constructor(private readonly intents: IntentRunner, private readonly disk: DiskActivity) {}

  @SubscribeMessage('disk:rules')
  rules(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.inRoom(s, 'disk:rules', b, (v, rt, me) => this.disk.rules(rt, me.id, v)); }

  @SubscribeMessage('disk:join')
  join(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'disk:join', b, async (_v, rt, me) => { await this.disk.join(rt, me); return null; });
  }

  @SubscribeMessage('disk:start')
  start(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'disk:start', b, async (v, rt, me) => { await this.disk.start(rt, me.id, v.word, v.target); return null; });
  }

  @SubscribeMessage('disk:guess')
  guess(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'disk:guess', b, async (v, rt, me) => { await this.disk.guess(rt, me.id, v.value); return null; });
  }

  @SubscribeMessage('disk:next')
  next(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'disk:next', b, async (_v, rt, me) => { await this.disk.next(rt, me.id); return null; });
  }
}
