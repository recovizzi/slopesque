// The chat of a room (openspec: chat-activity, data-retention): messages kept 30 days, read by pages of 100 going up;
// a reply carries its quote (or says the quoted message is gone); reactions toggle.
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { HOUR, LIMITS, RETENTION, type ChatPage, type MessageView, type Quote } from '@slopesque/shared';
import { DB, type Db } from '../db/db.module.js';
import { messages, reactions, rooms } from '../db/schema.js';

type Row = typeof messages.$inferSelect;

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Chat');
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(DB) private readonly db: Db) {}

  onModuleInit() {
    void this.purge();
    this.timer = setInterval(() => void this.purge(), HOUR);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Deletes the messages older than 30 days (every hour; idempotent). */
  async purge() {
    try {
      const gone = await this.db.delete(messages).where(lt(messages.createdAt, new Date(Date.now() - RETENTION.messages))).returning({ id: messages.id });
      if (gone.length) this.log.log(`purge : ${gone.length} message(s) de plus de 30 jours supprimé(s)`);
      return gone.length;
    } catch (e) { this.log.warn(`purge impossible : ${(e as Error).message}`); return 0; }
  }

  /** The page of messages before `before` (the most recent ones without it), oldest first. */
  async page(roomId: string, roomCreatedAt: Date, before?: number): Promise<ChatPage> {
    const rows = await this.db.select().from(messages)
      .where(and(eq(messages.roomId, roomId), before ? lt(messages.id, before) : undefined))
      .orderBy(desc(messages.id)).limit(LIMITS.chatPage + 1);
    const hasMore = rows.length > LIMITS.chatPage;
    const list = rows.slice(0, LIMITS.chatPage).reverse();
    const views = await this.views(list);
    const old = Date.now() - roomCreatedAt.getTime() > RETENTION.messages;
    return { messages: views, hasMore, start: hasMore ? null : old ? 'purged' : 'begin' };
  }

  async views(list: Row[]): Promise<MessageView[]> {
    if (!list.length) return [];
    const ids = list.map(m => m.id);
    const reacts = await this.db.select().from(reactions).where(inArray(reactions.messageId, ids)).orderBy(reactions.at);
    const replyIds = [...new Set(list.map(m => m.replyTo).filter((x): x is number => x !== null))];
    const quoted = replyIds.length ? await this.db.select().from(messages).where(inArray(messages.id, replyIds)) : [];
    const byId = new Map(quoted.map(q => [q.id, q]));
    return list.map(m => {
      const r: Record<string, string[]> = {};
      for (const x of reacts) if (x.messageId === m.id) (r[x.emoji] ??= []).push(x.accountId);
      return this.view(m, r, m.replyTo === null ? null : quote(m.replyTo, byId.get(m.replyTo)));
    });
  }

  view(m: Row, reactions: Record<string, string[]> = {}, reply: Quote | null = null): MessageView {
    return { id: m.id, from: m.authorId, kind: m.kind as MessageView['kind'], text: m.text, at: m.createdAt.getTime(), reply, reactions, data: m.data ?? null,
      media: m.mediaKind ? { kind: m.mediaKind as 'image', src: null, w: 0, h: 0 } : null };
  }

  async send(roomId: string, authorId: string | null, text: string, replyTo: number | null = null, kind: MessageView['kind'] = 'text') {
    const [m] = await this.db.insert(messages).values({ roomId, authorId, text, replyTo, kind }).returning();
    await this.db.update(rooms).set({ lastActivityAt: new Date() }).where(eq(rooms.id, roomId));
    let q: Quote | null = null;
    if (replyTo !== null) {
      const [target] = await this.db.select().from(messages).where(and(eq(messages.id, replyTo), eq(messages.roomId, roomId)));
      q = quote(replyTo, target);
    }
    return this.view(m!, {}, q);
  }

  /** Adds my reaction, or removes it when I had it; the message's reactions after. */
  async react(roomId: string, id: number, accountId: string, emoji: string) {
    const [m] = await this.db.select({ id: messages.id }).from(messages).where(and(eq(messages.id, id), eq(messages.roomId, roomId)));
    if (!m) return null;
    const removed = await this.db.delete(reactions).where(and(eq(reactions.messageId, id), eq(reactions.accountId, accountId), eq(reactions.emoji, emoji))).returning();
    if (!removed.length) await this.db.insert(reactions).values({ messageId: id, accountId, emoji }).onConflictDoNothing();
    const all = await this.db.select().from(reactions).where(eq(reactions.messageId, id)).orderBy(reactions.at);
    const r: Record<string, string[]> = {};
    for (const x of all) (r[x.emoji] ??= []).push(x.accountId);
    return r;
  }

  async count(roomId: string) { const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(messages).where(eq(messages.roomId, roomId)); return r?.n ?? 0; }
}

/** What a reply shows of the message it answers; `gone` once it is deleted (more than 30 days old). */
function quote(id: number, m: Row | undefined): Quote {
  if (!m) return { id, from: null, text: '', kind: 'text', gone: true };
  return { id, from: m.authorId, text: m.text.slice(0, 200), kind: m.mediaKind ?? m.kind, gone: false };
}
