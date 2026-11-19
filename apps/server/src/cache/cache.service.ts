// Redis: a cache and the sending limits, never required (external-services). Without it (not configured, or down)
// every lookup is a miss and the limits are counted in memory; the server says so at start and in /api/health.
import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/config.module.js';

export type CacheState = 'ok' | 'down' | 'off';

@Injectable()
export class CacheService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger('Redis');
  private redis: Redis | null = null;
  private readonly memory = new Map<string, { n: number; until: number }>();   // limits without Redis

  constructor(@Inject(ENV) private readonly env: Env) {}

  async onModuleInit() {
    if (!this.env.REDIS_URL) { this.log.warn('non configuré : pas de cache, limites en mémoire'); return; }
    this.redis = new Redis(this.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false,
      retryStrategy: n => Math.min(n * 500, 10_000) });
    this.redis.on('error', () => {});   // the state says it; no log flood while it's down
    try { await this.redis.connect(); this.log.log('connecté'); } catch (e) {
      this.log.warn(`injoignable (${(e as Error).message}) : pas de cache, limites en mémoire, nouvel essai en fond`);
    }
  }

  get state(): CacheState { return !this.redis ? 'off' : this.redis.status === 'ready' ? 'ok' : 'down'; }

  async get<T>(key: string): Promise<T | null> {
    if (this.state !== 'ok') return null;
    try { const v = await this.redis!.get(key); return v === null ? null : JSON.parse(v) as T; } catch { return null; }
  }

  async set(key: string, value: unknown, ttlMs: number) {
    if (this.state !== 'ok') return;
    try { await this.redis!.set(key, JSON.stringify(value), 'PX', ttlMs); } catch { /* a cache miss next time */ }
  }

  /** Counts a hit in a window; true while under `count`. Redis when it is there, memory otherwise. */
  async allow(key: string, count: number, perMs: number): Promise<boolean> {
    if (this.state === 'ok') {
      try {
        const n = await this.redis!.incr(`limit:${key}`);
        if (n === 1) await this.redis!.pexpire(`limit:${key}`, perMs);
        return n <= count;
      } catch { /* fall back to memory */ }
    }
    const now = Date.now(), cur = this.memory.get(key);
    if (!cur || cur.until < now) { this.memory.set(key, { n: 1, until: now + perMs }); return true; }
    cur.n++;
    return cur.n <= count;
  }

  async onApplicationShutdown() { this.redis?.disconnect(); }
}
