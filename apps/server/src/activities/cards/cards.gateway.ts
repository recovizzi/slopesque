// The card table's intents, whatever the game: deal, play or pass, take a seat or leave it, /kick, the host's settings.
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { IntentRunner } from '../../realtime/intent-runner.js';
import { CardsActivity } from './cards.activity.js';
import { CardsSettings } from './settings.service.js';

@WebSocketGateway()
export class CardsGateway {
  constructor(private readonly intents: IntentRunner, private readonly cards: CardsActivity, private readonly settings: CardsSettings) {}

  @SubscribeMessage('cards:deal')
  deal(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'cards:deal', b, (_v, rt, me) => this.cards.deal(rt, me.id));
  }

  @SubscribeMessage('cards:play')
  play(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'cards:play', b, (v, rt, me) => this.cards.move(rt, me.id, { play: v.cards }));
  }

  @SubscribeMessage('cards:pass')
  pass(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'cards:pass', b, (_v, rt, me) => this.cards.move(rt, me.id, { pass: true }));
  }

  @SubscribeMessage('table:join')
  join(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'table:join', b, (_v, rt, me) => this.cards.join(rt, me));
  }

  @SubscribeMessage('table:leave')
  leave(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'table:leave', b, (_v, rt, me) => this.cards.leave(rt, me.id));
  }

  @SubscribeMessage('kick:ask')
  kick(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'kick:ask', b, (v, rt, me) => this.cards.askKick(rt, me.id, v.name));
  }

  // ---------------------------------------------------------------- the host's settings
  @SubscribeMessage('cards:bots')
  bots(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'cards:bots', b, (v, rt, me) => this.settings.bots(rt, me.id, v.level));
  }

  @SubscribeMessage('cards:players')
  players(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'cards:players', b, (v, rt, me) => this.settings.players(rt, me.id, v.game, v.players));
  }

  @SubscribeMessage('cards:deal-mode')
  dealMode(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'cards:deal-mode', b, (v, rt, me) => this.settings.dealMode(rt, me.id, v.mode));
  }

  @SubscribeMessage('tarot:tricks')
  tricks(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:tricks', b, (v, rt, me) => this.settings.tricks(rt, me.id, v.show));
  }

  @SubscribeMessage('tarot:art')
  art(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:art', b, (v, rt, me) => this.settings.art(rt, me.id, v.card, v.mediaId));
  }

  @SubscribeMessage('tarot:art-reset')
  artReset(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.inRoom(s, 'tarot:art-reset', b, (_v, rt, me) => this.settings.artReset(rt, me.id));
  }
}
