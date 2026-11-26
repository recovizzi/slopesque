import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { WheelActivity } from './wheel.service.js';

@WebSocketGateway()
export class WheelGateway {
  constructor(private readonly intents: IntentRunner, private readonly wheel: WheelActivity) {}

  @SubscribeMessage('wheel:set')
  set(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'wheel:set', b, (v, rt, me) => this.wheel.set(rt, me.id, v.items));
  }

  @SubscribeMessage('wheel:spin')
  spin(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'wheel:spin', b, (_v, rt, me) => this.wheel.spin(rt, me.id));
  }

  @SubscribeMessage('wheel:edit')
  edit(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'wheel:edit', b, (_v, rt, me) => this.wheel.edit(rt, me.id));
  }
}
