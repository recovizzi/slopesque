// Socket.IO with the allowed origins (realtime-sync): the extension's pages (chrome-extension://<id> listed in
// ALLOWED_ORIGINS; Firefox gives each install its own moz-extension:// origin, so those pass and the code decides).
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions, Socket } from 'socket.io';

import { originAllowed } from '@slopesque/shared';

/** Each module's gateway listens to the connections, and to each socket's disconnection (refactor-architecture):
 *  more listeners than Node's default 10, which it would report as a leak. */
const LISTENERS = 50;

export class SlopesqueIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly allowed: string[]) { super(app); }
  override createIOServer(port: number, options?: Partial<ServerOptions>) {
    const server: Server = super.createIOServer(port, {
      ...options,
      serveClient: false,
      maxHttpBufferSize: 64 * 1024,   // intents are small; pictures go over HTTP
      cors: { origin: (o: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, originAllowed(this.allowed, o)) },
    } as ServerOptions);
    server.sockets.setMaxListeners(LISTENERS);
    server.on('connection', (s: Socket) => s.setMaxListeners(LISTENERS));   // before the gateways' listeners
    return server;
  }
}
