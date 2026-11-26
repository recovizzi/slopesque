import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { WheelActivity } from './wheel.service.js';

@WebSocketGateway()
export class WheelGateway {
  constructor(private readonly intents: IntentRunner, private readonly wheel: WheelActivity) {}

  @SubscribeMessage('wheel:set')
  set(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'wheel:set', b, async (v, rt, me) => { await this.wheel.set(rt, me.id, v.items); return null; });
  }

  @SubscribeMessage('wheel:spin')
  spin(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'wheel:spin', b, async (_v, rt, me) => { await this.wheel.spin(rt, me.id); return null; });
  }

  @SubscribeMessage('wheel:edit')
  edit(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'wheel:edit', b, async (_v, rt, me) => { await this.wheel.edit(rt, me.id); return null; });
  }
}
