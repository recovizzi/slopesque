// The rooms being played, in memory (openspec: realtime-sync, design decision 4): who is connected, presence with a
// 15 s grace (a page change doesn't make a player blink away), the host, numbered events. Durable facts go to Postgres.
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Server, Socket } from 'socket.io';
import type postgres from 'postgres';
import { castVote, closeVote, creditWord, defaultHue, startVote, tierOf, type Vote } from '@slopesque/engines';
import * as D from '@slopesque/engines';
import { Poll, Wheel } from '@slopesque/engines';
import { PRESENCE, READY_ACTIVITIES, type PollAnswer, type PollView, type WheelView, type PollPicView, type ActivityChoice, type EmojiView, type GifRef, type MemberView, type RoomEvent, type RoomState, type StickerView } from '@slopesque/shared';
import { DB, SQL, type Db } from '../db/db.module.js';
import { accounts, customEmoji, media, messages, palmares, roomMembers, rooms, stickers } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { MediaService, type MediaRow } from '../media/media.service.js';
import { PreviewService } from '../external/preview.service.js';
import { ChatService } from '../chat/chat.service.js';
import { UserError } from '../errors.js';
import { ADMIN_CHANNEL, RoomsService, type AdminNotice, type Room } from './rooms.service.js';
import type { Account } from '../accounts/accounts.service.js';

interface MemberRt { sockets: Set<string>; awaySince: number | null; grace: NodeJS.Timeout | null }
interface PollRt { phase: PollView['phase']; round: number; seconds: number; secret: boolean; poll: PollView['poll']; answers: Record<string, PollAnswer>; host: string | null; deadline: number | null; timer: NodeJS.Timeout | null }
interface WheelRt { phase: WheelView['phase']; items: WheelView['items']; spin: WheelView['spin']; needle: number; timer: NodeJS.Timeout | null }
interface RoomRt { room: Room; seq: number; members: Map<string, MemberRt>; vote: { id: number; v: Vote; timer: NodeJS.Timeout } | null; disk: D.DiskState; diskTimer: NodeJS.Timeout | null; poll: PollRt; wheel: WheelRt }
export interface SocketData { account: Account; ip: string; roomId: string | null }

@Injectable()
export class RoomHub implements OnModuleInit {
  private readonly log = new Logger('Salons');
  io!: Server;
  private readonly live = new Map<string, RoomRt>();

  constructor(@Inject(DB) private readonly db: Db, @Inject(SQL) private readonly sql: postgres.Sql,
    private readonly rooms: RoomsService, readonly chat: ChatService, private readonly media: MediaService, private readonly previews: PreviewService) {}

  async onModuleInit() {
    await this.cancelVotes();
    await this.sql.listen(ADMIN_CHANNEL, payload => { try { this.onAdmin(JSON.parse(payload) as AdminNotice); } catch { /* malformed */ } });
  }

  /** A room starts being played (first player since the server started): its Demi-disque from the saved rules; a round
   *  that was running when the server stopped is cancelled, and it is said. */
  private async load(room: Room): Promise<RoomRt> {
    const saved = (room.rules.disk ?? {}) as { rules?: D.DiskRules; round?: number; guessing?: boolean };
    const disk = { ...D.newDisk({ ...D.DEFAULT_RULES, ...saved.rules }), round: saved.round ?? 1, phase: (saved.round ?? 1) > 1 ? 'writing' as const : 'lobby' as const };
    const ps = (room.rules.poll ?? {}) as { seconds?: number; secret?: boolean; round?: number };
    const ws = (room.rules.wheel ?? {}) as { items?: WheelView['items']; needle?: number };
    const rt: RoomRt = { room, seq: 0, members: new Map(), vote: null, disk, diskTimer: null,
      poll: { phase: 'writing', round: ps.round ?? 1, seconds: ps.seconds ?? 300, secret: ps.secret ?? false, poll: null, answers: {}, host: null, deadline: null, timer: null },
      wheel: { phase: 'writing', items: ws.items ?? [{ label: '', weight: '' }, { label: '', weight: '' }], spin: null, needle: ws.needle ?? 0, timer: null } };
    if (saved.guessing) { await this.saveDisk(rt); await this.chat.send(room.id, null, 'Le serveur a redémarré : tour annulé.', null, 'system'); }
    return rt;
  }

  // ---------------------------------------------------------------- join / leave
  async join(socket: Socket, key: string): Promise<RoomState> {
    const room = await this.rooms.byKey(key);
    if (!room) throw new UserError('unknown');
    const data = socket.data as SocketData, me = data.account.id;
    if (data.roomId && data.roomId !== room.id) this.leave(socket);
    const rt = this.live.get(room.id) ?? await this.load(room);
    this.live.set(room.id, rt);

    const existing = await this.db.query.roomMembers.findFirst({ where: and(eq(roomMembers.roomId, room.id), eq(roomMembers.accountId, me)) });
    if (!existing) {
      const taken = (await this.db.select({ hue: roomMembers.hue }).from(roomMembers).where(eq(roomMembers.roomId, room.id))).map(r => r.hue);
      await this.db.insert(roomMembers).values({ roomId: room.id, accountId: me, hue: data.account.hue ?? defaultHue(taken) }).onConflictDoNothing();
    }
    if (!rt.room.hostId) {   // a new room: its first player hosts it
      await this.db.update(rooms).set({ hostId: me }).where(eq(rooms.id, room.id));
      rt.room = { ...rt.room, hostId: me };
      this.emit(rt, { type: 'host', hostId: me });
    }

    const m = rt.members.get(me) ?? { sockets: new Set(), awaySince: null, grace: null };
    rt.members.set(me, m);
    const wasHere = m.sockets.size > 0 || m.grace !== null;
    if (m.grace) { clearTimeout(m.grace); m.grace = null; }
    m.sockets.add(socket.id);
    m.awaySince = null;
    data.roomId = room.id;
    await socket.join(`room:${room.id}`);
    if (!existing) await this.say(rt, null, `${data.account.name} rejoint le salon.`);
    if (!wasHere || !existing) await this.emitMember(rt, me);
    return this.state(rt, me);
  }

  /** The socket leaves its room; the player is away after the grace if it was his last connection there. */
  leave(socket: Socket) {
    const data = socket.data as SocketData;
    const rt = data.roomId ? this.live.get(data.roomId) : null;
    data.roomId = null;
    if (!rt) return;
    void socket.leave(`room:${rt.room.id}`);
    const me = data.account.id, m = rt.members.get(me);
    if (!m) return;
    m.sockets.delete(socket.id);
    if (m.sockets.size || m.grace) return;
    const since = Date.now();
    m.grace = setTimeout(() => {
      m.grace = null;
      if (m.sockets.size) return;
      m.awaySince = since;
      void this.db.update(roomMembers).set({ lastSeenAt: new Date(since) }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me)));
      void this.emitMember(rt, me);
    }, PRESENCE.graceMs);
    m.grace.unref?.();
  }

  // ---------------------------------------------------------------- state
  async state(rt: RoomRt, me: string): Promise<RoomState> {
    return { seq: rt.seq, room: { key: rt.room.key, name: rt.room.name, createdAt: rt.room.createdAt.getTime() }, me, hostId: rt.room.hostId,
      members: await this.members(rt), chat: await this.chat.page(rt.room.id, rt.room.createdAt), serverTime: Date.now(),
      stickers: await this.stickerViews(rt), emoji: await this.emojiViews(rt), activity: this.activity(rt), disk: D.diskView(rt.disk, me),
      poll: this.pollView(rt, me), wheel: this.wheelView(rt) };
  }

  private async members(rt: RoomRt, only?: string): Promise<MemberView[]> {
    const rows = await this.db.select({ m: roomMembers, a: accounts }).from(roomMembers).innerJoin(accounts, eq(accounts.id, roomMembers.accountId))
      .where(only ? and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, only)) : eq(roomMembers.roomId, rt.room.id))
      .orderBy(roomMembers.joinedAt);
    const photoIds = rows.map(r => r.m.photoId).filter((x): x is string => !!x);
    const known = new Set(photoIds.length ? (await this.db.select({ id: media.id }).from(media).where(inArray(media.id, photoIds))).map(x => x.id) : []);
    return rows.map(({ m, a }) => {
      const live = rt.members.get(a.id), here = !!live && (live.sockets.size > 0 || live.grace !== null);
      const awaySince = here ? null : live?.awaySince ?? m.lastSeenAt.getTime();
      const presence = here ? 'here' : Date.now() - awaySince! >= PRESENCE.goneMs ? 'gone' : 'away';
      return { id: a.id, name: a.name, hue: m.hue, photo: m.photoId && known.has(m.photoId) ? this.media.url(m.photoId) : null, presence, awaySince, playing: m.playing, score: m.score, credit: m.credit, joinedAt: m.joinedAt.getTime() };
    });
  }

  roomOf(socket: Socket) {
    const id = (socket.data as SocketData).roomId, rt = id ? this.live.get(id) : null;
    if (!rt) throw new UserError('Tu n\'es dans aucun salon.');
    return rt;
  }

  // ---------------------------------------------------------------- events
  emit(rt: RoomRt, e: RoomEvent) {
    rt.seq++;
    this.io?.to(`room:${rt.room.id}`).emit('event', { ...e, seq: rt.seq });
  }
  async emitMember(rt: RoomRt, id: string) {
    const [member] = await this.members(rt, id);
    if (member) this.emit(rt, { type: 'member', member });
  }
  async say(rt: RoomRt, from: string | null, text: string, replyTo: number | null = null) {
    const message = await this.chat.send(rt.room.id, from, text, replyTo, from ? 'text' : 'system');
    this.emit(rt, { type: 'message', message });
    if (from) void this.previews.forText(text).then(async p => {   // the first link's preview, when its site gives one
      if (!p) return;
      const updated = await this.chat.setPreview(message.id, p);
      if (updated && this.live.get(rt.room.id) === rt) this.emit(rt, { type: 'message-updated', message: updated });
    });
    return message;
  }

  // ---------------------------------------------------------------- pictures
  /** A picture just uploaded, for this usage (an upload is only good for the usage of its ticket). */
  async picture(id: string, usage: string): Promise<MediaRow> {
    const row = await this.media.get(id);
    if (!row || row.usage !== usage) throw new UserError('Image introuvable : envoie-la de nouveau.');
    return row;
  }

  async sendPicture(socket: Socket, kind: 'image' | 'sticker', pic: MediaRow, replyTo: number | null = null) {
    const rt = this.roomOf(socket);
    const message = await this.chat.sendMedia(rt.room.id, (socket.data as SocketData).account.id, kind, pic, replyTo);
    this.emit(rt, { type: 'message', message });
  }

  async sendGif(socket: Socket, gif: GifRef) {
    const rt = this.roomOf(socket);
    this.emit(rt, { type: 'message', message: await this.chat.sendGif(rt.room.id, (socket.data as SocketData).account.id, gif) });
  }

  private async stickerViews(rt: RoomRt): Promise<StickerView[]> {
    const rows = await this.db.select({ s: stickers, m: media }).from(stickers).innerJoin(media, eq(media.id, stickers.mediaId))
      .where(eq(stickers.roomId, rt.room.id)).orderBy(desc(stickers.usedAt)).limit(60);
    return rows.map(({ s, m }) => ({ id: s.id, src: this.media.url(m.id), w: m.width, h: m.height }));
  }
  private async emojiViews(rt: RoomRt): Promise<EmojiView[]> {
    const rows = await this.db.select().from(customEmoji).where(eq(customEmoji.roomId, rt.room.id)).orderBy(customEmoji.createdAt);
    return rows.map(e => ({ name: e.name, url: this.media.url(e.mediaId), by: e.addedBy }));
  }

  /** The room's sticker library: a new one first (the same picture once), 60 at most (the oldest go). */
  async addSticker(socket: Socket, pic: MediaRow, send: boolean) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    const [same] = await this.db.select().from(stickers).where(and(eq(stickers.roomId, rt.room.id), eq(stickers.mediaId, pic.id)));
    if (same) await this.db.update(stickers).set({ usedAt: new Date() }).where(eq(stickers.id, same.id));
    else await this.db.insert(stickers).values({ roomId: rt.room.id, mediaId: pic.id, addedBy: me });
    const extra = (await this.db.select({ id: stickers.id, mediaId: stickers.mediaId }).from(stickers).where(eq(stickers.roomId, rt.room.id)).orderBy(desc(stickers.usedAt))).slice(60);
    if (extra.length) { await this.db.delete(stickers).where(inArray(stickers.id, extra.map(x => x.id))); await this.media.sweep(extra.map(x => x.mediaId)); }
    this.emit(rt, { type: 'stickers', stickers: await this.stickerViews(rt) });
    if (send) await this.sendPicture(socket, 'sticker', pic);
  }

  async sendSticker(socket: Socket, id: string) {
    const rt = this.roomOf(socket);
    const [s] = await this.db.select().from(stickers).where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id)));
    if (!s) throw new UserError('Ce sticker n\'existe plus.');
    await this.db.update(stickers).set({ usedAt: new Date() }).where(eq(stickers.id, id));
    this.emit(rt, { type: 'stickers', stickers: await this.stickerViews(rt) });
    await this.sendPicture(socket, 'sticker', (await this.media.get(s.mediaId))!);
  }

  /** Removed from the library: deleted (and its picture, if no other room uses it). */
  async removeSticker(socket: Socket, id: string) {
    const rt = this.roomOf(socket);
    const [s] = await this.db.delete(stickers).where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id))).returning();
    if (s) await this.media.sweep([s.mediaId]);
    this.emit(rt, { type: 'stickers', stickers: await this.stickerViews(rt) });
  }

  async addEmoji(socket: Socket, name: string, pic: MediaRow) {
    const rt = this.roomOf(socket), a = (socket.data as SocketData).account;
    const [row] = await this.db.insert(customEmoji).values({ roomId: rt.room.id, name, mediaId: pic.id, addedBy: a.id }).onConflictDoNothing().returning();
    if (!row) throw new UserError(`:${name}: existe déjà dans le salon.`);
    this.emit(rt, { type: 'emoji', emoji: await this.emojiViews(rt) });
    await this.say(rt, null, `${a.name} a ajouté l'emoji :${name}: pour tout le salon.`);
  }

  /** My photo in this room (null: removed); the old one is deleted at once. */
  async setPhoto(socket: Socket, pic: MediaRow | null) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    const [before] = await this.db.select({ p: roomMembers.photoId }).from(roomMembers).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me)));
    await this.db.update(roomMembers).set({ photoId: pic?.id ?? null }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me)));
    if (before?.p && before.p !== pic?.id) await this.media.sweep([before.p]);
    await this.emitMember(rt, me);
  }

  /** A profile changed: every room where the player is shown hears it. */
  async profileChanged(accountId: string) {
    for (const rt of this.live.values()) if (rt.members.has(accountId)) await this.emitMember(rt, accountId);
  }

  async giveHost(socket: Socket, to: string) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    if (rt.room.hostId !== me) throw new UserError('Seul l\'hôte peut donner son rôle.');
    const [target] = await this.members(rt, to);
    if (!target) throw new UserError('Ce joueur n\'est pas dans le salon.');
    await this.db.update(rooms).set({ hostId: to }).where(eq(rooms.id, rt.room.id));
    rt.room = { ...rt.room, hostId: to };
    this.emit(rt, { type: 'host', hostId: to });
    await this.say(rt, null, `${target.name} devient l'hôte.`);
  }

  // ---------------------------------------------------------------- activity, votes, host, social credit
  activity(rt: RoomRt): ActivityChoice { return (rt.room.rules.activity as ActivityChoice | undefined) ?? { activity: 'chat' }; }

  private async setActivity(rt: RoomRt, choice: ActivityChoice) {
    const rules = { ...rt.room.rules, activity: choice };
    await this.db.update(rooms).set({ rules }).where(eq(rooms.id, rt.room.id));
    rt.room = { ...rt.room, rules };
    this.emit(rt, { type: 'activity', activity: choice });
  }

  private async setHost(rt: RoomRt, to: string) {
    await this.db.update(rooms).set({ hostId: to }).where(eq(rooms.id, rt.room.id));
    rt.room = { ...rt.room, hostId: to };
    this.emit(rt, { type: 'host', hostId: to });
  }

  /** The players connected now (or within their grace): the voters of a vote launched now. */
  private connected(rt: RoomRt) { return [...rt.members].filter(([, m]) => m.sockets.size > 0 || m.grace !== null).map(([id]) => id); }

  private async launch(rt: RoomRt, v: Omit<Vote, 'yes' | 'no' | 'voters' | 'ends'>) {
    if (rt.vote) throw new UserError('Un vote est déjà en cours dans le chat : attends sa fin.');
    const vote = startVote(v, this.connected(rt));
    const [row] = await this.db.insert(messages).values({ roomId: rt.room.id, authorId: v.by, kind: 'vote', data: { vote } }).returning();
    rt.vote = { id: row!.id, v: vote, timer: setTimeout(() => void this.finish(rt), Math.max(0, vote.ends - Date.now())) };
    this.emit(rt, { type: 'message', message: this.chat.view(row!) });
    if (vote.yes.length === vote.voters.length) await this.finish(rt);   // alone: decided at once
  }

  private async saveVote(rt: RoomRt, v: Vote) {
    const [row] = await this.db.update(messages).set({ data: { vote: v } }).where(eq(messages.id, rt.vote!.id)).returning();
    this.emit(rt, { type: 'message-updated', message: this.chat.view(row!) });
  }

  async vote(socket: Socket, id: number, yes: boolean) {
    const rt = this.roomOf(socket);
    if (!rt.vote || rt.vote.id !== id) throw new UserError('Ce vote est terminé.');
    const r = castVote(rt.vote.v, (socket.data as SocketData).account.id, yes);
    if (!r) throw new UserError('Tu ne votes pas : tu n\'étais pas connecté à son lancement.');
    rt.vote.v = r.vote;
    await this.saveVote(rt, r.vote);
    if (r.done) await this.finish(rt);
  }

  /** The end of the vote (its 2 minutes, or everyone voted): the result, and what it changes. */
  private async finish(rt: RoomRt) {
    if (!rt.vote) return;
    clearTimeout(rt.vote.timer);
    const v = closeVote(rt.vote.v);
    await this.saveVote(rt, v);
    rt.vote = null;
    if (v.result !== 'yes') return;
    if (v.kind === 'host' && v.target) {
      await this.setHost(rt, v.target);
      const [m] = await this.members(rt, v.target);
      await this.say(rt, null, `${m?.name ?? '?'} devient l'hôte (vote accepté).`);
    } else if (v.kind === 'activity' && v.choice) await this.setActivity(rt, v.choice as ActivityChoice);
  }

  /** At start: the votes left open by a restart are cancelled, and it is said. */
  private async cancelVotes() {
    const open = await this.db.select().from(messages).where(sql`${messages.kind} = 'vote' and ${messages.data}->'vote'->>'result' is null`);
    for (const m of open) {
      await this.db.update(messages).set({ data: { vote: { ...(m.data as { vote: Vote }).vote, result: 'cancelled' } } }).where(eq(messages.id, m.id));
      await this.chat.send(m.roomId, null, 'Le serveur a redémarré : vote annulé.', null, 'system');
    }
  }

  /** /hote: the host already; the host away for 5 min or more (or gone): the role at once; else a vote. */
  async askHost(socket: Socket): Promise<'already' | 'taken' | 'vote'> {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account;
    if (rt.room.hostId === me.id) return 'already';
    const [host] = rt.room.hostId ? await this.members(rt, rt.room.hostId) : [];
    if (!host || host.presence === 'gone') {
      await this.setHost(rt, me.id);
      const mins = host?.awaySince ? Math.floor((Date.now() - host.awaySince) / 60_000) : 0;
      await this.say(rt, null, `${me.name} devient l'hôte : ${host ? `${host.name} n'était plus là depuis ${mins} min` : 'l\'hôte avait quitté le salon'}.`);
      return 'taken';
    }
    await this.launch(rt, { kind: 'host', by: me.id, target: me.id, label: `demande à devenir l'hôte, à la place de ${host.name}` });
    return 'vote';
  }

  /** /activity: the host changes it at once; another player proposes it to a vote. */
  async chooseActivity(socket: Socket, choice: ActivityChoice, label: string): Promise<'applied' | 'vote'> {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account;
    if (!READY_ACTIVITIES.includes(choice.activity)) throw new UserError('Cette activité arrive bientôt.');
    if (rt.room.hostId === me.id) {
      await this.setActivity(rt, choice);
      await this.say(rt, null, `${me.name} passe à ${label}.`);
      return 'applied';
    }
    await this.launch(rt, { kind: 'activity', by: me.id, choice, label: `propose de passer à ${label}` });
    return 'vote';
  }

  /** /credit-social: never to oneself; said in the chat with the change. */
  async giveCredit(socket: Socket, to: string, delta: number) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    if (to === me) throw new UserError('Impossible de se donner du crédit soi-même.');
    const [row] = await this.db.update(roomMembers).set({ credit: sql`${roomMembers.credit} + ${delta}` })
      .where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, to))).returning();
    if (!row) throw new UserError('Ce joueur n\'est plus dans le salon.');
    const [m] = await this.db.insert(messages).values({ roomId: rt.room.id, authorId: null, kind: 'credit', data: { by: me, to, delta, tier: tierOf(delta).name, words: creditWord(Math.abs(delta)) } }).returning();
    this.emit(rt, { type: 'message', message: this.chat.view(m!) });
    await this.emitMember(rt, to);
  }

  // ---------------------------------------------------------------- Demi-disque
  /** Each player gets the round as he may see it (the host's answer hidden from the others until the reveal). */
  private async emitDisk(rt: RoomRt) {
    rt.seq++;
    for (const s of await this.io.in(`room:${rt.room.id}`).fetchSockets()) s.emit('event', { type: 'disk', disk: D.diskView(rt.disk, (s.data as SocketData).account.id), seq: rt.seq });
  }
  private async saveDisk(rt: RoomRt) {
    const rules = { ...rt.room.rules, disk: { rules: { ...rt.disk.rules, ...rt.disk.pending }, round: rt.disk.round, guessing: rt.disk.phase === 'guessing' } };
    await this.db.update(rooms).set({ rules }).where(eq(rooms.id, rt.room.id));
    rt.room = { ...rt.room, rules };
  }
  private hostOnly(rt: RoomRt, socket: Socket) { if (rt.room.hostId !== (socket.data as SocketData).account.id) throw new UserError('Seul l\'hôte peut faire ça.'); }
  private wrap<T>(f: () => T): T { try { return f(); } catch (e) { if (e instanceof D.DiskError) throw new UserError(e.message); throw e; } }
  /** The candidates of a round: the players who joined (« Participer »), connected, except the host. */
  private candidates(rt: RoomRt, playing: Set<string>) { return this.connected(rt).filter(id => playing.has(id) && id !== rt.disk.host); }

  async diskRules(socket: Socket, changes: Partial<D.DiskRules>) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    const r = D.setRules(rt.disk, changes);
    rt.disk = r.state;
    await this.saveDisk(rt);
    await this.emitDisk(rt);
    return r.now ? 'now' as const : 'pending' as const;
  }

  async diskJoin(socket: Socket) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account;
    await this.db.update(roomMembers).set({ playing: true }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me.id)));
    await this.emitMember(rt, me.id);
    await this.say(rt, null, `${me.name} rejoint la partie.`);
  }

  async diskStart(socket: Socket, word: string, target: number) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    rt.disk = this.wrap(() => D.startRound(rt.disk.phase === 'reveal' || rt.disk.phase === 'lobby' ? D.nextRound(rt.disk) : rt.disk, rt.room.hostId!, word, target));
    if (this.activity(rt).activity !== 'disk') await this.setActivity(rt, { activity: 'disk', mode: rt.disk.mode });
    await this.saveDisk(rt);
    await this.say(rt, null, `Tour ${rt.disk.round} : « ${rt.disk.word} »`);
    if (rt.diskTimer) clearTimeout(rt.diskTimer);
    rt.diskTimer = setTimeout(() => void this.diskReveal(rt), rt.disk.deadline! - Date.now());
    await this.emitDisk(rt);
  }

  async diskGuess(socket: Socket, value: number) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    const [m] = await this.db.select({ playing: roomMembers.playing }).from(roomMembers).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, me)));
    if (!m?.playing) throw new UserError('Clique d\'abord « Participer ».');
    rt.disk = this.wrap(() => D.guess(rt.disk, me, value));
    await this.emitDisk(rt);
    const playing = new Set((await this.db.select({ id: roomMembers.accountId }).from(roomMembers).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.playing, true)))).map(r => r.id));
    if (D.allValidated(rt.disk, this.candidates(rt, playing))) await this.diskReveal(rt);   // everyone validated: no need to wait
  }

  /** The end of the answer time (or everyone validated): the points, the Palmarès, the pending rules. */
  private async diskReveal(rt: RoomRt) {
    if (rt.disk.phase !== 'guessing') return;
    if (rt.diskTimer) { clearTimeout(rt.diskTimer); rt.diskTimer = null; }
    const r = D.reveal(rt.disk);
    rt.disk = r.state;
    for (const [id, pts] of Object.entries(r.points)) if (pts) await this.db.update(roomMembers).set({ score: sql`${roomMembers.score} + ${pts}` }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, id)));
    const top = Math.max(0, ...Object.values(r.state.results).map(x => x.points));
    for (const [id, x] of Object.entries(r.state.results)) await this.db.insert(palmares).values({ roomId: rt.room.id, game: 'disk', data: { account: id, won: x.points === top && top > 0, pts: x.points, perfect: x.perfect } });
    await this.saveDisk(rt);
    await this.emitDisk(rt);
    for (const id of Object.keys(r.points)) await this.emitMember(rt, id);
    if (r.best) { const [b] = await this.members(rt, r.best[0]); await this.say(rt, null, `${b?.name ?? '?'} gagne le tour (+${r.best[1].points}${r.best[1].perfect ? ', perfect !' : ''})`); }
  }

  async diskNext(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.disk.phase === 'guessing') throw new UserError('Le tour n\'est pas fini.');
    rt.disk = D.nextRound(rt.disk);
    await this.saveDisk(rt);
    await this.emitDisk(rt);
  }

  async diskReset(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.diskTimer) { clearTimeout(rt.diskTimer); rt.diskTimer = null; }
    await this.db.update(roomMembers).set({ score: 0 }).where(eq(roomMembers.roomId, rt.room.id));
    rt.disk = { ...D.newDisk(rt.disk.rules), round: 1 };
    await this.saveDisk(rt);
    await this.emitDisk(rt);
    for (const id of rt.members.keys()) await this.emitMember(rt, id);
    await this.say(rt, null, 'La partie a été réinitialisée.');
  }

  // ---------------------------------------------------------------- Sondage
  /** What a player sees: while open, who answered and his own answer; at the results, the answers (anonymous when secret). */
  private pollView(rt: RoomRt, me: string): PollView {
    const p = rt.poll, open = p.phase === 'open';
    let answers: Record<string, PollAnswer> | null = null, outcome: PollView['outcome'] = null;
    if (p.phase === 'results' && p.poll) {
      const o = Poll.outcome({ ...p.poll, answers: p.answers } as Poll.Poll, p.host ?? '');
      if (p.secret) {
        const alias = new Map(Object.keys(p.answers).map((id, i) => [id, `r${i}`]));
        answers = Object.fromEntries(Object.entries(p.answers).map(([id, a]) => [alias.get(id)!, a]));
        outcome = { ...o, ranked: o.ranked.map(r => ({ ...r, ids: [] })) };
      } else { answers = p.answers; outcome = o; }
    }
    return { phase: p.phase, round: p.round, seconds: p.seconds, secret: p.secret, poll: p.poll, answered: Object.keys(p.answers),
      mine: p.answers[me] ?? null, answers: open ? null : answers, outcome, deadline: p.deadline };
  }
  private async emitPoll(rt: RoomRt) {
    rt.seq++;
    for (const s of await this.io.in(`room:${rt.room.id}`).fetchSockets()) s.emit('event', { type: 'poll', poll: this.pollView(rt, (s.data as SocketData).account.id), seq: rt.seq });
  }
  private async saveRules(rt: RoomRt, key: string, value: unknown) {
    const rules = { ...rt.room.rules, [key]: value };
    await this.db.update(rooms).set({ rules }).where(eq(rooms.id, rt.room.id));
    rt.room = { ...rt.room, rules };
  }
  private async playingIds(rt: RoomRt) { return new Set((await this.db.select({ id: roomMembers.accountId }).from(roomMembers).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.playing, true)))).map(r => r.id)); }

  async pollSettings(socket: Socket, v: { seconds?: number; secret?: boolean }) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (v.seconds) rt.poll.seconds = v.seconds;
    if (v.secret !== undefined) rt.poll.secret = v.secret;
    await this.saveRules(rt, 'poll', { seconds: rt.poll.seconds, secret: rt.poll.secret, round: rt.poll.round });
    await this.emitPoll(rt);
  }

  async pollPublish(socket: Socket, v: { kind: 'choices' | 'free' | 'gradient'; question: string; choices: string[]; pics: ({ mediaId?: string; stickerId?: string } | null)[] }) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.poll.phase === 'open') throw new UserError('Un sondage est déjà ouvert.');
    const choices = v.kind === 'free' ? [] : v.choices;
    const pics: (PollPicView | null)[] = [];
    if (v.kind === 'choices') for (let i = 0; i < choices.length; i++) {
      const p = v.pics[i];
      let pic: PollPicView | null = null;
      if (p?.mediaId) { const m = await this.picture(p.mediaId, 'poll'); pic = { kind: 'image', src: this.media.url(m.id), w: m.width, h: m.height }; }
      else if (p?.stickerId) {
        const [st] = await this.db.select({ m: media }).from(stickers).innerJoin(media, eq(media.id, stickers.mediaId)).where(and(eq(stickers.id, p.stickerId), eq(stickers.roomId, rt.room.id)));
        if (st) pic = { kind: 'sticker', src: this.media.url(st.m.id), w: st.m.width, h: st.m.height };
      }
      pics.push(pic);
    }
    const draft = { kind: v.kind, question: v.question, choices, pics };
    if (!Poll.ready(draft as Poll.PollDraft) || (v.kind !== 'free' && (choices.length < Poll.MIN_CHOICES))) throw new UserError('Il manque la question ou un choix.');
    if (this.activity(rt).activity !== 'poll') await this.setActivity(rt, { activity: 'poll' });
    rt.poll = { ...rt.poll, phase: 'open', poll: draft, answers: {}, host: rt.room.hostId, deadline: Date.now() + rt.poll.seconds * 1000, timer: null };
    rt.poll.timer = setTimeout(() => void this.pollClose(rt), rt.poll.seconds * 1000);
    await this.say(rt, null, `Sondage ${rt.poll.round} : « ${v.question} »`);
    await this.emitPoll(rt);
  }

  async pollAnswer(socket: Socket, answer: PollAnswer) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id, p = rt.poll;
    if (p.phase !== 'open' || !p.poll) throw new UserError('Le sondage est fermé.');
    if (me !== rt.room.hostId && !(await this.playingIds(rt)).has(me)) throw new UserError('Clique d\'abord « Participer ».');
    if (me in p.answers) throw new UserError('Tu as déjà répondu.');
    const ok = p.poll.kind === 'choices' ? typeof answer === 'number' && answer < p.poll.choices.length
      : p.poll.kind === 'free' ? typeof answer === 'string'
      : Array.isArray(answer) && answer.every(x => Number.isFinite(x) && Math.abs(x) <= 1.01) && (p.poll.choices.length > 2 || (answer[1] === 0 && answer[0] >= 0));
    if (!ok) throw new UserError('Réponse invalide.');
    p.answers[me] = answer;
    await this.emitPoll(rt);
    const playing = await this.playingIds(rt);
    const candidates = this.connected(rt).filter(id => playing.has(id) && id !== p.host);
    if (candidates.length && candidates.every(id => id in p.answers)) await this.pollClose(rt);   // every candidate answered
  }

  private async pollClose(rt: RoomRt) {
    if (rt.poll.phase !== 'open') return;
    if (rt.poll.timer) clearTimeout(rt.poll.timer);
    rt.poll = { ...rt.poll, phase: 'results', deadline: null, timer: null };
    const n = Object.keys(rt.poll.answers).length;
    await this.say(rt, null, `Sondage terminé : ${n} réponse${n > 1 ? 's' : ''}.`);
    await this.emitPoll(rt);
  }

  async pollEnd(socket: Socket) { const rt = this.roomOf(socket); this.hostOnly(rt, socket); await this.pollClose(rt); }

  async pollNext(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.poll.phase === 'open') throw new UserError('Le sondage est encore ouvert.');
    rt.poll = { ...rt.poll, phase: 'writing', round: rt.poll.round + 1, poll: null, answers: {}, host: null, deadline: null };
    await this.saveRules(rt, 'poll', { seconds: rt.poll.seconds, secret: rt.poll.secret, round: rt.poll.round });
    await this.emitPoll(rt);
  }

  // ---------------------------------------------------------------- Roulette
  private wheelView(rt: RoomRt): WheelView { const w = rt.wheel; return { phase: w.phase, items: w.items, spin: w.spin, needle: w.needle }; }
  private emitWheel(rt: RoomRt) { this.emit(rt, { type: 'wheel', wheel: this.wheelView(rt) }); }

  /** The host builds the wheel: everyone sees it as it is typed. */
  async wheelSet(socket: Socket, items: WheelView['items']) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.wheel.phase === 'spinning') throw new UserError('La roue tourne.');
    rt.wheel = { ...rt.wheel, items, phase: rt.wheel.phase === 'result' ? 'writing' : rt.wheel.phase };
    await this.saveRules(rt, 'wheel', { items, needle: rt.wheel.needle });
    this.emitWheel(rt);
  }

  /** The server draws the angle; every panel animates the same spin, the result comes after it. */
  async wheelSpin(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.wheel.phase === 'spinning') throw new UserError('La roue tourne déjà.');
    const why = Wheel.problem(rt.wheel.items);
    if (why) throw new UserError({ over: 'Le total des poids dépasse 100.', invalid: 'Un poids n\'est pas un nombre.', empty: 'Il faut au moins 2 propositions, toutes écrites.', zero: 'Tous les poids sont à 0.' }[why]);
    if (this.activity(rt).activity !== 'wheel') await this.setActivity(rt, { activity: 'wheel' });
    const spin = Wheel.draw(rt.wheel.items, Date.now(), rt.wheel.needle);
    rt.wheel = { ...rt.wheel, phase: 'spinning', spin, timer: setTimeout(() => void this.wheelStop(rt), Wheel.SPIN_MS) };
    await this.say(rt, null, 'La roue tourne…');
    this.emitWheel(rt);
  }

  private async wheelStop(rt: RoomRt) {
    const s = rt.wheel.spin;
    if (rt.wheel.phase !== 'spinning' || !s) return;
    rt.wheel = { ...rt.wheel, phase: 'result', needle: s.angle, timer: null };
    await this.saveRules(rt, 'wheel', { items: rt.wheel.items, needle: s.angle });
    const label = s.items[s.winner]?.label.trim() || `Proposition ${s.winner + 1}`;
    await this.say(rt, null, `Roulette : « ${label} » (${Math.round(s.shares[s.winner] ?? 0)} % de chances).`);
    this.emitWheel(rt);
  }

  async wheelEdit(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.wheel.phase === 'spinning') throw new UserError('La roue tourne.');
    rt.wheel = { ...rt.wheel, phase: 'writing', spin: null };
    this.emitWheel(rt);
  }

  // ---------------------------------------------------------------- the console's notices
  private onAdmin(n: AdminNotice) {
    if (n.type === 'room-deleted') {
      for (const [id, rt] of this.live) if (rt.room.key === n.key) {
        this.io.to(`room:${id}`).emit('room-gone', { key: n.key });
        this.io.in(`room:${id}`).socketsLeave(`room:${id}`);
        for (const m of rt.members.values()) if (m.grace) clearTimeout(m.grace);
        this.live.delete(id);
        this.log.log(`salon ${n.key} supprimé par un admin`);
      }
    } else if (n.type === 'code-reset') this.kickAccount(n.accountId, null);
    else if (n.type === 'message-removed') { const rt = this.live.get(n.roomId); if (rt) this.emit(rt, { type: 'message-removed', id: n.id }); }
    else if (n.type === 'members-changed' || n.type === 'room-changed') {
      for (const rt of this.live.values()) if ('roomId' in n ? rt.room.id === n.roomId : rt.room.key === n.key) void this.resync(rt);
    }
  }

  /** Something changed behind the room's back (the console): each player gets the room's full state again. */
  private async resync(rt: RoomRt) {
    const [fresh] = await this.db.select().from(rooms).where(eq(rooms.id, rt.room.id));
    if (fresh) rt.room = fresh;
    rt.seq++;
    for (const s of await this.io.in(`room:${rt.room.id}`).fetchSockets()) s.emit('state', await this.state(rt, (s.data as SocketData).account.id));
  }

  /** The account's code was replaced: its connections end (« Ce code a été remplacé »), except `keep`. */
  kickAccount(accountId: string, keep: string | null) {
    for (const s of this.io.sockets.sockets.values()) {
      if ((s.data as SocketData).account?.id !== accountId || s.id === keep) continue;
      s.emit('fatal', { reason: 'replaced' });
      s.disconnect(true);
    }
  }
}
