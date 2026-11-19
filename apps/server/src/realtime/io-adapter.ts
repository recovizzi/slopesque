// Socket.IO with the allowed origins (realtime-sync): the extension's pages (chrome-extension://<id> listed in
// ALLOWED_ORIGINS; Firefox gives each install its own moz-extension:// origin, so those pass and the code decides).
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

export const originAllowed = (allowed: string[], origin: string | undefined) =>
  !allowed.length || !origin || allowed.includes(origin) || origin.startsWith('moz-extension://');

export class SlopesqueIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly allowed: string[]) { super(app); }
  override createIOServer(port: number, options?: Partial<ServerOptions>) {
    return super.createIOServer(port, {
      ...options,
      serveClient: false,
      maxHttpBufferSize: 64 * 1024,   // intents are small; pictures go over HTTP
      cors: { origin: (o: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, originAllowed(this.allowed, o)) },
    } as ServerOptions);
  }
}
