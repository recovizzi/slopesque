// GET /api/health: the state of each service (external-services), the storage room, the versions.
import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { isInsecureUrl, PROTOCOL_VERSION } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { DB, type Db } from '../db/db.module.js';
import { CacheService } from '../cache/cache.service.js';
import { StorageService } from '../storage/storage.service.js';

@Controller('api/health')
export class HealthController {
  constructor(@Inject(ENV) private readonly env: Env, @Inject(DB) private readonly db: Db,
    private readonly cache: CacheService, private readonly storage: StorageService) {}

  @Get()
  async health() {
    let postgres: 'ok' | 'down' = 'ok';
    try { await this.db.execute(sql`select 1`); } catch { postgres = 'down'; }
    const usage = postgres === 'ok' ? await this.storage.usage().catch(() => null) : null;
    const gifs = this.env.KLIPY_API_KEY || this.env.GIPHY_API_KEY ? 'configured' : 'off';
    return {
      status: postgres === 'ok' ? 'ok' : 'down',
      protocol: PROTOCOL_VERSION,
      insecure: isInsecureUrl(this.env.PUBLIC_URL),
      services: { postgres, redis: this.cache.state, storage: await this.storage.check(), gifs },
      storage: usage,
      backups: 'none',
    };
  }
}
