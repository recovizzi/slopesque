// The Slopesque server: HTTP API and (from jalon 2) the WebSocket. See openspec/changes/plan-slopesque-v1.
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { AppModule } from './app.module.js';
import { SlopesqueIoAdapter } from './realtime/io-adapter.js';
import { isInsecureUrl, originAllowed } from '@slopesque/shared';
import { ENV, type Env } from './config/config.module.js';

const levels = { debug: ['debug', 'log', 'warn', 'error'], info: ['log', 'warn', 'error'], warn: ['warn', 'error'], error: ['error'] } as const;
const app = await NestFactory.create(AppModule, { logger: [...levels[(process.env.LOG_LEVEL as keyof typeof levels) ?? 'info'] ?? levels.info] });
const env = app.get<Env>(ENV);
app.enableShutdownHooks();
app.useWebSocketAdapter(new SlopesqueIoAdapter(app, env.ALLOWED_ORIGINS));
// an upload is the picture itself as the body (15 MB at most), with its ticket in X-Ticket
app.use('/api/media', raw({ type: () => true, limit: '16mb' }));
// the extension's pages (and the dev app on :5173) call the API from another origin
app.enableCors({ origin: (o: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, originAllowed(env.ALLOWED_ORIGINS, o)) });
await app.listen(env.PORT, '0.0.0.0');
new Logger('Slopesque').log(`prêt sur ${env.PUBLIC_URL} (port ${env.PORT}, ${env.NODE_ENV})${isInsecureUrl(env.PUBLIC_URL) ? ' — connexion non chiffrée' : ''}`);
