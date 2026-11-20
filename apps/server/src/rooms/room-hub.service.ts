// The rooms being played, in memory (openspec: realtime-sync, design decision 4): who is connected, presence with a
// 15 s grace (a page change doesn't make a player blink away), the host, numbered events. Durable facts go to Postgres.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Server, Socket } from 'socket.io';
import type postgres from 'postgres';
import { castVote, closeVote, creditWord, defaultHue, startVote, tierOf, type Vote } from '@slopesque/engines';
import * as D from '@slopesque/engines';
import { Poll, Table, Tarot, TarotAI, Tdc, Wheel, KICK_AFTER_MS } from '@slopesque/engines';
import { CARD_PLAYERS, EFFECT_MS, EFFECT_PARALLEL, ON_PHOTO, PRESENCE, SCORE_NAMES, scoreKey, type EffectKind, type EffectView, READY_ACTIVITIES, READY_CARD_GAMES, type CardsView, type PollAnswer, type PollView, type WheelView, type PollPicView, type ActivityChoice, type EmojiView, type GifRef, type MemberView, type RoomEvent, type RoomState, type StickerView } from '@slopesque/shared';
import { DB, SQL, type Db } from '../db/db.module.js';
import { ENV, type Env } from '../config/config.module.js';
import { accounts, customEmoji, media, messages, palmares, roomMembers, rooms, stickers, trumpArt } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { MediaService, type MediaRow } from '../media/media.service.js';
import { PreviewService } from '../external/preview.service.js';
import { ChatService } from '../chat/chat.service.js';
import { UserError } from '../errors.js';
import { ADMIN_CHANNEL, RoomsService, type AdminNotice, type Room } from './rooms.service.js';
import type { Account } from '../accounts/accounts.service.js';

interface MemberRt { sockets: Set<string>; awaySince: number | null; grace: NodeJS.Timeout | null }
interface PollRt { phase: PollView['phase']; round: number; seconds: number; secret: boolean; poll: PollView['poll']; answers: Record<string, PollAnswer>; host: string | null; deadline: number | null; timer: NodeJS.Timeout | null }
interface WheelRt { phase: WheelView['phase']; items: WheelView['items']; spin: WheelView['spin']; needle: number; round: number; timer: NodeJS.Timeout | null }
interface CardsRt { game: 'tdc' | 'tarot'; players: number; settings: { tdc: number; tarot: number; bots?: TarotAI.Level }; showTricks: boolean; tarot: Tarot.Tarot | null; settled: boolean; seats: Table.CardSeat[]; tdc: Tdc.Tdc | null; paid: Record<string, string | null>; turnSince: number; robot: NodeJS.Timeout | null; late: NodeJS.Timeout | null; art: Record<string, string> }
interface RoomRt { cards: CardsRt; room: Room; seq: number; members: Map<string, MemberRt>; vote: { id: number; v: Vote; timer: NodeJS.Timeout } | null; disk: D.DiskState; diskTimer: NodeJS.Timeout | null; poll: PollRt; wheel: WheelRt; fx: Record<string, number[]>; notice: { id: string; title: string; text: string; at: number } | null }
export interface SocketData { account: Account; ip: string; roomId: string | null }

@Injectable()
export class RoomHub implements OnModuleInit {
  private readonly log = new Logger('Salons');
  io!: Server;
  private readonly live = new Map<string, RoomRt>();

  constructor(@Inject(ENV) private readonly env: Env, @Inject(DB) private readonly db: Db, @Inject(SQL) private readonly sql: postgres.Sql,
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
    const ws = (room.rules.wheel ?? {}) as { items?: WheelView['items']; needle?: number; round?: number };
    const rt: RoomRt = { cards: { game: 'tdc', players: 4, settings: { tdc: 4, tarot: 4, ...((room.rules.cards as object | undefined) ?? {}) }, showTricks: true, tarot: null, settled: false, seats: [], tdc: null, paid: {}, turnSince: 0, robot: null, late: null, art: {} }, room, seq: 0, members: new Map(), vote: null, disk, diskTimer: null,
      poll: { phase: 'writing', round: ps.round ?? 1, seconds: ps.seconds ?? 300, secret: ps.secret ?? false, poll: null, answers: {}, host: null, deadline: null, timer: null },
      wheel: { phase: 'writing', items: ws.items ?? [{ label: '', weight: '' }, { label: '', weight: '' }], spin: null, needle: ws.needle ?? 0, round: ws.round ?? 1, timer: null }, fx: {}, notice: null };
    for (const a of await this.db.select().from(trumpArt).where(eq(trumpArt.roomId, room.id))) rt.cards.art[a.card] = a.mediaId;   // the trumps' pictures
    // a game running when the server stopped: cancelled, back to its first step, said in the chat and in a window
    const live = (room.rules.live ?? {}) as { cards?: string; poll?: string };
    const lost = [saved.guessing ? 'le tour du Demi-disque' : '', live.poll ? 'le sondage' : '', live.cards ? (live.cards === 'tarot' ? 'la donne de Tarot' : 'la manche du Trou du cul') : ''].filter(Boolean);
    if (saved.guessing) await this.saveDisk(rt);
    if (live.cards || live.poll) await this.saveRules(rt, 'live', {});
    if (lost.length) {
      const what = lost.join(' et '), text = `Le serveur a redémarré pendant ${what} : ${lost.length > 1 ? 'ils sont annulés' : 'la partie est annulée'}. Tout reprend à son début ; l'hôte peut relancer.`;
      rt.notice = { id: randomUUID(), title: 'Partie perdue', text, at: Date.now() };
      await this.chat.send(room.id, null, `Le serveur a redémarré : ${what} en cours ${lost.length > 1 ? 'sont annulés' : 'est annulé(e)'}.`, null, 'system');
    }
    return rt;
  }

  /** A game is running (its kind) or not (null): kept in the room's rules, to say it is lost after a restart. */
  private async setLive(rt: RoomRt, what: 'cards' | 'poll', on: string | null) {
    const live = { ...((rt.room.rules.live ?? {}) as Record<string, string>) };
    if (on) live[what] = on; else delete live[what];
    await this.saveRules(rt, 'live', live);
  }

  /** The activity changes during a round: the rounds of the other activities are cancelled (the host's choice, said in
   *  the chat); the activity chosen keeps its own (a round that just started switches to its activity). */
  private async cancelRunning(rt: RoomRt, to: ActivityChoice) {
    const lost: string[] = [];
    if (rt.disk.phase === 'guessing' && to.activity !== 'disk') {
      if (rt.diskTimer) { clearTimeout(rt.diskTimer); rt.diskTimer = null; }
      rt.disk = { ...D.newDisk({ ...rt.disk.rules, ...rt.disk.pending }), round: rt.disk.round, phase: 'writing' };
      await this.saveDisk(rt); await this.emitDisk(rt);
      lost.push('le tour du Demi-disque');
    }
    if (rt.poll.phase === 'open' && to.activity !== 'poll') {
      if (rt.poll.timer) clearTimeout(rt.poll.timer);
      rt.poll = { ...rt.poll, phase: 'writing', poll: null, answers: {}, host: null, deadline: null, timer: null };
      await this.setLive(rt, 'poll', null); await this.emitPoll(rt);
      lost.push('le sondage');
    }
    if (rt.wheel.phase === 'spinning' && to.activity !== 'wheel') {
      if (rt.wheel.timer) clearTimeout(rt.wheel.timer);
      rt.wheel = { ...rt.wheel, phase: 'writing', spin: null, timer: null };
      this.emitWheel(rt);
      lost.push('le tirage');
    }
    if (this.inRound(rt) && (to.activity !== 'cards' || (to.cardGame ?? 'tdc') !== rt.cards.game)) {
      const c = rt.cards;
      if (c.robot) { clearTimeout(c.robot); c.robot = null; }
      if (c.late) { clearTimeout(c.late); c.late = null; }
      lost.push(c.game === 'tarot' ? 'la donne de Tarot' : 'la manche du Trou du cul');
      c.tdc = null; c.tarot = null; c.paid = {}; c.settled = false;
      await this.setLive(rt, 'cards', null); await this.emitCards(rt);
    }
    return lost;
  }

  // ---------------------------------------------------------------- join / leave
  async join(socket: Socket, key: string, after?: number): Promise<RoomState> {
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
    if (!existing) await this.say(rt, null, `${data.account.name} rejoint le salon.`, null, true);
    if (!wasHere || !existing) await this.emitMember(rt, me);
    return this.state(rt, me, after);
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
  async state(rt: RoomRt, me: string, after?: number): Promise<RoomState> {
    return { seq: rt.seq, room: { key: rt.room.key, name: rt.room.name, createdAt: rt.room.createdAt.getTime() }, me, hostId: rt.room.hostId,
      members: await this.members(rt), chat: after ? await this.chat.since(rt.room.id, rt.room.createdAt, after) : await this.chat.page(rt.room.id, rt.room.createdAt), serverTime: Date.now(),
      stickers: await this.stickerViews(rt), emoji: await this.emojiViews(rt), activity: this.activity(rt), scope: this.scope(rt),
      notice: rt.notice && Date.now() - rt.notice.at < 30 * 60_000 ? { id: rt.notice.id, title: rt.notice.title, text: rt.notice.text } : null, disk: D.diskView(rt.disk, me),
      poll: this.pollView(rt, me), wheel: this.wheelView(rt), cards: this.cardsView(rt, me), web: (rt.room.rules.web as Record<string, string> | undefined) ?? {} };
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
      return { id: a.id, name: a.name, hue: m.hue, photo: m.photoId && known.has(m.photoId) ? this.media.url(m.photoId) : null, presence, awaySince, playing: m.playing, scores: m.scores, credit: m.credit, joinedAt: m.joinedAt.getTime() };
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
  /** A message; from the room (null), it belongs to the activity being played (shown during it only) unless general. */
  async say(rt: RoomRt, from: string | null, text: string, replyTo: number | null = null, general = false) {
    const message = await this.chat.send(rt.room.id, from, text, replyTo, from ? 'text' : 'system', from || general ? null : this.scope(rt));
    this.emit(rt, { type: 'message', message });
    if (from) this.preview(rt, message.id, text);
    return message;
  }

  /** The first link's preview of a player's text, when its site gives one (it arrives after the message). */
  private preview(rt: RoomRt, id: number, text: string) {
    if (!text) return;
    void this.previews.forText(text).then(async p => {
      if (!p) return;
      const updated = await this.chat.setPreview(id, p);
      if (updated && this.live.get(rt.room.id) === rt) this.emit(rt, { type: 'message-updated', message: updated });
    });
  }

  // ---------------------------------------------------------------- pictures
  /** A picture just uploaded, for this usage (an upload is only good for the usage of its ticket). */
  async picture(id: string, usage: string): Promise<MediaRow> {
    const row = await this.media.get(id);
    if (!row || row.usage !== usage) throw new UserError('Image introuvable : envoie-la de nouveau.');
    return row;
  }

  /** A picture in the chat, with what was written with it (and the message it answers). */
  async sendPicture(socket: Socket, kind: 'image' | 'sticker', pic: MediaRow, replyTo: number | null = null, text = '') {
    const rt = this.roomOf(socket);
    const message = await this.chat.sendMedia(rt.room.id, (socket.data as SocketData).account.id, kind, pic, replyTo, text);
    this.emit(rt, { type: 'message', message });
    this.preview(rt, message.id, text);
  }

  async sendGif(socket: Socket, gif: GifRef, replyTo: number | null = null, text = '') {
    const rt = this.roomOf(socket);
    const message = await this.chat.sendGif(rt.room.id, (socket.data as SocketData).account.id, gif, replyTo, text);
    this.emit(rt, { type: 'message', message });
    this.preview(rt, message.id, text);
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
    const lib = await this.stickerViews(rt);
    this.emit(rt, { type: 'stickers', stickers: lib });
    if (send) await this.sendPicture(socket, 'sticker', pic);
    return lib.find(x => x.src === this.media.url(pic.id)) ?? lib[0]!;
  }

  async sendSticker(socket: Socket, id: string, replyTo: number | null = null, text = '') {
    const rt = this.roomOf(socket);
    const [s] = await this.db.select().from(stickers).where(and(eq(stickers.id, id), eq(stickers.roomId, rt.room.id)));
    if (!s) throw new UserError('Ce sticker n\'existe plus.');
    await this.db.update(stickers).set({ usedAt: new Date() }).where(eq(stickers.id, id));
    this.emit(rt, { type: 'stickers', stickers: await this.stickerViews(rt) });
    await this.sendPicture(socket, 'sticker', (await this.media.get(s.mediaId))!, replyTo, text);
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
    await this.say(rt, null, `${a.name} a ajouté l'emoji :${name}: pour tout le salon.`, null, true);
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
    await this.say(rt, null, `${target.name} devient l'hôte.`, null, true);
  }

  // ---------------------------------------------------------------- activity, votes, host, social credit
  activity(rt: RoomRt): ActivityChoice { return (rt.room.rules.activity as ActivityChoice | undefined) ?? { activity: 'chat' }; }
  /** The session of the activity: a new one each time an activity is chosen. */
  scope(rt: RoomRt) { return `${this.activity(rt).activity}#${(rt.room.rules.scope as number | undefined) ?? 0}`; }

  private async setActivity(rt: RoomRt, choice: ActivityChoice) {
    const before = this.activity(rt);
    if (before.activity !== choice.activity || (choice.activity === 'cards' && (before.cardGame ?? 'tdc') !== (choice.cardGame ?? 'tdc'))) {
      const lost = await this.cancelRunning(rt, choice);
      if (lost.length) await this.say(rt, null, `Changement d'activité : ${lost.join(' et ')} en cours ${lost.length > 1 ? 'sont annulés' : 'est annulé(e)'}.`, null, true);
    }
    if (choice.cardGame === 'tarot' && choice.tarotPlayers) rt.cards.settings = { ...rt.cards.settings, tarot: choice.tarotPlayers };
    if (choice.activity === 'cards') this.prepareTable(rt, choice.cardGame === 'tarot' ? 'tarot' : 'tdc');
    if (choice.activity === 'disk' && choice.mode && choice.mode !== { ...rt.disk.rules, ...rt.disk.pending }.mode) {   // the format chosen: its voting mode
      rt.disk = D.setRules(rt.disk, { mode: choice.mode }).state;
      await this.saveDisk(rt);
      await this.emitDisk(rt);
    }
    rt.room = { ...rt.room, rules: { ...rt.room.rules, activity: choice, scope: ((rt.room.rules.scope as number | undefined) ?? 0) + 1 } };   // a new session
    await this.db.update(rooms).set({ rules: rt.room.rules }).where(eq(rooms.id, rt.room.id));
    this.emit(rt, { type: 'activity', activity: choice, scope: this.scope(rt) });
    if (choice.activity === 'cards') await this.emitCards(rt);
  }

  /** The table of a card game, before its first deal (or another number of seats): the players already seated keep
   *  their seat, robots on the others; players take a seat before the host deals (the robots wait for the deal). */
  private prepareTable(rt: RoomRt, game: 'tdc' | 'tarot') {
    const c = rt.cards, n = c.settings[game];
    if (this.inRound(rt) && c.game === game) return;
    if (c.game === game && c.seats.length === n) return;
    const seated = c.seats.map(s => s.user).filter((u): u is string => !!u).slice(0, n);
    c.seats = Table.seatTable(seated, n).slice(0, n);
    c.game = game; c.players = n; c.tdc = null; c.tarot = null; c.paid = {};
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
      await this.say(rt, null, `${m?.name ?? '?'} devient l'hôte (vote accepté).`, null, true);
    } else if (v.kind === 'activity' && v.choice) await this.setActivity(rt, v.choice as ActivityChoice);
    else if (v.kind === 'kick' && v.target) {
      const [m] = await this.members(rt, v.target);
      await this.say(rt, null, `${m?.name ?? '?'} doit quitter la table : vote accepté.`);
      await this.tableLeaveOf(rt, v.target);
    }
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
      await this.say(rt, null, `${me.name} devient l'hôte : ${host ? `${host.name} n'était plus là depuis ${mins} min` : 'l\'hôte avait quitté le salon'}.`, null, true);
      return 'taken';
    }
    await this.launch(rt, { kind: 'host', by: me.id, target: me.id, label: `demande à devenir l'hôte, à la place de ${host.name}` });
    return 'vote';
  }

  /** /activity: the host changes it at once; another player proposes it to a vote. */
  async chooseActivity(socket: Socket, choice: ActivityChoice, label: string): Promise<'applied' | 'vote'> {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account;
    if (!READY_ACTIVITIES.includes(choice.activity) || (choice.activity === 'cards' && !READY_CARD_GAMES.includes(choice.cardGame ?? 'tdc'))) throw new UserError('Cette activité arrive bientôt.');
    if (rt.room.hostId === me.id) {
      await this.setActivity(rt, choice);
      await this.say(rt, null, `${me.name} passe à ${label}.`, null, true);
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
    await this.saveRules(rt, 'disk', { rules: { ...rt.disk.rules, ...rt.disk.pending }, round: rt.disk.round, guessing: rt.disk.phase === 'guessing' });
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
    for (const [id, pts] of Object.entries(r.points)) if (pts) await this.addScore(rt, id, 'disk', pts);
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

  /** A player's points in one game's ranking (disk, tdc, tarot). */
  private async addScore(rt: RoomRt, user: string, game: string, pts: number) {
    await this.db.update(roomMembers).set({ scores: sql`jsonb_set(${roomMembers.scores}, ${`{${game}}`}::text[], to_jsonb(coalesce((${roomMembers.scores}->>${game})::int, 0) + ${pts}::int))` })
      .where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, user)));
  }

  /** « Réinitialiser la partie »: the ranking of the game being played back to zero (the others, and the Palmarès, kept);
   *  the Demi-disque also starts again from its first round. */
  async gameReset(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    const key = scoreKey(this.activity(rt));
    if (!key) throw new UserError('Cette activité n\'a pas de classement.');
    await this.db.update(roomMembers).set({ scores: sql`${roomMembers.scores} - ${key}::text` }).where(eq(roomMembers.roomId, rt.room.id));
    if (key === 'disk') {
      if (rt.diskTimer) { clearTimeout(rt.diskTimer); rt.diskTimer = null; }
      rt.disk = { ...D.newDisk(rt.disk.rules), round: 1 };
      await this.saveDisk(rt);
      await this.emitDisk(rt);
    }
    for (const m of await this.members(rt)) await this.emitMember(rt, m.id);   // the absent ones too
    await this.say(rt, null, `Le classement ${SCORE_NAMES[key]} est remis à zéro (le palmarès est gardé).`);
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
  /** A part of the room's rules changed: in memory first, then the whole of them written — two writes at the same
   *  time can't put back an older copy (each writes the latest). */
  private async saveRules(rt: RoomRt, key: string, value: unknown) {
    rt.room = { ...rt.room, rules: { ...rt.room.rules, [key]: value } };
    await this.db.update(rooms).set({ rules: rt.room.rules }).where(eq(rooms.id, rt.room.id));
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

  async pollPublish(socket: Socket, v: { kind: 'choices' | 'free' | 'gradient'; question: string; choices: string[]; pics: ({ mediaId?: string; stickerId?: string; gif?: GifRef } | null)[] }) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.poll.phase === 'open') throw new UserError('Un sondage est déjà ouvert.');
    const choices = v.kind === 'free' ? [] : v.choices;
    const pics: (PollPicView | null)[] = [];
    if (v.kind === 'choices') for (let i = 0; i < choices.length; i++) {
      const p = v.pics[i];
      let pic: PollPicView | null = null;
      if (p?.gif) pic = { kind: 'gif', src: p.gif.url, w: p.gif.w, h: p.gif.h };   // a link to its provider, as in the chat
      else if (p?.mediaId) { const m = await this.picture(p.mediaId, 'poll'); pic = { kind: 'image', src: this.media.url(m.id), w: m.width, h: m.height }; }
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
    await this.setLive(rt, 'poll', v.question);
    await this.media.keepFor(v.pics.flatMap(p => (p?.mediaId ? [p.mediaId] : [])), rt.poll.seconds * 1000);   // not swept before the poll's end
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
    await this.setLive(rt, 'poll', null);
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
  private wheelView(rt: RoomRt): WheelView { const w = rt.wheel; return { phase: w.phase, items: w.items, spin: w.spin, needle: w.needle, round: w.round }; }
  private emitWheel(rt: RoomRt) { this.emit(rt, { type: 'wheel', wheel: this.wheelView(rt) }); }

  /** The host builds the wheel: everyone sees it as it is typed. */
  async wheelSet(socket: Socket, items: WheelView['items']) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.wheel.phase === 'spinning') throw new UserError('La roue tourne.');
    const after = rt.wheel.phase === 'result';   // changed after a draw: the next one
    rt.wheel = { ...rt.wheel, items, phase: after ? 'writing' : rt.wheel.phase, round: rt.wheel.round + (after ? 1 : 0) };
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
    await this.saveRules(rt, 'wheel', { items: rt.wheel.items, needle: s.angle, round: rt.wheel.round + 1 });
    const label = s.items[s.winner]?.label.trim() || `Proposition ${s.winner + 1}`;
    await this.say(rt, null, `Roulette : « ${label} » (${Math.round(s.shares[s.winner] ?? 0)} % de chances).`);
    this.emitWheel(rt);
  }

  async wheelEdit(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (rt.wheel.phase === 'spinning') throw new UserError('La roue tourne.');
    rt.wheel = { ...rt.wheel, phase: 'writing', spin: null, round: rt.wheel.round + (rt.wheel.phase === 'result' ? 1 : 0) };   // the next draw
    this.emitWheel(rt);
  }

  // ---------------------------------------------------------------- integrations (Low Tide)
  /** The host saves an integration's address (checked in his panel: the page declares the integration's name). */
  async setWeb(socket: Socket, integration: string, url: string) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    const u = new URL(url), local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new UserError('L\'adresse doit commencer par https:// (http:// seulement pour localhost).');
    const web = { ...((rt.room.rules.web as Record<string, string> | undefined) ?? {}), [integration]: u.href };
    await this.saveRules(rt, 'web', web);
    this.emit(rt, { type: 'web', web });
    await this.say(rt, null, `Nouvelle adresse pour Low Tide : ${u.host}`);
  }

  // ---------------------------------------------------------------- Palmarès
  /** The room's results (the last 5 000), with each player's current name and colour. */
  async palmares(socket: Socket) {
    const rt = this.roomOf(socket);
    const rows = await this.db.execute<{ at: string; game: string; data: Record<string, unknown>; name: string | null; hue: number | null }>(sql`
      select p.at, p.game, p.data, a.name, m.hue from palmares p
      left join accounts a on a.id = (p.data->>'account')::uuid
      left join room_members m on m.room_id = p.room_id and m.account_id = (p.data->>'account')::uuid
      where p.room_id = ${rt.room.id} order by p.at desc limit 5000`);
    return rows.map(r => ({ ...(r.data as object), at: new Date(r.at).getTime(), game: r.game, id: String(r.data.account), name: r.name ?? '?', hue: r.hue ?? 0, won: !!r.data.won })) as import('@slopesque/shared').PalmaresEvent[];
  }

  // ---------------------------------------------------------------- Cartes: the Trou du cul
  /** What a player sees: the seats, his own hand (the others' as backs), the last round's points, the late seat. */
  private cardsView(rt: RoomRt, me: string): CardsView {
    const c = rt.cards, mine = Table.seatOfUser(c.seats, me)?.id ?? null;
    return { game: c.game, players: c.players, settings: c.settings, showTricks: c.showTricks, seats: c.seats, tdc: c.tdc ? Tdc.tdcView(c.tdc, mine) : null,
      tarot: c.tarot ? Tarot.tarotView(c.tarot, mine) : null, paid: c.paid, turnSince: c.turnSince, late: this.lateSeat(rt),
      art: Object.fromEntries(Object.entries(c.art).map(([n, id]) => [n, this.media.url(id)])) };
  }
  private async emitCards(rt: RoomRt) {
    rt.seq++;
    for (const s of await this.io.in(`room:${rt.room.id}`).fetchSockets()) s.emit('event', { type: 'cards', cards: this.cardsView(rt, (s.data as SocketData).account.id), seq: rt.seq });
  }
  private async seatName(rt: RoomRt, seat: string) {
    const s = rt.cards.seats.find(x => x.id === seat), uid = s ? s.user ?? s.credit : null;
    if (!uid) return s?.bot ?? '?';
    return (await this.members(rt, uid))[0]?.name ?? '?';
  }
  /** The player whose turn has lasted 30 s or more (a player, not a robot): /kick may propose to make him leave. */
  private lateSeat(rt: RoomRt) {
    const t = rt.cards.game === 'tarot' ? rt.cards.tarot : rt.cards.tdc, s = t && t.turn !== null ? rt.cards.seats.find(x => x.id === t.turn) : null;
    if (!s?.user || Date.now() - rt.cards.turnSince < KICK_AFTER_MS) return null;
    return { seat: s.id, user: s.user, secs: Math.floor((Date.now() - rt.cards.turnSince) / 1000) };
  }

  /** A new round (host): the first seats the players who joined (« Participer »), robots up to 3; then the same seats. */
  async cardsDeal(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    const choice = this.activity(rt);
    if (choice.cardGame === 'tarot') return this.tarotDeal(rt, rt.cards.settings.tarot as 4 | 5);
    const c = rt.cards;
    if (c.game === 'tdc' && c.tdc && c.tdc.turn !== null) throw new UserError('Une manche est en cours.');
    const n = c.settings.tdc, fresh = c.game !== 'tdc' || c.seats.length !== n || !c.tdc;   // a new table, or another number of seats
    this.prepareTable(rt, 'tdc');
    c.players = n;
    c.seats = c.seats.map(s => ({ ...s, credit: s.user }));
    c.paid = {};
    const names = new Map<string, string>();
    for (const s of c.seats) names.set(s.id, await this.seatName(rt, s.id));
    c.tdc = Tdc.deal(c.seats.map(s => s.id), fresh ? null : c.tdc, id => names.get(id) ?? '?');
    await this.setLive(rt, 'cards', 'tdc');
    c.settled = false;
    c.turnSince = Date.now();
    if (this.activity(rt).activity !== 'cards') await this.setActivity(rt, { activity: 'cards', cardGame: 'tdc' });
    const robots = c.seats.filter(s => !s.user).length;
    await this.say(rt, null, `Trou du cul, manche ${c.tdc.round} : ${c.seats.length} places${robots ? `, dont ${robots} robot${robots > 1 ? 's' : ''}` : ''}.`);
    for (const e of c.tdc.exchanges) await this.say(rt, null, `Échange : ${e}`);
    await this.afterMove(rt);
  }

  async cardsMove(socket: Socket, move: { play: string[] } | { pass: true }) {
    if (this.roomOf(socket).cards.game === 'tarot') return 'play' in move ? this.tarotDo(socket, { play: move.play[0]! }) : undefined;
    const rt = this.roomOf(socket), c = rt.cards, t = c.tdc, me = (socket.data as SocketData).account.id;
    const seat = Table.seatOfUser(c.seats, me);
    if (!t || !seat) throw new UserError('Tu n\'es pas à la table.');
    if (t.turn !== seat.id) throw new UserError('Ce n\'est pas ton tour.');
    const ok = 'play' in move ? Tdc.play(t, seat.id, t.hands[seat.id]!.filter(x => move.play.includes(x.id)).slice(0, move.play.length)) : Tdc.pass(t, seat.id);
    if (!ok) throw new UserError('pass' in move ? 'Tu ouvres le pli : tu ne peux pas passer.' : 'Pas jouable : autant de cartes que le pli, de même valeur, plus fortes.');
    await this.afterMove(rt);
  }

  /** After a move: the clock of the turn, the end of the round (points to the last player of each seat), the robots. */
  private async afterMove(rt: RoomRt, before: string | null = null) {
    if (rt.cards.game === 'tarot') return this.afterTarot(rt, before);
    const c = rt.cards, t = c.tdc;
    if (!t) { await this.emitCards(rt); return; }   // before the first deal: the seats changed
    if (t.turn !== before) c.turnSince = Date.now();
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
    if (t.turn === null && !c.settled) {   // the round's end, counted once
      c.settled = true;
      await this.setLive(rt, 'cards', null);
      for (const sid of t.out) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, role = t.roles[sid]!;
        c.paid[sid] = uid;
        if (!uid) continue;
        await this.addScore(rt, uid, 'tdc', Tdc.ROLES[role].points);
        await this.db.insert(palmares).values({ roomId: rt.room.id, game: 'tdc', data: { account: uid, won: role === 'president', role } });
        await this.emitMember(rt, uid);
      }
      const parts = [];
      for (const sid of t.out) parts.push(`${await this.seatName(rt, sid)} ${Tdc.ROLES[t.roles[sid]!].name}`);
      await this.say(rt, null, `Manche ${t.round} : ${parts.join(', ')}.`);
      const settled = Table.settle(c.seats);
      c.seats = settled.seats;
      for (const u of settled.freed) { const [m] = await this.members(rt, u); await this.say(rt, null, `${m?.name ?? '?'} a quitté la table : un robot prend sa place.`); }
    } else if (t.turn !== null) {
      const s = c.seats.find(x => x.id === t.turn);
      const opens = !t.trick.length && t.lastTrick.length > 0;   // a trick just taken: seen a moment before the next lead
      if (!s?.user) c.robot = setTimeout(() => void this.robotPlays(rt), this.env.ROBOT_DELAY_MS * (opens ? 1.6 : 1));   // a robot plays this seat
      else c.late = setTimeout(() => void this.emitCards(rt), KICK_AFTER_MS + 200);   // 30 s: the « Exclure ? » button appears
    }
    await this.emitCards(rt);
  }

  private async robotPlays(rt: RoomRt) {
    const t = rt.cards.tdc;
    if (!t || t.turn === null || rt.cards.seats.find(s => s.id === t.turn)?.user) return;
    const turn = t.turn, m = Tdc.botMove(t, turn);
    if ('play' in m) Tdc.play(t, turn, m.play); else Tdc.pass(t, turn);
    await this.afterMove(rt, turn);
  }

  /** Watching: take a seat a robot plays (my own first); its hand and this round's points become mine. */
  async tableJoin(socket: Socket): Promise<'ok' | 'full'> {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account;
    const r = Table.join(rt.cards.seats, me.id);
    if (r === 'seated') return 'ok';
    if (r === 'full') return 'full';
    rt.cards.seats = r.seats;
    await this.setPlaying(rt, me.id, true);   // seated: a player, not a spectator
    const inRound = this.inRound(rt);
    await this.say(rt, null, r.was.owner === me.id ? `${me.name} reprend sa place.` : `${me.name} prend la place de ${r.was.name}${inRound ? ' et joue sa main en cours : les points de la manche seront les siens' : ''}.`);
    await this.afterMove(rt, this.turnOf(rt));
    return 'ok';
  }

  async tableLeave(socket: Socket) { await this.tableLeaveOf(this.roomOf(socket), (socket.data as SocketData).account.id); }

  private async tableLeaveOf(rt: RoomRt, user: string) {
    if (!Table.seatOfUser(rt.cards.seats, user)) return;
    const inRound = this.inRound(rt);
    rt.cards.seats = Table.leave(rt.cards.seats, user, inRound);
    await this.setPlaying(rt, user, false);
    const [m] = await this.members(rt, user);
    await this.say(rt, null, inRound ? `${m?.name ?? '?'} quitte la table : un robot finit la manche à sa place (les points de la manche restent les siens).` : `${m?.name ?? '?'} quitte la table : un robot prend sa place.`);
    await this.afterMove(rt, this.turnOf(rt));
  }

  private async setPlaying(rt: RoomRt, user: string, playing: boolean) {
    await this.db.update(roomMembers).set({ playing }).where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, user)));
    await this.emitMember(rt, user);
  }

  /** /kick (or the button on his seat): a vote to make the late player leave the table. */
  async askKick(socket: Socket, name?: string): Promise<'vote'> {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id;
    if (this.activity(rt).activity !== 'cards' || !this.inRound(rt)) throw new UserError('/kick sert pendant une partie de cartes.');
    const late = this.lateSeat(rt);
    const lateName = late ? (await this.members(rt, late.user))[0]?.name ?? '?' : '';
    if (name && (!late || lateName.toLowerCase() !== name.toLowerCase())) throw new UserError(`${name} ne fait pas attendre la table : seul le joueur dont le tour dure depuis 30 s peut être exclu.`);
    if (!late) throw new UserError('Personne ne fait attendre la table : /kick vise le joueur dont le tour dure depuis 30 s.');
    await this.launch(rt, { kind: 'kick', by: me, target: late.user, label: `propose d'exclure ${lateName} de la table : son tour dure depuis ${late.secs} s` });
    return 'vote';
  }

  // ---------------------------------------------------------------- Cartes: the Tarot
  private inRound(rt: RoomRt) { const c = rt.cards; return c.game === 'tarot' ? !!c.tarot && c.tarot.phase !== 'done' : !!c.tdc && c.tdc.turn !== null; }
  private turnOf(rt: RoomRt) { const c = rt.cards; return (c.game === 'tarot' ? c.tarot?.turn : c.tdc?.turn) ?? null; }

  /** A new deal at 4 or 5: the same seats while the number holds; robots take the free ones. */
  private async tarotDeal(rt: RoomRt, n: 4 | 5) {
    const c = rt.cards;
    if (c.game === 'tarot' && c.tarot && c.tarot.phase !== 'done') throw new UserError('Une donne est en cours.');
    if (c.game !== 'tarot' || c.players !== n || c.seats.length !== n) { c.settings = { ...c.settings, tarot: n }; this.prepareTable(rt, 'tarot'); }
    c.game = 'tarot'; c.players = n; c.tdc = null;
    c.seats = c.seats.map(s => ({ ...s, credit: s.user }));
    c.paid = {}; c.settled = false;
    c.tarot = Tarot.deal(c.seats.map(s => s.id), c.tarot);
    await this.setLive(rt, 'cards', 'tarot');
    c.turnSince = Date.now();
    const names = [];
    for (const s of c.tarot.seats) names.push(await this.seatName(rt, s));
    await this.say(rt, null, `Tarot à ${n}, donne ${c.tarot.deal} : ${names.join(', ')}.`);
    await this.afterTarot(rt);
  }

  /** A player's bid, call, écart or card (checked by the rules), then what follows. */
  async tarotDo(socket: Socket, act: { bid: Tarot.Bid } | { call: string } | { discard: string[] } | { play: string }) {
    const rt = this.roomOf(socket), c = rt.cards, t = c.tarot, me = (socket.data as SocketData).account.id;
    const seat = Table.seatOfUser(c.seats, me);
    if (!t || !seat || c.game !== 'tarot') throw new UserError('Tu n\'es pas à la table.');
    const hand = t.hands[seat.id] ?? [];
    await this.tarotApply(rt, seat.id, 'bid' in act ? act : 'call' in act ? act
      : 'discard' in act ? { discard: hand.filter(x => act.discard.includes(x.id)) } : { play: hand.find(x => x.id === act.play)! });
  }

  private async tarotApply(rt: RoomRt, seat: string, act: { bid: Tarot.Bid } | { call: string } | { discard: Tarot.TCard[] } | { play: Tarot.TCard }) {
    const t = rt.cards.tarot!, before = t.phase, revealed = t.revealed, turn = t.turn;
    const ok = 'bid' in act ? Tarot.bid(t, seat, act.bid) : 'call' in act ? Tarot.call(t, seat, act.call)
      : 'discard' in act ? (seat === t.taker && Tarot.discard(t, act.discard)) : !!act.play && Tarot.play(t, seat, act.play);
    if (!ok) throw new UserError('bid' in act ? 'Enchère impossible.' : 'call' in act ? 'Carte impossible à appeler.' : 'discard' in act ? `Écart impossible : ${Tarot.ecartSize(t)} cartes, ni Roi ni bout.` : 'Carte impossible : fournis la couleur, sinon coupe (en montant si tu peux).');
    const name = (id: string) => this.seatName(rt, id);
    if (before === 'bid' && t.phase !== 'bid') await this.say(rt, null, t.taker ? `${await name(t.taker)} prend : ${Tarot.BIDS[t.bid!].name}.` : t.note);
    if ('call' in act && t.called) await this.say(rt, null, `${await name(seat)} appelle ${Tarot.cardName(t.called)}.`);
    if (before !== 'play' && t.phase === 'play' && t.taker && !rt.cards.seats.find(s => s.id === t.taker)?.user
      && TarotAI.aiChelem(Tarot.tarotView(t, t.taker), t.taker, rt.cards.settings.bots ?? 'moyen') && Tarot.announceChelem(t, t.taker)) {
      await this.say(rt, null, `${await name(t.taker)} annonce un chelem : tous les plis !`);
    }
    if (!revealed && t.revealed && t.partner) await this.say(rt, null, `${await name(t.partner)} joue ${Tarot.cardName(t.called!)} : ${t.partner === t.taker ? 'seul contre 4' : `partenaire de ${await name(t.taker!)}`}.`);
    // the tables show it before the robots go on: the take (2 s), the called card (2,8 s), the trick taken (2 s)
    const pause = before === 'bid' && t.taker ? 2.6 : 'call' in act ? 3.4 : 'play' in act && !t.trick.length ? 2.4 : 1;
    await this.afterTarot(rt, turn, pause);
  }

  /** After a step: the deal's end (each mark to the last player of each seat), the robots (on their seat's view). */
  private async afterTarot(rt: RoomRt, before: string | null = null, pause = 1) {
    const c = rt.cards, t = c.tarot;
    if (!t) { await this.emitCards(rt); return; }   // before the first deal: the seats changed
    if (t.turn !== before) c.turnSince = Date.now();
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
    if (t.phase === 'done' && t.result && !c.settled) {
      c.settled = true;
      await this.setLive(rt, 'cards', null);
      const r = t.result;
      for (const sid of t.seats) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, mark = r.marks[sid] ?? 0;
        c.paid[sid] = uid;
        if (!uid) continue;
        await this.addScore(rt, uid, 'tarot', mark);
        await this.db.insert(palmares).values({ roomId: rt.room.id, game: 'tarot', data: { account: uid, won: mark > 0, pts: mark, taker: sid === r.taker, partner: sid === r.partner } });
        await this.emitMember(rt, uid);
      }
      await this.say(rt, null, `${await this.seatName(rt, r.taker)} ${r.won ? 'gagne' : 'chute'} sa ${Tarot.BIDS[r.bid].name} (${String(r.made).replace('.', ',')} points pour ${r.need}) : ${(r.marks[r.taker] ?? 0) > 0 ? '+' : ''}${r.marks[r.taker] ?? 0}.`);
      const settled = Table.settle(c.seats);
      c.seats = settled.seats;
    } else if (t.phase === 'done' && !t.result) {   // everyone passed: a new deal, the same seats
      c.robot = setTimeout(() => { if (rt.cards.tarot === t) void this.tarotDeal(rt, c.players as 4 | 5).catch(() => {}); }, Math.max(1500, this.env.ROBOT_DELAY_MS));
    } else if (t.phase !== 'done' && t.turn !== null) {
      const who = t.phase === 'dog' ? t.taker : t.turn, s = c.seats.find(x => x.id === who);
      if (who && !s?.user) c.robot = setTimeout(() => void this.tarotRobot(rt), this.env.ROBOT_DELAY_MS * Math.max(pause, t.phase === 'dog' ? 2 : 1));
      else if (s?.user) c.late = setTimeout(() => void this.emitCards(rt), KICK_AFTER_MS + 200);
    }
    await this.emitCards(rt);
  }

  private async tarotRobot(rt: RoomRt) {
    const t = rt.cards.tarot;
    if (!t || t.phase === 'done') return;
    const seat = t.phase === 'dog' ? t.taker! : t.turn!;
    if (rt.cards.seats.find(s => s.id === seat)?.user) return;
    const view = Tarot.tarotView(t, seat), level = rt.cards.settings.bots ?? 'moyen';   // a robot plays on what its seat may see, at the host's level
    const d = TarotAI.decide(view, seat, level, Math.random, Tarot.play);
    if ('play' in d && d.handful && Tarot.declareHandful(t, seat, d.handful)) await this.sayHandful(rt, seat);
    await this.tarotApply(rt, seat, d).catch(() => { /* a robot never makes an illegal move */ });
  }

  /** A poignée shown: said in the chat, its trumps seen by everyone (the table shows them a moment). */
  private async sayHandful(rt: RoomRt, seat: string) {
    const h = rt.cards.tarot!.handfuls[seat]!;
    await this.say(rt, null, `${await this.seatName(rt, seat)} montre une ${Tarot.HANDFUL_NAMES[h.level - 1]} (${h.cards.length} atouts).`);
  }

  /** A player shows a poignée, before his first card. */
  async tarotHandful(socket: Socket, level: 1 | 2 | 3) {
    const rt = this.roomOf(socket), t = rt.cards.tarot, seat = Table.seatOfUser(rt.cards.seats, (socket.data as SocketData).account.id);
    if (!t || !seat || !Tarot.declareHandful(t, seat.id, level)) throw new UserError(`Poignée impossible : ${Tarot.handfulSizes(t?.seats.length ?? 4)[level - 1]} atouts à montrer, avant ta première carte.`);
    await this.sayHandful(rt, seat.id);
    await this.emitCards(rt);
  }

  /** The taker announces a chelem, before the first card: he leads. */
  async tarotChelem(socket: Socket) {
    const rt = this.roomOf(socket), t = rt.cards.tarot, seat = Table.seatOfUser(rt.cards.seats, (socket.data as SocketData).account.id);
    if (!t || !seat || !Tarot.announceChelem(t, seat.id)) throw new UserError('Le chelem s\'annonce par le preneur, avant la première carte.');
    await this.say(rt, null, `${await this.seatName(rt, seat.id)} annonce un chelem : tous les plis !`);
    await this.afterTarot(rt, null);
  }

  /** The robots' level at the Tarot (host). */
  async tarotBots(socket: Socket, level: TarotAI.Level) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    rt.cards.settings = { ...rt.cards.settings, bots: level };
    await this.saveRules(rt, 'cards', rt.cards.settings);
    await this.say(rt, null, `Robots du Tarot : niveau ${TarotAI.LEVELS[level]}.`);
    await this.emitCards(rt);
  }

  /** The host's number of seats for a game (robots complete them), from the next deal. */
  async cardsPlayers(socket: Socket, game: 'tdc' | 'tarot', players: number) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    if (!(CARD_PLAYERS[game] as readonly number[]).includes(players)) throw new UserError(game === 'tarot' ? 'Le Tarot se joue à 4 ou à 5.' : 'Le Trou du cul se joue de 3 à 8.');
    rt.cards.settings = { ...rt.cards.settings, [game]: players };
    await this.saveRules(rt, 'cards', rt.cards.settings);
    if (!this.inRound(rt)) this.prepareTable(rt, game);
    await this.say(rt, null, `${game === 'tarot' ? 'Tarot' : 'Trou du cul'} à ${players} joueurs${this.inRound(rt) ? ', à partir de la donne suivante' : ''} : des robots complètent les places libres.`);
    await this.emitCards(rt);
  }

  // ---------------------------------------------------------------- /effet (openspec: chat-activity, Effets visuels)
  /** An effect for everyone, now: checked (who, how many at once), its picture resolved (a screamer's image is relayed,
   *  never stored), sent on the « fx » channel. */
  async playEffect(socket: Socket, v: { kind: EffectKind; target?: string | null; pic?: { kind: 'image' | 'sticker' | 'gif' | 'emoji'; value: string } }) {
    const rt = this.roomOf(socket), me = (socket.data as SocketData).account.id, now = Date.now();
    const photo = ON_PHOTO.includes(v.kind), group = photo ? 'photo' : v.kind;
    const target = v.target ? (await this.members(rt, v.target))[0] : null;
    if (v.target && !target) throw new UserError('Ce joueur n\'est pas dans le salon.');
    if (photo && !target) throw new UserError(`/effet ${v.kind} vise un joueur : par exemple /effet ${v.kind} Léa.`);
    const running = (rt.fx[group] ?? []).filter(end => end > now), max = EFFECT_PARALLEL[v.kind] ?? 1;
    if (running.length >= max) throw new UserError(photo ? 'Un effet est déjà en cours sur une photo : attends sa fin.' : v.kind === 'screamer' ? 'Un screamer est déjà affiché : attends sa fin.'
      : `${max} ${v.kind === 'firework' ? 'feux d\'artifice' : 'salves de confettis'} sont déjà en cours : attends un instant.`);
    let pic: EffectView['pic'] = null;
    if (v.kind === 'screamer') {
      const p = v.pic;
      if (!p) throw new UserError('Choisis une image, un sticker, un GIF ou un emoji.');
      if (p.kind === 'image') {
        if (!/^data:image\/(webp|png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(p.value) || p.value.length > 700_000) throw new UserError('Image refusée : trop lourde ou d\'un format inconnu.');
        pic = { kind: 'image', src: p.value };   // relayed once, never stored
      } else if (p.kind === 'sticker') {
        const lib = await this.stickerViews(rt), st = lib.find(x => x.id === p.value);
        if (!st) throw new UserError('Ce sticker n\'est plus dans le salon.');
        pic = { kind: 'image', src: st.src };
      } else if (p.kind === 'gif') {
        let host = '';
        try { const u = new URL(p.value); host = u.protocol === 'https:' ? u.hostname : ''; } catch { /* not an address */ }
        if (!/(^|\.)(klipy\.com|giphy\.com)$/.test(host)) throw new UserError('GIF refusé : il doit venir de KLIPY ou GIPHY.');
        pic = { kind: 'image', src: p.value };
      } else if (p.value.startsWith(':')) {
        const e = (await this.emojiViews(rt)).find(x => `:${x.name}:` === p.value);
        if (!e) throw new UserError('Cet emoji n\'existe pas dans le salon.');
        pic = { kind: 'image', src: e.url };
      } else {
        if (p.value.length > 32 || /[<>&"]/.test(p.value)) throw new UserError('Emoji refusé.');
        pic = { kind: 'emoji', src: p.value };
      }
    }
    rt.fx[group] = [...running, now + EFFECT_MS[v.kind]];
    const effect: EffectView = { id: randomUUID(), kind: v.kind, by: me, target: target?.id ?? null, hue: target?.hue ?? null, pic };
    this.io.to(`room:${rt.room.id}`).emit('fx', effect);
  }

  /** The host dresses a trump with a picture (its « trump » format), or gives it back its default look (null). */
  async tarotArt(socket: Socket, card: number, mediaId: string | null) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    const key = String(card), old = rt.cards.art[key];
    if (mediaId) {
      const m = await this.picture(mediaId, 'trump');
      await this.db.insert(trumpArt).values({ roomId: rt.room.id, card: key, mediaId: m.id }).onConflictDoUpdate({ target: [trumpArt.roomId, trumpArt.card], set: { mediaId: m.id } });
      rt.cards.art[key] = m.id;
    } else {
      await this.db.delete(trumpArt).where(and(eq(trumpArt.roomId, rt.room.id), eq(trumpArt.card, key)));
      delete rt.cards.art[key];
    }
    if (old && old !== mediaId) void this.media.sweep([old]);   // no longer used: deleted (unless used elsewhere)
    await this.emitCards(rt);
  }

  async tarotArtReset(socket: Socket) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    const old = Object.values(rt.cards.art);
    await this.db.delete(trumpArt).where(eq(trumpArt.roomId, rt.room.id));
    rt.cards.art = {};
    if (old.length) void this.media.sweep(old);
    await this.say(rt, null, 'Les atouts reprennent leur habillage par défaut.');
    await this.emitCards(rt);
  }

  async tarotTricks(socket: Socket, show: boolean) {
    const rt = this.roomOf(socket);
    this.hostOnly(rt, socket);
    rt.cards.showTricks = show;
    await this.emitCards(rt);
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
