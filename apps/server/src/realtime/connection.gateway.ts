// The WebSocket entry (openspec: realtime-sync): the code checked at the handshake, « hello » once accepted, the room
// left at the disconnection. The intents are each module's gateway, on the same server (Nest shares it between the
// gateways of one port and path), run by the IntentRunner.
import { readFileSync } from 'node:fs';
import { Inject, Logger } from '@nestjs/common';
import { type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { handshakeSchema, isInsecureUrl, PROTOCOL_VERSION, versionBelow, type Hello, type ServerVersions } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { RoomHub } from '../rooms/room-hub.service.js';
import { RoomRegistry } from '../rooms/room-registry.js';
import type { SocketData } from '../rooms/room-rt.js';

const ipOf = (s: Socket, trust: boolean) =>
  (trust && String(s.handshake.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim()) || s.handshake.address;

/** This server's package.json (read once): its version, and the oldest extension it accepts (pnpm release --min-extension). */
const PKG = (() => {
  type Pkg = { version: string; slopesque?: { minExtension?: string } };
  try { return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as Pkg; }
  catch { return { version: '?' } as Pkg; }
})();
const SERVER_VERSION = PKG.version;

@WebSocketGateway()
export class ConnectionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('Temps réel');

  constructor(@Inject(ENV) private readonly env: Env, private readonly accounts: AccountsService, private readonly hub: RoomHub,
    private readonly rooms: RoomRegistry) {}

  /** The server's version (its package), the oldest extension it accepts, where to get the latest. */
  versions(): ServerVersions {
    return { version: SERVER_VERSION, minExtension: this.env.MIN_EXTENSION_VERSION ?? PKG.slopesque?.minExtension ?? '0.1.0',
      download: this.env.EXTENSION_DOWNLOAD_URL };
  }

  afterInit(io: Server) {
    this.rooms.io = io;
    io.use(async (socket, next) => {
      const fail = (reason: string, more: object = {}) => next(Object.assign(new Error(reason), { data: { reason, ...more } }));
      const h = handshakeSchema.safeParse(socket.handshake.auth);
      if (!h.success) return fail('code');
      const versions = this.versions();
      // an extension older than the server accepts (or one that says no version: before versioning) is sent to update
      if (!h.data.version || versionBelow(h.data.version, versions.minExtension)) {
        return fail('outdated', { ...versions, yours: h.data.version ?? null });
      }
      if (h.data.protocol !== PROTOCOL_VERSION) return fail('protocol', versions);
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
    const hello: Hello = { account: this.accounts.view(data.account), protocol: PROTOCOL_VERSION, serverTime: Date.now(),
      insecure: isInsecureUrl(this.env.PUBLIC_URL), server: this.versions() };
    socket.emit('hello', hello);
  }

  handleDisconnect(socket: Socket) { if ((socket.data as SocketData)?.account) this.hub.leave(socket); }
}
