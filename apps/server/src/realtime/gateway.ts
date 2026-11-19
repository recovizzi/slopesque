// The WebSocket entry (openspec: realtime-sync): the code checked at the handshake, then the intents of
// packages/shared/protocol.ts, each validated (zod) and answered by an acknowledgement { ok, value | error }.
import { Inject, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { handshakeSchema, intents, isInsecureUrl, LIMITS, PROTOCOL_VERSION, type Ack, type Hello, type IntentName, type IntentResults } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { CacheService } from '../cache/cache.service.js';
import { RoomHub, type SocketData } from '../rooms/room-hub.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { MediaService } from '../media/media.service.js';
import { GifService } from '../external/gif.service.js';
import { DB, type Db } from '../db/db.module.js';
import { accounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { UserError } from '../errors.js';

const ipOf = (s: Socket, trust: boolean) => (trust && String(s.handshake.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()) || s.handshake.address;

@WebSocketGateway()
export class Gateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('Temps réel');

  constructor(@Inject(ENV) private readonly env: Env, private readonly accounts: AccountsService, private readonly hub: RoomHub,
    private readonly rooms: RoomsService, private readonly cache: CacheService, private readonly media: MediaService,
    private readonly gifs: GifService, @Inject(DB) private readonly db: Db) {}

  afterInit(io: Server) {
    this.hub.io = io;
    io.use(async (socket, next) => {
      const fail = (reason: string) => next(Object.assign(new Error(reason), { data: { reason } }));
      const h = handshakeSchema.safeParse(socket.handshake.auth);
      if (!h.success) return fail('code');
      if (h.data.protocol !== PROTOCOL_VERSION) return fail('protocol');
      const ip = ipOf(socket, this.env.TRUST_PROXY);
      try {
        const r = await this.accounts.authenticate(h.data.code, ip);
        if ('reason' in r) return fail(r.reason);
        socket.data = { account: r.account, ip, roomId: null } satisfies SocketData;
        next();
      } catch (e) { this.log.error(`connexion refusée : ${(e as Error).message}`); fail('server'); }
    });
  }

  handleConnection(socket: Socket) {
    const data = socket.data as SocketData;
    if (!data?.account) return;
    const hello: Hello = { account: this.accounts.view(data.account), protocol: PROTOCOL_VERSION, serverTime: Date.now(), insecure: isInsecureUrl(this.env.PUBLIC_URL) };
    socket.emit('hello', hello);
  }

  handleDisconnect(socket: Socket) { if ((socket.data as SocketData)?.account) this.hub.leave(socket); }

  /** Validates an intent, runs it, answers { ok, value } or { ok: false, error } (an unexpected error is logged). */
  private async run<N extends IntentName>(name: N, body: unknown, fn: (v: any) => Promise<IntentResults[N]>): Promise<Ack<IntentResults[N]>> {
    const v = intents[name].safeParse(body ?? {});
    if (!v.success) return { ok: false, error: 'Demande invalide.' };
    try { return { ok: true, value: await fn(v.data) }; } catch (e) {
      if (e instanceof UserError) return { ok: false, error: e.message };
      this.log.error(`${name} : ${(e as Error).stack ?? e}`);
      return { ok: false, error: 'Erreur du serveur : réessaie.' };
    }
  }
  private me(s: Socket) { return (s.data as SocketData).account; }
  private async limit(s: Socket, what: 'messages' | 'reactions') {
    const l = LIMITS[what];
    if (!(await this.cache.allow(`${what}:${this.me(s).id}`, l.count, l.perMs))) throw new UserError(what === 'messages' ? 'Doucement : trop de messages.' : 'Doucement : trop de réactions.');
  }

  @SubscribeMessage('room:check')
  check(@MessageBody() b: unknown) { return this.run('room:check', b, async v => ((await this.rooms.byKey(v.key)) ? 'ok' : 'unknown')); }

  @SubscribeMessage('room:join')
  join(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('room:join', b, v => this.hub.join(s, v.key, v.after)); }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('room:leave', b, async () => { this.hub.leave(s); return null; }); }

  @SubscribeMessage('chat:history')
  history(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.run('chat:history', b, async v => { const rt = this.hub.roomOf(s); return this.hub.chat.page(rt.room.id, rt.room.createdAt, v.before); });
  }

  @SubscribeMessage('chat:send')
  send(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.run('chat:send', b, async v => {
      const rt = this.hub.roomOf(s);
      await this.limit(s, 'messages');
      await this.hub.say(rt, this.me(s).id, v.text, v.replyTo ?? null);
      return null;
    });
  }

  @SubscribeMessage('chat:react')
  react(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.run('chat:react', b, async v => {
      const rt = this.hub.roomOf(s);
      await this.limit(s, 'reactions');
      const r = await this.hub.chat.react(rt.room.id, v.id, this.me(s).id, v.emoji);
      if (!r) throw new UserError('Ce message n\'existe plus.');
      this.hub.emit(rt, { type: 'reactions', id: v.id, reactions: r });
      return null;
    });
  }

  @SubscribeMessage('profile:update')
  profile(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.run('profile:update', b, async v => {
      const a = await this.accounts.updateProfile(this.me(s).id, v);
      (s.data as SocketData).account = a;
      await this.hub.profileChanged(a.id);
      return this.accounts.view(a);
    });
  }

  @SubscribeMessage('rooms:save')
  saveRooms(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('rooms:save', b, async v => { await this.accounts.saveRooms(this.me(s).id, v.rooms); return null; }); }

  @SubscribeMessage('account:find')
  find(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('account:find', b, v => this.accounts.find(v.code, (s.data as SocketData).ip)); }

  @SubscribeMessage('account:renew')
  renew(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.run('account:renew', b, async v => {
      await this.accounts.renew(this.me(s).id, v.code);
      this.hub.kickAccount(this.me(s).id, s.id);   // the other devices used the old code
      return null;
    });
  }

  @SubscribeMessage('host:give')
  giveHost(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('host:give', b, async v => { await this.hub.giveHost(s, v.to); return null; }); }

  // ---------------------------------------------------------------- pictures, stickers, emoji, GIF
  @SubscribeMessage('media:ticket')
  ticket(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('media:ticket', b, v => this.media.ticket(this.me(s).id, v.usage)); }

  @SubscribeMessage('chat:media')
  chatMedia(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.run('chat:media', b, async v => { await this.limit(s, 'messages'); await this.hub.sendPicture(s, 'image', await this.hub.picture(v.mediaId, 'chat'), v.replyTo ?? null); return null; });
  }

  @SubscribeMessage('chat:gif')
  chatGif(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('chat:gif', b, async v => { await this.limit(s, 'messages'); await this.hub.sendGif(s, v.gif); return null; }); }

  @SubscribeMessage('sticker:add')
  stickerAdd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('sticker:add', b, async v => { await this.hub.addSticker(s, await this.hub.picture(v.mediaId, 'sticker'), v.send); return null; }); }

  @SubscribeMessage('sticker:send')
  stickerSend(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('sticker:send', b, async v => { await this.limit(s, 'messages'); await this.hub.sendSticker(s, v.id); return null; }); }

  @SubscribeMessage('sticker:remove')
  stickerRemove(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('sticker:remove', b, async v => { await this.hub.removeSticker(s, v.id); return null; }); }

  @SubscribeMessage('emoji:add')
  emojiAdd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('emoji:add', b, async v => { await this.hub.addEmoji(s, v.name, await this.hub.picture(v.mediaId, 'emoji')); return null; }); }

  @SubscribeMessage('photo:set')
  photo(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('photo:set', b, async v => { await this.hub.setPhoto(s, v.mediaId ? await this.hub.picture(v.mediaId, 'photo') : null); return null; }); }

  @SubscribeMessage('gif:search')
  gifSearch(@MessageBody() b: unknown) { return this.run('gif:search', b, v => this.gifs.page(v.q, v.page, v.provider)); }

  @SubscribeMessage('gif:trending')
  gifTrending(@MessageBody() b: unknown) { return this.run('gif:trending', b, v => this.gifs.page(null, v.page, v.provider)); }

  @SubscribeMessage('gif:favorites')
  gifFavorites(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) {
    return this.run('gif:favorites', b, async v => { await this.db.update(accounts).set({ gifFavorites: v.favorites }).where(eq(accounts.id, this.me(s).id)); return null; });
  }

  // ---------------------------------------------------------------- commands, votes, social credit
  @SubscribeMessage('vote:cast')
  castVote(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('vote:cast', b, async v => { await this.hub.vote(s, v.id, v.yes); return null; }); }

  @SubscribeMessage('host:ask')
  askHost(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('host:ask', b, () => this.hub.askHost(s)); }

  @SubscribeMessage('activity:choose')
  chooseActivity(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('activity:choose', b, v => this.hub.chooseActivity(s, v.choice, activityName(v.choice))); }

  @SubscribeMessage('credit:give')
  credit(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('credit:give', b, async v => { await this.hub.giveCredit(s, v.to, v.delta); return null; }); }

  @SubscribeMessage('kick:ask')
  kick(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('kick:ask', b, v => this.hub.askKick(s, v.name)); }

  // ---------------------------------------------------------------- Demi-disque
  @SubscribeMessage('disk:rules')
  diskRules(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('disk:rules', b, v => this.hub.diskRules(s, v)); }
  @SubscribeMessage('disk:join')
  diskJoin(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('disk:join', b, async () => { await this.hub.diskJoin(s); return null; }); }
  @SubscribeMessage('disk:start')
  diskStart(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('disk:start', b, async v => { await this.hub.diskStart(s, v.word, v.target); return null; }); }
  @SubscribeMessage('disk:guess')
  diskGuess(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('disk:guess', b, async v => { await this.hub.diskGuess(s, v.value); return null; }); }
  @SubscribeMessage('disk:next')
  diskNext(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('disk:next', b, async () => { await this.hub.diskNext(s); return null; }); }
  @SubscribeMessage('game:reset')
  gameReset(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('game:reset', b, async () => { await this.hub.gameReset(s); return null; }); }

  // ---------------------------------------------------------------- Sondage, Roulette
  @SubscribeMessage('poll:settings')
  pollSettings(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('poll:settings', b, async v => { await this.hub.pollSettings(s, v); return null; }); }
  @SubscribeMessage('poll:publish')
  pollPublish(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('poll:publish', b, async v => { await this.hub.pollPublish(s, v); return null; }); }
  @SubscribeMessage('poll:answer')
  pollAnswer(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('poll:answer', b, async v => { await this.hub.pollAnswer(s, v.answer); return null; }); }
  @SubscribeMessage('poll:end')
  pollEnd(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('poll:end', b, async () => { await this.hub.pollEnd(s); return null; }); }
  @SubscribeMessage('poll:next')
  pollNext(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('poll:next', b, async () => { await this.hub.pollNext(s); return null; }); }
  @SubscribeMessage('wheel:set')
  wheelSet(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('wheel:set', b, async v => { await this.hub.wheelSet(s, v.items); return null; }); }
  @SubscribeMessage('wheel:spin')
  wheelSpin(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('wheel:spin', b, async () => { await this.hub.wheelSpin(s); return null; }); }
  @SubscribeMessage('wheel:edit')
  wheelEdit(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('wheel:edit', b, async () => { await this.hub.wheelEdit(s); return null; }); }

  // ---------------------------------------------------------------- Cartes
  @SubscribeMessage('web:set')
  setWeb(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('web:set', b, async v => { await this.hub.setWeb(s, v.integration, v.url); return null; }); }
  @SubscribeMessage('palmares:get')
  palmares(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('palmares:get', b, () => this.hub.palmares(s)); }
  @SubscribeMessage('cards:deal')
  cardsDeal(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('cards:deal', b, async () => { await this.hub.cardsDeal(s); return null; }); }
  @SubscribeMessage('cards:play')
  cardsPlay(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('cards:play', b, async v => { await this.hub.cardsMove(s, { play: v.cards }); return null; }); }
  @SubscribeMessage('cards:pass')
  cardsPass(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('cards:pass', b, async () => { await this.hub.cardsMove(s, { pass: true }); return null; }); }
  @SubscribeMessage('tarot:bid')
  tarotBid(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('tarot:bid', b, async v => { await this.hub.tarotDo(s, { bid: v.bid }); return null; }); }
  @SubscribeMessage('tarot:call')
  tarotCall(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('tarot:call', b, async v => { await this.hub.tarotDo(s, { call: v.card }); return null; }); }
  @SubscribeMessage('tarot:discard')
  tarotDiscard(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('tarot:discard', b, async v => { await this.hub.tarotDo(s, { discard: v.cards }); return null; }); }
  @SubscribeMessage('tarot:tricks')
  tarotTricks(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('tarot:tricks', b, async v => { await this.hub.tarotTricks(s, v.show); return null; }); }
  @SubscribeMessage('cards:players')
  cardsPlayers(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('cards:players', b, async v => { await this.hub.cardsPlayers(s, v.game, v.players); return null; }); }
  @SubscribeMessage('table:join')
  tableJoin(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('table:join', b, () => this.hub.tableJoin(s)); }
  @SubscribeMessage('table:leave')
  tableLeave(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('table:leave', b, async () => { await this.hub.tableLeave(s); return null; }); }
}

/** An activity and its format, in words (« Tarot à 5 », « Demi-disque · Amphithéâtre »). */
function activityName(c: { activity: string; mode?: string; cardGame?: string; tarotPlayers?: number }) {
  const names: Record<string, string> = { chat: 'Chat', disk: 'Demi-disque', poll: 'Sondage', wheel: 'Roulette', cards: 'Cartes', lowtide: 'Low Tide' };
  if (c.activity === 'disk' && c.mode) return `Demi-disque · ${c.mode === 'amphi' ? 'Amphithéâtre' : 'Rayon libre'}`;
  if (c.activity === 'cards' && c.cardGame) return c.cardGame === 'tarot' ? (c.tarotPlayers ? `Tarot à ${c.tarotPlayers}` : 'Tarot') : ({ tdc: 'Trou du cul', holdem: 'Texas Hold\'em', coinche: 'Coinche' } as Record<string, string>)[c.cardGame] ?? 'Cartes';
  return names[c.activity] ?? c.activity;
}
