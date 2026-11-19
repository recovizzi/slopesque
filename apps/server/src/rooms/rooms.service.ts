// Rooms: made and deleted by an admin only (console), joined by their key (openspec: game-session, admin-console).
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { newKey, normalizeKey } from '@slopesque/engines';
import { DB, SQL, type Db } from '../db/db.module.js';
import { rooms } from '../db/schema.js';
import type postgres from 'postgres';
import { UserError } from '../errors.js';

export type Room = typeof rooms.$inferSelect;
export const ADMIN_CHANNEL = 'slopesque_admin';
export type AdminNotice = { type: 'room-deleted'; key: string } | { type: 'code-reset'; accountId: string } | { type: 'room-changed'; key: string }
  | { type: 'message-removed'; roomId: string; id: number } | { type: 'members-changed'; roomId: string };

@Injectable()
export class RoomsService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(SQL) private readonly sql: postgres.Sql) {}

  async byKey(key: string): Promise<Room | null> {
    const k = normalizeKey(key);
    return k ? (await this.db.query.rooms.findFirst({ where: eq(rooms.key, k) })) ?? null : null;
  }

  async create(key: string | undefined, name = '') {
    const k = key ? normalizeKey(key) : newKey();
    if (!k) throw new UserError('Une clé a la forme XXXX-XXXX : lettres et chiffres, sans I, L, O, 0 ni 1.');
    const [room] = await this.db.insert(rooms).values({ key: k, name }).onConflictDoNothing().returning();
    if (!room) throw new UserError(`Un salon a déjà la clé ${k}.`);
    return room;
  }

  async list(search?: string) {
    return this.db.execute<{ key: string; name: string; players: number; last_activity_at: string; created_at: string }>(sql`
      select r.key, r.name, r.created_at, r.last_activity_at, (select count(*)::int from room_members m where m.room_id = r.id) as players
      from rooms r where ${search ?? null}::text is null or r.key ilike '%' || ${search ?? null} || '%' or r.name ilike '%' || ${search ?? null} || '%'
      order by r.last_activity_at desc`);
  }

  /** Deletes the room and all it holds (cascade); its pictures used nowhere else go with the media sweep. */
  async delete(key: string) {
    const room = await this.byKey(key);
    if (!room) throw new UserError('Aucun salon avec cette clé.');
    await this.db.delete(rooms).where(eq(rooms.id, room.id));
    await this.notify({ type: 'room-deleted', key: room.key });
    return room;
  }

  async touch(id: string) { await this.db.update(rooms).set({ lastActivityAt: new Date() }).where(eq(rooms.id, id)); }

  /** Tells the running server what the console just did (LISTEN/NOTIFY). */
  async notify(n: AdminNotice) { await this.sql.notify(ADMIN_CHANNEL, JSON.stringify(n)); }

  recent() { return this.db.select().from(rooms).orderBy(desc(rooms.lastActivityAt)).limit(1); }
}
