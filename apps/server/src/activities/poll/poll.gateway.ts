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
    return this.intents.inRoom(s, 'poll:settings', b, async (v, rt, me) => { await this.poll.settings(rt, me.id, v); return null; });
  }

  @SubscribeMessage('poll:publish')
  publish(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:publish', b, async (v, rt, me) => { await this.poll.publish(rt, me.id, v); return null; });
  }

  @SubscribeMessage('poll:answer')
  answer(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:answer', b, async (v, rt, me) => { await this.poll.answer(rt, me.id, v.answer); return null; });
  }

  @SubscribeMessage('poll:end')
  end(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:end', b, async (_v, rt, me) => { await this.poll.end(rt, me.id); return null; });
  }

  @SubscribeMessage('poll:next')
  next(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:next', b, async (_v, rt, me) => { await this.poll.next(rt, me.id); return null; });
  }

  // ---------------------------------------------------------------- a poll continued in the chat
  @SubscribeMessage('poll:chat-answer')
  chatAnswer(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:chat-answer', b, async (v, rt, me) => { await this.chatPolls.answer(rt, me.id, v.id, v.answer); return null; });
  }

  @SubscribeMessage('poll:chat-end')
  chatEnd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'poll:chat-end', b, async (v, rt, me) => { await this.chatPolls.end(rt, me.id, v.id); return null; });
  }
}
