// Votes launched from the chat (openspec: chat-activity, Votes dans le chat): one at a time per room, its message
// rewritten at each vote, decided at its end (2 minutes, or everyone voted). What an accepted vote does belongs to
// whoever launches its kind: the hub (host, activity), the card table (kick).
import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { castVote, closeVote, startVote, type Vote, type VoteKind } from '@slopesque/engines';
import { DB, type Db } from '../db/db.module.js';
import { messages } from '../db/schema.js';
import { ChatService } from '../chat/chat.service.js';
import { UserError } from '../errors.js';
import { RoomRegistry } from './room-registry.js';
import type { RoomRt } from './room-rt.js';

type Outcome = (rt: RoomRt, v: Vote) => Promise<void>;

@Injectable()
export class Votes {
  private readonly outcomes = new Map<VoteKind, Outcome>();

  constructor(@Inject(DB) private readonly db: Db, private readonly chat: ChatService, private readonly rooms: RoomRegistry) {}

  /** What an accepted vote of this kind does. */
  on(kind: VoteKind, outcome: Outcome) { this.outcomes.set(kind, outcome); }

  async launch(rt: RoomRt, v: Omit<Vote, 'yes' | 'no' | 'voters' | 'ends'>) {
    if (rt.vote) throw new UserError('Un vote est déjà en cours dans le chat : attends sa fin.');
    const vote = startVote(v, this.rooms.connected(rt));
    const [row] = await this.db.insert(messages).values({ roomId: rt.room.id, authorId: v.by, kind: 'vote', data: { vote } }).returning();
    rt.vote = { id: row!.id, v: vote, timer: setTimeout(() => void this.finish(rt), Math.max(0, vote.ends - Date.now())) };
    this.rooms.emit(rt, { type: 'message', message: this.chat.view(row!) });
    if (vote.yes.length === vote.voters.length) await this.finish(rt);   // alone: decided at once
  }

  private async save(rt: RoomRt, v: Vote) {
    const [row] = await this.db.update(messages).set({ data: { vote: v } }).where(eq(messages.id, rt.vote!.id)).returning();
    this.rooms.emit(rt, { type: 'message-updated', message: this.chat.view(row!) });
  }

  async cast(rt: RoomRt, me: string, id: number, yes: boolean) {
    if (!rt.vote || rt.vote.id !== id) throw new UserError('Ce vote est terminé.');
    const r = castVote(rt.vote.v, me, yes);
    if (!r) throw new UserError('Tu ne votes pas : tu n\'étais pas connecté à son lancement.');
    rt.vote.v = r.vote;
    await this.save(rt, r.vote);
    if (r.done) await this.finish(rt);
  }

  /** The end of the vote (its 2 minutes, or everyone voted): the result, and what it changes. */
  private async finish(rt: RoomRt) {
    if (!rt.vote) return;
    clearTimeout(rt.vote.timer);
    const v = closeVote(rt.vote.v);
    await this.save(rt, v);
    rt.vote = null;
    if (v.result === 'yes') await this.outcomes.get(v.kind)?.(rt, v);
  }

  /** At start: the votes left open by a restart are cancelled, and it is said. */
  async cancelOpen() {
    const open = await this.db.select().from(messages).where(sql`${messages.kind} = 'vote' and ${messages.data}->'vote'->>'result' is null`);
    for (const m of open) {
      await this.db.update(messages).set({ data: { vote: { ...(m.data as { vote: Vote }).vote, result: 'cancelled' } } }).where(eq(messages.id, m.id));
      await this.chat.send(m.roomId, null, 'Le serveur a redémarré : vote annulé.', null, 'system');
    }
  }
}
