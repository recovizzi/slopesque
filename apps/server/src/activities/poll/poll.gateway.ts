import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { ChatPolls } from './chat-poll.service.js';
import { PollActivity } from './poll.service.js';

@WebSocketGateway()
export class PollGateway {
  constructor(private readonly intents: IntentRunner, private readonly poll: PollActivity, private readonly chatPolls: ChatPolls) {}

  @SubscribeMessage('poll:settings')
  settings(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:settings', b, (v, rt, me) => this.poll.settings(rt, me.id, v));
  }

  @SubscribeMessage('poll:publish')
  publish(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:publish', b, (v, rt, me) => this.poll.publish(rt, me.id, v));
  }

  @SubscribeMessage('poll:answer')
  answer(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:answer', b, (v, rt, me) => this.poll.answer(rt, me.id, v.answer));
  }

  @SubscribeMessage('poll:end')
  end(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:end', b, (_v, rt, me) => this.poll.end(rt, me.id));
  }

  @SubscribeMessage('poll:next')
  next(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:next', b, (_v, rt, me) => this.poll.next(rt, me.id));
  }

  // ---------------------------------------------------------------- a poll continued in the chat
  @SubscribeMessage('poll:chat-answer')
  chatAnswer(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:chat-answer', b, (v, rt, me) => this.chatPolls.answer(rt, me.id, v.id, v.answer));
  }

  @SubscribeMessage('poll:chat-end')
  chatEnd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:chat-end', b, (v, rt, me) => this.chatPolls.end(rt, me.id, v.id));
  }
}
