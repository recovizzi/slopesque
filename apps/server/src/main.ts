// The Slopesque server: HTTP API and (from jalon 2) the WebSocket. See openspec/changes/plan-slopesque-v1.
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { raw, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module.js';
import { MediaService } from './media/media.service.js';
import { SlopesqueIoAdapter } from './realtime/io-adapter.js';
import { isInsecureUrl, originAllowed } from '@slopesque/shared';
import { ENV, type Env } from './config/config.module.js';

const levels = { debug: ['debug', 'log', 'warn', 'error'], info: ['log', 'warn', 'error'], warn: ['warn', 'error'], error: ['error'] } as const;
const app = await NestFactory.create(AppModule, { logger: [...levels[(process.env.LOG_LEVEL as keyof typeof levels) ?? 'info'] ?? levels.info] });
const env = app.get<Env>(ENV);
app.enableShutdownHooks();
app.useWebSocketAdapter(new SlopesqueIoAdapter(app, env.ALLOWED_ORIGINS));
// an upload is the picture itself as the body (any size: the server compresses it), with its ticket in X-Ticket — the
// body is read only for a ticket that exists (a request without one never makes the server hold 200 MB)
const media = app.get(MediaService);
app.use('/api/media', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && !media.hasTicket(String(req.headers['x-ticket'] ?? ''))) { res.status(403).json({ ok: false, error: 'Envoi expiré : réessaie.' }); return; }
  next();
});
app.use('/api/media', raw({ type: () => true, limit: '200mb' }));
// the extension's pages (and the dev app on :5173) call the API from another origin
app.enableCors({ origin: (o: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, originAllowed(env.ALLOWED_ORIGINS, o)) });
await app.listen(env.PORT, '0.0.0.0');
new Logger('Slopesque').log(`prêt sur ${env.PUBLIC_URL} (port ${env.PORT}, ${env.NODE_ENV})${isInsecureUrl(env.PUBLIC_URL) ? ' — connexion non chiffrée' : ''}`);
