// The intents of packages/shared/protocol.ts not yet in their own module's gateway (transitional), run by the
// IntentRunner (validated, acknowledged { ok, value | error }).
import type { Coinche } from '@slopesque/engines';
import { Inject } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { AccountsService } from '../accounts/accounts.service.js';
import { RoomHub, type SocketData } from '../rooms/room-hub.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { RoomRegistry } from '../rooms/room-registry.js';
import { Votes } from '../rooms/votes.service.js';
import { MediaService } from '../media/media.service.js';
import { GifService } from '../external/gif.service.js';
import { DB, type Db } from '../db/db.module.js';
import { accounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { UserError } from '../errors.js';
import { IntentRunner } from './intent-runner.js';

@WebSocketGateway()
export class Gateway {
  constructor(private readonly intents: IntentRunner, private readonly accounts: AccountsService, private readonly hub: RoomHub,
    private readonly rooms: RoomRegistry, private readonly votes: Votes, private readonly roomStore: RoomsService,
    private readonly media: MediaService, private readonly gifs: GifService, @Inject(DB) private readonly db: Db) {}

  @SubscribeMessage('room:check')
  check(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('room:check', b, async v => { await this.intents.limit(s, 'joins'); return (await this.roomStore.byKey(v.key)) ? 'ok' : 'unknown'; }); }

  @SubscribeMessage('room:join')
  join(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('room:join', b, async v => { await this.intents.limit(s, 'joins'); return this.hub.join(s, v.key, v.after); }); }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('room:leave', b, async () => { this.hub.leave(s); return null; }); }

  @SubscribeMessage('chat:history')
  history(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('chat:history', b, async v => { const rt = this.rooms.roomOf(s); return this.hub.chat.page(rt.room.id, rt.room.createdAt, v.before); });
  }

  @SubscribeMessage('chat:send')
  send(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('chat:send', b, async v => {
      const rt = this.rooms.roomOf(s);
      await this.intents.limit(s, 'messages');
      await this.hub.post(rt, this.intents.me(s).id, v.text, v.replyTo ?? null);
      return null;
    });
  }

  @SubscribeMessage('chat:react')
  react(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('chat:react', b, async v => {
      const rt = this.rooms.roomOf(s);
      await this.intents.limit(s, 'reactions');
      const r = await this.hub.chat.react(rt.room.id, v.id, this.intents.me(s).id, v.emoji);
      if (!r) throw new UserError('Ce message n\'existe plus.');
      this.rooms.emit(rt, { type: 'reactions', id: v.id, reactions: r });
      return null;
    });
  }

  @SubscribeMessage('profile:update')
  profile(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('profile:update', b, async v => {
      const a = await this.accounts.updateProfile(this.intents.me(s).id, v);
      (s.data as SocketData).account = a;
      await this.rooms.profileChanged(a.id);
      return this.accounts.view(a);
    });
  }

  @SubscribeMessage('rooms:save')
  saveRooms(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('rooms:save', b, async v => { await this.accounts.saveRooms(this.intents.me(s).id, v.rooms); return null; }); }

  @SubscribeMessage('account:find')
  find(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('account:find', b, v => this.accounts.find(v.code, (s.data as SocketData).ip, v.resume)); }

  @SubscribeMessage('account:renew')
  renew(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('account:renew', b, async v => {
      await this.accounts.renew(this.intents.me(s).id, v.code);
      this.rooms.kickAccount(this.intents.me(s).id, s.id);   // the other devices used the old code
      return null;
    });
  }

  @SubscribeMessage('host:give')
  giveHost(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('host:give', b, async v => { await this.hub.giveHost(s, v.to); return null; }); }

  // ---------------------------------------------------------------- pictures, stickers, emoji, GIF
  @SubscribeMessage('media:ticket')
  ticket(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('media:ticket', b, v => this.media.ticket(this.intents.me(s).id, v.usage)); }

  @SubscribeMessage('chat:media')
  chatMedia(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('chat:media', b, async v => { await this.intents.limit(s, 'messages'); await this.hub.sendPicture(s, 'image', await this.hub.picture(v.mediaId, 'chat'), v.replyTo ?? null, v.text ?? ''); return null; });
  }

  @SubscribeMessage('chat:gif')
  chatGif(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('chat:gif', b, async v => { await this.intents.limit(s, 'messages'); await this.hub.sendGif(s, v.gif, v.replyTo ?? null, v.text ?? ''); return null; }); }

  @SubscribeMessage('sticker:add')
  stickerAdd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('sticker:add', b, async v => { return this.hub.addSticker(s, await this.hub.picture(v.mediaId, 'sticker'), v.send); }); }

  @SubscribeMessage('sticker:send')
  stickerSend(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('sticker:send', b, async v => { await this.intents.limit(s, 'messages'); await this.hub.sendSticker(s, v.id, v.replyTo ?? null, v.text ?? ''); return null; }); }

  @SubscribeMessage('sticker:remove')
  stickerRemove(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('sticker:remove', b, async v => { await this.hub.removeSticker(s, v.id); return null; }); }

  @SubscribeMessage('emoji:add')
  emojiAdd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('emoji:add', b, async v => { await this.hub.addEmoji(s, v.name, await this.hub.picture(v.mediaId, 'emoji')); return null; }); }

  @SubscribeMessage('photo:set')
  photo(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('photo:set', b, async v => { await this.hub.setPhoto(s, v.mediaId ? await this.hub.picture(v.mediaId, 'photo') : null); return null; }); }

  @SubscribeMessage('gif:search')
  gifSearch(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('gif:search', b, async v => { await this.intents.limit(s, 'gifs'); return this.gifs.page(v.q, v.page, v.provider); }); }

  @SubscribeMessage('gif:trending')
  gifTrending(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('gif:trending', b, async v => { await this.intents.limit(s, 'gifs'); return this.gifs.page(null, v.page, v.provider); }); }

  @SubscribeMessage('gif:favorites')
  gifFavorites(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.intents.run('gif:favorites', b, async v => { await this.db.update(accounts).set({ gifFavorites: v.favorites }).where(eq(accounts.id, this.intents.me(s).id)); return null; });
  }

  // ---------------------------------------------------------------- commands, votes, social credit
  @SubscribeMessage('vote:cast')
  castVote(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('vote:cast', b, async v => { await this.votes.cast(this.rooms.roomOf(s), this.intents.me(s).id, v.id, v.yes); return null; }); }

  @SubscribeMessage('host:ask')
  askHost(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('host:ask', b, () => this.hub.askHost(s)); }

  @SubscribeMessage('activity:choose')
  chooseActivity(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('activity:choose', b, v => this.hub.chooseActivity(s, v.choice, activityName(v.choice))); }

  @SubscribeMessage('credit:give')
  credit(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('credit:give', b, async v => { await this.hub.giveCredit(s, v.to, v.delta); return null; }); }

  @SubscribeMessage('kick:ask')
  kick(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('kick:ask', b, v => this.hub.askKick(s, v.name)); }

  // ---------------------------------------------------------------- Demi-disque
  @SubscribeMessage('game:reset')
  gameReset(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('game:reset', b, async () => { await this.hub.gameReset(s); return null; }); }

  // ---------------------------------------------------------------- Sondage, Roulette
  @SubscribeMessage('poll:settings')
  pollSettings(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('poll:settings', b, async v => { await this.hub.pollSettings(s, v); return null; }); }
  @SubscribeMessage('poll:publish')
  pollPublish(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('poll:publish', b, async v => { await this.hub.pollPublish(s, v); return null; }); }
  @SubscribeMessage('poll:answer')
  pollAnswer(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('poll:answer', b, async v => { await this.hub.pollAnswer(s, v.answer); return null; }); }
  @SubscribeMessage('poll:end')
  pollEnd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('poll:end', b, async () => { await this.hub.pollEnd(s); return null; }); }
  @SubscribeMessage('poll:next')
  pollNext(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('poll:next', b, async () => { await this.hub.pollNext(s); return null; }); }
  @SubscribeMessage('wheel:set')
  wheelSet(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('wheel:set', b, async v => { await this.hub.wheelSet(s, v.items); return null; }); }
  @SubscribeMessage('wheel:spin')
  wheelSpin(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('wheel:spin', b, async () => { await this.hub.wheelSpin(s); return null; }); }
  @SubscribeMessage('wheel:edit')
  wheelEdit(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('wheel:edit', b, async () => { await this.hub.wheelEdit(s); return null; }); }

  // ---------------------------------------------------------------- Cartes
  @SubscribeMessage('web:set')
  setWeb(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('web:set', b, async v => { await this.hub.setWeb(s, v.integration, v.url); return null; }); }
  @SubscribeMessage('cards:deal')
  cardsDeal(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('cards:deal', b, async () => { await this.hub.cardsDeal(s); return null; }); }
  @SubscribeMessage('cards:play')
  cardsPlay(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('cards:play', b, async v => { await this.hub.cardsMove(s, { play: v.cards }); return null; }); }
  @SubscribeMessage('cards:pass')
  cardsPass(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('cards:pass', b, async () => { await this.hub.cardsMove(s, { pass: true }); return null; }); }
  @SubscribeMessage('cards:bots')
  cardsBots(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('cards:bots', b, async v => { await this.hub.cardsBots(s, v.level); return null; }); }
  @SubscribeMessage('holdem:act')
  holdemAct(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('holdem:act', b, async v => { await this.hub.holdemDo(s, v); return null; }); }
  @SubscribeMessage('holdem:rules')
  holdemRules(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('holdem:rules', b, async v => { await this.hub.holdemSetRules(s, v); return null; }); }
  @SubscribeMessage('poll:chat-answer')
  pollChatAnswer(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('poll:chat-answer', b, async v => { await this.hub.chatPollAnswer(s, v.id, v.answer); return null; }); }
  @SubscribeMessage('poll:chat-end')
  pollChatEnd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('poll:chat-end', b, async v => { await this.hub.chatPollEnd(s, v.id); return null; }); }
  @SubscribeMessage('coinche:say')
  coincheSay(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('coinche:say', b, async v => { await this.hub.coincheDo(s, { say: (v.kind === 'bid' ? { kind: 'bid', value: v.value ?? 0, suit: v.suit ?? 'S' } : { kind: v.kind }) as Coinche.Say }); return null; }); }
  @SubscribeMessage('cards:deal-mode')
  cardsDealMode(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('cards:deal-mode', b, async v => { await this.hub.cardsDealMode(s, v.mode); return null; }); }
  @SubscribeMessage('coinche:next')
  coincheNext(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('coinche:next', b, async () => { await this.hub.coincheReady(s); return null; }); }
  @SubscribeMessage('coinche:target')
  coincheTarget(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('coinche:target', b, async v => { await this.hub.coincheSetTarget(s, v.target); return null; }); }
  @SubscribeMessage('holdem:end')
  holdemEnd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('holdem:end', b, async () => { await this.hub.holdemEnd(s); return null; }); }
  @SubscribeMessage('tarot:handful')
  tarotHandful(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:handful', b, async v => { await this.hub.tarotHandful(s, v.level); return null; }); }
  @SubscribeMessage('tarot:chelem')
  tarotChelem(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:chelem', b, async () => { await this.hub.tarotChelem(s); return null; }); }

  @SubscribeMessage('tarot:bid')
  tarotBid(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:bid', b, async v => { await this.hub.tarotDo(s, { bid: v.bid }); return null; }); }
  @SubscribeMessage('tarot:call')
  tarotCall(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:call', b, async v => { await this.hub.tarotDo(s, { call: v.card }); return null; }); }
  @SubscribeMessage('tarot:discard')
  tarotDiscard(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:discard', b, async v => { await this.hub.tarotDo(s, { discard: v.cards }); return null; }); }
  @SubscribeMessage('effect:play')
  effectPlay(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('effect:play', b, async v => { await this.intents.limit(s, 'effects'); await this.hub.playEffect(s, v); return null; }); }

  @SubscribeMessage('tarot:art')
  tarotArt(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:art', b, async v => { await this.hub.tarotArt(s, v.card, v.mediaId); return null; }); }

  @SubscribeMessage('tarot:art-reset')
  tarotArtReset(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:art-reset', b, async () => { await this.hub.tarotArtReset(s); return null; }); }

  @SubscribeMessage('tarot:tricks')
  tarotTricks(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('tarot:tricks', b, async v => { await this.hub.tarotTricks(s, v.show); return null; }); }
  @SubscribeMessage('cards:players')
  cardsPlayers(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('cards:players', b, async v => { await this.hub.cardsPlayers(s, v.game, v.players); return null; }); }
  @SubscribeMessage('table:join')
  tableJoin(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('table:join', b, () => this.hub.tableJoin(s)); }
  @SubscribeMessage('table:leave')
  tableLeave(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.intents.run('table:leave', b, async () => { await this.hub.tableLeave(s); return null; }); }
}

/** An activity and its format, in words (« Tarot à 5 », « Demi-disque · Amphithéâtre »). */
function activityName(c: { activity: string; mode?: string; cardGame?: string; tarotPlayers?: number }) {
  const names: Record<string, string> = { chat: 'Chat', disk: 'Demi-disque', poll: 'Sondage', wheel: 'Roulette', cards: 'Cartes', lowtide: 'Low Tide' };
  if (c.activity === 'disk' && c.mode) return `Demi-disque · ${c.mode === 'amphi' ? 'Amphithéâtre' : 'Rayon libre'}`;
  if (c.activity === 'cards' && c.cardGame) return c.cardGame === 'tarot' ? (c.tarotPlayers ? `Tarot à ${c.tarotPlayers}` : 'Tarot') : ({ tdc: 'Trou du cul', holdem: 'Texas Hold\'em', coinche: 'Coinche' } as Record<string, string>)[c.cardGame] ?? 'Cartes';
  return names[c.activity] ?? c.activity;
}
