// The Palmarès (openspec: define-game-concept, Palmarès): each player's result of each round, kept with the room as
// long as it exists; the games record them, the panel reads them.
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PalmaresEvent } from '@slopesque/shared';
import { DB, type Db } from '../../db/db.module.js';
import { palmares } from '../../db/schema.js';
import type { RoomRt } from '../../rooms/room-rt.js';

@Injectable()
export class Palmares {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** One player's result in one round (`data.account`: the player). */
  async record(rt: RoomRt, game: PalmaresEvent['game'], data: Record<string, unknown>) {
    await this.db.insert(palmares).values({ roomId: rt.room.id, game, data });
  }

  /** The room's results (the last 5 000), with each player's current name and colour. */
  async list(rt: RoomRt): Promise<PalmaresEvent[]> {
    const rows = await this.db.execute<{ at: string; game: string; data: Record<string, unknown>; name: string | null; hue: number | null }>(sql`
      select p.at, p.game, p.data, a.name, m.hue from palmares p
      left join accounts a on a.id = (p.data->>'account')::uuid
      left join room_members m on m.room_id = p.room_id and m.account_id = (p.data->>'account')::uuid
      where p.room_id = ${rt.room.id} order by p.at desc limit 5000`);
    return rows.map(r => ({ ...(r.data as object), at: new Date(r.at).getTime(), game: r.game, id: String(r.data.account), name: r.name ?? '?',
      hue: r.hue ?? 0, won: !!r.data.won })) as PalmaresEvent[];
  }
}
