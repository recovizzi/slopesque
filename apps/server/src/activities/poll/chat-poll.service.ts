// A poll continued in the chat (openspec: chat-activity, Sondage continué dans le chat): the activity changed while it
// was open, so it became a message (its time and its answers kept), answered there by any player of the room, closed
// by its clock, by everyone's answer or by its host; its results shown in its message.
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { Poll } from '@slopesque/engines';
import type { PollAnswer } from '@slopesque/shared';
import { DB, type Db } from '../../db/db.module.js';
import { messages } from '../../db/schema.js';
import { ChatService, type StoredChatPoll } from '../../chat/chat.service.js';
import { UserError } from '../../errors.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';
import { validAnswer } from './answers.js';

declare module '../../rooms/room-rt.js' {
  interface RoomSlots { chatPolls: Map<number, { cp: StoredChatPoll; timer: NodeJS.Timeout | null }> }
}

@Injectable()
export class ChatPolls {
  constructor(@Inject(DB) private readonly db: Db, private readonly chat: ChatService, private readonly rooms: RoomRegistry) {}

  init(rt: RoomRt) { rt.slots.chatPolls = new Map(); }

  /** The polls continued in the chat, still open: their clock again (closed at once if their time ran out meanwhile). */
  async restore(rt: RoomRt) {
    const open = sql`coalesce((${messages.data}->'chatPoll'->>'closed')::boolean, true) = false`;
    for (const m of await this.db.select().from(messages).where(and(eq(messages.roomId, rt.room.id), eq(messages.kind, 'poll'), open))) {
      this.arm(rt, m.id, (m.data as { chatPoll: StoredChatPoll }).chatPoll);
    }
  }

  /** The poll's message (in its host's name), answered from now on in the chat. */
  async open(rt: RoomRt, cp: StoredChatPoll) {
    const [row] = await this.db.insert(messages)
      .values({ roomId: rt.room.id, authorId: cp.host, kind: 'poll', text: cp.poll.question, data: { chatPoll: cp } }).returning();
    this.arm(rt, row!.id, cp);
    this.rooms.emit(rt, { type: 'message', message: this.chat.view(row!) });
  }

  private arm(rt: RoomRt, id: number, cp: StoredChatPoll) {
    const timer = setTimeout(() => void this.close(rt, id), Math.max(0, cp.deadline - Date.now()));
    rt.slots.chatPolls.set(id, { cp, timer });
  }

  /** Its message rewritten (its answers kept; everyone sees who answered, not what, until it closes). */
  private async save(rt: RoomRt, id: number, cp: StoredChatPoll) {
    const [row] = await this.db.update(messages).set({ data: { chatPoll: cp } }).where(eq(messages.id, id)).returning();
    if (row) this.rooms.emit(rt, { type: 'message-updated', message: this.chat.view(row) });
  }

  /** An answer in the chat: any player of the room, once; closed when every connected player (but its host) answered. */
  async answer(rt: RoomRt, me: string, id: number, answer: PollAnswer) {
    const e = rt.slots.chatPolls.get(id);
    if (!e || e.cp.closed) throw new UserError('Ce sondage est fermé.');
    if (me in e.cp.answers) throw new UserError('Tu as déjà répondu.');
    if (!validAnswer(e.cp.poll, answer)) throw new UserError('Réponse invalide.');
    e.cp.answers[me] = answer;
    await this.save(rt, id, e.cp);
    const others = this.rooms.connected(rt).filter(x => x !== e.cp.host);
    if (others.length && others.every(x => x in e.cp.answers)) await this.close(rt, id);
  }

  /** Its host (or the room's) ends it now. */
  async end(rt: RoomRt, me: string, id: number) {
    const e = rt.slots.chatPolls.get(id);
    if (!e || e.cp.closed) throw new UserError('Ce sondage est déjà fermé.');
    if (me !== e.cp.host && me !== rt.room.hostId) throw new UserError('Seul l\'hôte du sondage peut le terminer.');
    await this.close(rt, id);
  }

  /** Closed: its outcome counted, shown in its message. */
  private async close(rt: RoomRt, id: number) {
    const e = rt.slots.chatPolls.get(id);
    if (!e || e.cp.closed) return;
    if (e.timer) clearTimeout(e.timer);
    rt.slots.chatPolls.delete(id);
    e.cp.closed = true;
    e.cp.outcome = Poll.outcome({ ...e.cp.poll, answers: e.cp.answers } as Poll.Poll, e.cp.host ?? '');
    await this.save(rt, id, e.cp);
    const n = Object.keys(e.cp.answers).length;
    await this.rooms.say(rt,
      `Sondage « ${e.cp.poll.question} » terminé : ${n} réponse${n > 1 ? 's' : ''}, les résultats sont dans le chat.`, true);
  }
}
