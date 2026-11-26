// Pictures (openspec: media-storage, data-retention): converted by usage (sharp: rotated by EXIF, metadata dropped,
// WebP, animation kept), stored once per (usage, SHA-256 of the file received) in RustFS, served by /media/:id.
// Chat images and link previews live 7 days after their last sending; the rest lives while something uses it, and
// is deleted at once (the hourly sweep catches what is left). Nothing is kept for recovery: no backup.
import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, inArray, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { HOUR, LIMITS, RETENTION } from '@slopesque/shared';
import { ENV, type Env } from '../config/config.module.js';
import { DB, type Db } from '../db/db.module.js';
import { media } from '../db/schema.js';
import { StorageService } from '../storage/storage.service.js';
import { CacheService } from '../cache/cache.service.js';
import { UserError } from '../errors.js';

export type Usage = 'emoji' | 'sticker' | 'photo' | 'chat' | 'poll' | 'trump' | 'preview';
/** By usage (media-storage, Formats d'image): the longest side in pixels (the photo: a square cut in the middle), the
 *  starting quality, and the weight aimed at — small things light, a chat image large with a lighter compression. Any
 *  file is accepted: the server converts it until it fits (quality first, then the size), and keeps only that. */
const FORMATS: Record<Usage, { side: number; square?: boolean; quality: number; maxBytes: number }> = {
  emoji: { side: 128, quality: 80, maxBytes: 24_000 },
  photo: { side: 256, square: true, quality: 78, maxBytes: 32_000 },
  sticker: { side: 320, quality: 82, maxBytes: 90_000 },
  poll: { side: 480, quality: 80, maxBytes: 100_000 },
  trump: { side: 360, quality: 80, maxBytes: 80_000 },
  preview: { side: 480, quality: 72, maxBytes: 60_000 },
  chat: { side: 1600, quality: 82, maxBytes: 450_000 },
};
export const IMAGE_FORMATS = FORMATS;
const EXPIRING: Usage[] = ['chat', 'preview'];
export type MediaRow = typeof media.$inferSelect;
interface Ticket { accountId: string; usage: Usage; until: number }

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Images');
  private readonly tickets = new Map<string, Ticket>();
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(ENV) private readonly env: Env, @Inject(DB) private readonly db: Db, private readonly storage: StorageService, private readonly cache: CacheService) {}

  onModuleInit() { this.timer = setInterval(() => void this.sweep(), HOUR); this.timer.unref(); setTimeout(() => void this.sweep(), 5000).unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  url(id: string) { return `${this.env.PUBLIC_URL.replace(/\/+$/, '')}/media/${id}`; }

  /** A single-use upload ticket (2 min), given over the WebSocket: the code never goes in an HTTP request. */
  async ticket(accountId: string, usage: Usage) {
    if (!(await this.cache.allow(`uploads:${accountId}`, LIMITS.uploads.count, LIMITS.uploads.perMs))) throw new UserError('Doucement : trop d\'images envoyées, attends une minute.');
    if ((await this.storage.check()) !== 'ok') throw new UserError('Images indisponibles pour le moment.');
    if ((await this.storage.usage()).level === 'full') throw new UserError('Stockage du serveur plein : les images sont refusées pour le moment.');
    const t = randomBytes(24).toString('base64url');
    this.tickets.set(t, { accountId, usage, until: Date.now() + 2 * 60_000 });
    for (const [k, v] of this.tickets) if (v.until < Date.now()) this.tickets.delete(k);
    return { ticket: t, url: `${this.env.PUBLIC_URL.replace(/\/+$/, '')}/api/media` };
  }

  /** The file of an upload: converted for its usage, stored once (the same file again gives the same picture). */
  /** Does this ticket exist (not used, not expired)? Checked before the body is even read. */
  hasTicket(ticket: string) { const t = this.tickets.get(ticket); return !!t && t.until > Date.now(); }

  async upload(ticket: string, body: Buffer): Promise<MediaRow & { account: string }> {
    const t = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!t || t.until < Date.now()) throw new UserError('Envoi expiré : réessaie.');
    return { ...(await this.store(t.usage, body)), account: t.accountId };
  }

  /** Stores a picture for a usage (an upload, or a link preview's image read by the server). */
  async store(usage: Usage, body: Buffer): Promise<MediaRow> {
    const t = { usage };
    if (!body.length) throw new UserError('Fichier vide.');
    if (body.length > LIMITS.maxUploadBytes) throw new UserError('Fichier énorme : plus de 200 Mo, ce n\'est sans doute pas une image.');
    const sha256 = createHash('sha256').update(body).digest('hex');
    const found = await this.db.query.media.findFirst({ where: and(eq(media.usage, t.usage), eq(media.sha256, sha256)) });
    if (found) {   // sent again: the same picture; a chat image lives a week from now
      if (EXPIRING.includes(t.usage)) await this.db.update(media).set({ expiresAt: this.expiry() }).where(eq(media.id, found.id));
      return found;
    }
    const f = FORMATS[t.usage];
    let out: { data: Buffer; info: import('sharp').OutputInfo } | null = null;
    try {
      // quality first (down to 40), then the size (×0.8 at a time): until the weight aimed at is met
      for (let side = f.side, step = 0; step < 6 && !(out && out.data.length <= f.maxBytes); step++, side = Math.round(side * 0.8)) {
        for (let q = f.quality; q >= 40; q -= 10) {
          // at most 100 megapixels (all the frames of an animation together): a « bomb » picture is refused, not decoded
          const img = sharp(body, { animated: !f.square, limitInputPixels: 100_000_000, failOn: 'none' }).rotate();
          out = await (f.square ? img.resize(side, side, { fit: 'cover', position: 'centre' })
            : img.resize(side, side, { fit: 'inside', withoutEnlargement: true })).webp({ quality: q, effort: 4 }).toBuffer({ resolveWithObject: true });
          if (out.data.length <= f.maxBytes) break;
        }
      }
    } catch { throw new UserError('Ce fichier n\'est pas une image lisible.'); }
    if (!out) throw new UserError('Ce fichier n\'est pas une image lisible.');
    const bucket = EXPIRING.includes(t.usage) ? this.storage.buckets.chat : this.storage.buckets.durable;
    const objectKey = `${t.usage}/${sha256}.webp`;
    const height = out.info.pageHeight ?? out.info.height;
    try {
      await this.storage.s3!.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: out.data, ContentType: 'image/webp' }));
    } catch { throw new UserError('Images indisponibles pour le moment.'); }
    const [row] = await this.db.insert(media).values({ usage: t.usage, sha256, bucket, objectKey, mime: 'image/webp', width: out.info.width, height,
      bytes: out.data.length, expiresAt: EXPIRING.includes(t.usage) ? this.expiry() : null }).onConflictDoNothing().returning();
    return row ?? (await this.db.query.media.findFirst({ where: and(eq(media.usage, t.usage), eq(media.sha256, sha256)) }))!;
  }

  private expiry() { return new Date(Date.now() + RETENTION.chatImages); }

  async get(id: string) { return /^[0-9a-f-]{36}$/.test(id) ? (await this.db.query.media.findFirst({ where: eq(media.id, id) })) ?? null : null; }

  /** A picture just uploaded, for this usage (an upload is only good for the usage of its ticket). */
  async picture(id: string, usage: string): Promise<MediaRow> {
    const row = await this.get(id);
    if (!row || row.usage !== usage) throw new UserError('Image introuvable : envoie-la de nouveau.');
    return row;
  }

  async stream(row: MediaRow) {
    const r = await this.storage.s3!.send(new GetObjectCommand({ Bucket: row.bucket, Key: row.objectKey }));
    return r.Body as NodeJS.ReadableStream;
  }

  /** A poll's pictures kept while it is open (and an hour after, for its results): the default + the poll's duration. */
  async keepFor(ids: string[], ms: number) {
    if (ids.length) await this.db.update(media).set({ expiresAt: new Date(Date.now() + HOUR + ms) }).where(inArray(media.id, ids));
  }

  /** Deletes pictures nothing uses any more (or expired), rows and files; `only`: just these ones, now. */
  async sweep(only?: string[]) {
    const ids = only?.length ? sql`and m.id in (${sql.join(only.map(i => sql`${i}::uuid`), sql`, `)})` : sql``;
    try {
      const gone = await this.db.execute<{ bucket: string; object_key: string; bytes: number }>(sql`
        delete from media m where (
          (m.usage in ('chat', 'preview') and m.expires_at < now())
          or (m.usage not in ('chat', 'preview') and m.created_at < now() - ${only ? sql`interval '0'` : sql`interval '1 hour'`}
            and not exists (select 1 from stickers s where s.media_id = m.id)
            and not exists (select 1 from custom_emoji e where e.media_id = m.id)
            and not exists (select 1 from room_members r where r.photo_id = m.id)
            and not exists (select 1 from trump_art t where t.media_id = m.id)
            and not (m.usage = 'poll' and m.expires_at is not null and m.expires_at > now()))   -- a poll's picture: while its poll lasts
        ) ${ids} returning m.bucket, m.object_key, m.bytes`);
      if (!gone.length) return 0;
      const byBucket = new Map<string, string[]>();
      for (const g of gone) byBucket.set(g.bucket, [...(byBucket.get(g.bucket) ?? []), g.object_key]);
      for (const [Bucket, keys] of byBucket) for (let i = 0; i < keys.length; i += 1000) {
        await this.storage.s3?.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true } })).catch(() => {});
      }
      this.log.log(`${gone.length} image(s) supprimée(s), ${(gone.reduce((n, g) => n + Number(g.bytes), 0) / 1024 / 1024).toFixed(1)} Mo libérés`);
      return gone.length;
    } catch (e) { this.log.warn(`ménage impossible : ${(e as Error).message}`); return 0; }
  }
}
