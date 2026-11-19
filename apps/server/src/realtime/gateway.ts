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
import { UserError } from '../errors.js';

const ipOf = (s: Socket, trust: boolean) => (trust && String(s.handshake.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()) || s.handshake.address;

@WebSocketGateway()
export class Gateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('Temps réel');

  constructor(@Inject(ENV) private readonly env: Env, private readonly accounts: AccountsService, private readonly hub: RoomHub,
    private readonly rooms: RoomsService, private readonly cache: CacheService) {}

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
  join(@ConnectedSocket() s: Socket, @MessageBody() b: unknown) { return this.run('room:join', b, v => this.hub.join(s, v.key)); }

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
}
