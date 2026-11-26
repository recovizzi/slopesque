// The rooms' intents (openspec: game-session, chat-activity): check a key, join, leave; the host, /hote, /activity,
// the votes of the chat, /credit-social, « Réinitialiser la partie ».
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../realtime/intent-runner.js';
import { RoomHub } from './room-hub.service.js';
import { RoomsService } from './rooms.service.js';
import { Votes } from './votes.service.js';

@WebSocketGateway()
export class RoomsGateway {
  constructor(private readonly intents: IntentRunner, private readonly hub: RoomHub, private readonly store: RoomsService,
    private readonly votes: Votes) {}

  @SubscribeMessage('room:check')
  check(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('room:check', b, async v => {
      await this.intents.limit(s, 'joins');
      return (await this.store.byKey(v.key)) ? 'ok' : 'unknown';
    });
  }

  @SubscribeMessage('room:join')
  join(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('room:join', b, async v => {
      await this.intents.limit(s, 'joins');
      return this.hub.join(s, v.key, v.after);
    });
  }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('room:leave', b, async () => this.hub.leave(s));
  }

  @SubscribeMessage('host:give')
  giveHost(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'host:give', b, (v, rt, me) => this.hub.giveHost(rt, me.id, v.to));
  }

  @SubscribeMessage('host:ask')
  askHost(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'host:ask', b, (_v, rt, me) => this.hub.askHost(rt, me));
  }

  @SubscribeMessage('activity:choose')
  chooseActivity(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'activity:choose', b, (v, rt, me) => this.hub.chooseActivity(rt, me, v.choice, activityName(v.choice)));
  }

  @SubscribeMessage('vote:cast')
  castVote(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'vote:cast', b, (v, rt, me) => this.votes.cast(rt, me.id, v.id, v.yes));
  }

  @SubscribeMessage('credit:give')
  credit(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'credit:give', b, (v, rt, me) => this.hub.giveCredit(rt, me.id, v.to, v.delta));
  }

  @SubscribeMessage('game:reset')
  gameReset(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'game:reset', b, (_v, rt, me) => this.hub.gameReset(rt, me.id));
  }
}

/** An activity and its format, in words (« Tarot à 5 », « Demi-disque · Amphithéâtre »). */
function activityName(c: { activity: string; mode?: string; cardGame?: string; tarotPlayers?: number }) {
  const names: Record<string, string> = { chat: 'Chat', disk: 'Demi-disque', poll: 'Sondage', wheel: 'Roulette', cards: 'Cartes',
    lowtide: 'Low Tide' };
  if (c.activity === 'disk' && c.mode) return `Demi-disque · ${c.mode === 'amphi' ? 'Amphithéâtre' : 'Rayon libre'}`;
  if (c.activity === 'cards' && c.cardGame) {
    return c.cardGame === 'tarot' ? (c.tarotPlayers ? `Tarot à ${c.tarotPlayers}` : 'Tarot')
      : ({ tdc: 'Trou du cul', holdem: 'Texas Hold\'em', coinche: 'Coinche' } as Record<string, string>)[c.cardGame] ?? 'Cartes';
  }
  return names[c.activity] ?? c.activity;
}
