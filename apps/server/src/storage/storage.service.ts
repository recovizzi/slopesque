// RustFS through its S3 API: pictures (external-services). Not required: without it, sending a picture answers
// « Images indisponibles pour le moment » and the rest works. The two buckets are made at start if missing.
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { sql } from 'drizzle-orm';
import { STORAGE } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { DB, type Db } from '../db/db.module.js';

export type StorageState = 'ok' | 'down' | 'off';
export interface Usage { usedBytes: number; quotaBytes: number; ratio: number; level: 'ok' | 'warn' | 'full' }

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger('RustFS');
  readonly s3: S3Client | null;
  private reachable = false;

  constructor(@Inject(ENV) private readonly env: Env, @Inject(DB) private readonly db: Db) {
    this.s3 = env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY
      ? new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true,
        credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }, maxAttempts: 2 }) // gitleaks:allow (read from the environment)
      : null;
  }

  get buckets() { return { durable: this.env.S3_BUCKET_DURABLE, chat: this.env.S3_BUCKET_CHAT }; }

  async onModuleInit() {
    if (!this.s3) { this.log.warn('non configuré : images indisponibles'); return; }
    await this.check();
    if (!this.reachable) this.log.warn('injoignable : images indisponibles, nouvel essai à chaque contrôle de santé');
    // the place taken: a warning in the log from 90 % (the admin cleans up before the refusals at 98 %), every hour
    setTimeout(() => void this.watch(), 30_000).unref();
    setInterval(() => void this.watch(), 60 * 60_000).unref();
  }

  private async watch() {
    try {
      const u = await this.usage(), pct = `${(u.ratio * 100).toFixed(1)} %`;
      if (u.level === 'full') this.log.error(`place pleine (${pct}) : les nouvelles images sont refusées. Fais du ménage : admin media:stats, puis media:delete ou purge:run (voir ADMIN.md).`);
      else if (u.level === 'warn') this.log.warn(`place presque pleine (${pct}) : fais du ménage avant le refus des images à 98 % (admin media:stats, voir ADMIN.md).`);
    } catch { /* RustFS down: said by its own checks */ }
  }

  /** Can we reach RustFS (and are the buckets there)? Makes them when missing. */
  async check(): Promise<StorageState> {
    if (!this.s3) return 'off';
    try {
      for (const b of Object.values(this.buckets)) {
        try { await this.s3.send(new HeadBucketCommand({ Bucket: b })); } catch (e) {
          if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw e;
          await this.s3.send(new CreateBucketCommand({ Bucket: b }));
          this.log.log(`compartiment ${b} créé`);
        }
      }
      if (!this.reachable) this.log.log('connecté');
      this.reachable = true;
    } catch { this.reachable = false; }
    return this.reachable ? 'ok' : 'down';
  }

  /** Room taken by Postgres and the stored pictures, against STORAGE_QUOTA_GB (data-retention, Place disponible). */
  async usage(): Promise<Usage> {
    const [row] = await this.db.execute<{ db: string; files: string | null }>(
      sql`select pg_database_size(current_database())::text as db, (select sum(bytes)::text from media) as files`);
    const usedBytes = Number(row?.db ?? 0) + Number(row?.files ?? 0), quotaBytes = this.env.STORAGE_QUOTA_GB * 1024 ** 3;
    const ratio = usedBytes / quotaBytes;
    return { usedBytes, quotaBytes, ratio, level: ratio >= STORAGE.refuseRatio ? 'full' : ratio >= STORAGE.warnRatio ? 'warn' : 'ok' };
  }
}
