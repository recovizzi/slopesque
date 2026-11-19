import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { CacheService } from './cache/cache.service.js';
import { StorageService } from './storage/storage.service.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [ConfigModule, DbModule],
  providers: [CacheService, StorageService],
  controllers: [HealthController],
  exports: [CacheService, StorageService],
})
export class AppModule {}
