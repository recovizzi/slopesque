// The rooms being played (openspec: realtime-sync, game-session): joining and leaving, the full state, switching
// activity, the host, the social credit, the console's notices. The rooms in memory are the RoomRegistry's.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Socket } from 'socket.io';
import type postgres from 'postgres';
import { creditWord, defaultHue, tierOf } from '@slopesque/engines';
import { Coinche, CoincheAI, Holdem, HoldemAI, Poll, Table, Tarot, TarotAI, Tdc, Wheel, KICK_AFTER_MS } from '@slopesque/engines';
import { CARD_PLAYERS, cardGameOf, type CardGameKey, type HoldemRules, EFFECT_MS, EFFECT_PARALLEL, ON_PHOTO, PRESENCE, SCORE_NAMES, scoreKey, type EffectKind, type EffectView, READY_ACTIVITIES, READY_CARD_GAMES, type CardsView, type PollAnswer, type PollView, type WheelView, type PollPicView, type ActivityChoice, type GifRef, type RoomState } from '@slopesque/shared';
import { DB, SQL, type Db } from '../db/db.module.js';
import { ENV, type Env } from '../config/config.module.js';
import { messages, palmares, roomMembers, rooms, trumpArt } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { MediaService } from '../media/media.service.js';
import { RoomLibrary } from '../chat/library.service.js';
import { ChatService, type StoredChatPoll } from '../chat/chat.service.js';
import { UserError } from '../errors.js';
import { ADMIN_CHANNEL, RoomsService, type AdminNotice, type Room } from './rooms.service.js';
import { RoomRegistry } from './room-registry.js';
import type { RoomRt, SocketData } from './room-rt.js';
import { Votes } from './votes.service.js';
import { ACTIVITIES, type Activity } from './activity.js';
import type { RoomSlots } from './room-rt.js';

interface PollRt { phase: PollView['phase']; round: number; seconds: number; secret: boolean; poll: PollView['poll']; answers: Record<string, PollAnswer>; host: string | null; deadline: number | null; timer: NodeJS.Timeout | null }
interface WheelRt { phase: WheelView['phase']; items: WheelView['items']; spin: WheelView['spin']; needle: number; round: number; timer: NodeJS.Timeout | null }
interface CardsRt { game: CardGameKey; players: number; settings: { tdc: number; tarot: number; holdem: number; coinche: number; bots?: TarotAI.Level; holdemRules?: HoldemRules; coincheTarget?: number; dealMode?: 'random' | 'classic' }; showTricks: boolean; tarot: Tarot.Tarot | null; holdem: Holdem.Holdem | null; coinche: Coinche.Coinche | null; next: { at: number; ready: string[] } | null; handDone: number; shownAt: { hand: number; street: string }; settled: boolean; seats: Table.CardSeat[]; tdc: Tdc.Tdc | null; paid: Record<string, string | null>; turnSince: number; robot: NodeJS.Timeout | null; late: NodeJS.Timeout | null; art: Record<string, string> }
declare module './room-rt.js' {
  interface RoomSlots { chatPolls: Map<number, { cp: StoredChatPoll; timer: NodeJS.Timeout | null }>; cards: CardsRt; poll: PollRt; wheel: WheelRt; fx: Record<string, number[]> }
}
const GAME_ROUND: Record<CardGameKey, string> = { tdc: 'la manche du Trou du cul', tarot: 'la donne de Tarot', holdem: 'la partie de Texas Hold\'em', coinche: 'la partie de Coinche' };
const GAME_NAME: Record<CardGameKey, string> = { tdc: 'Trou du cul', tarot: 'Tarot', holdem: 'Texas Hold\'em', coinche: 'Coinche' };
export type { SocketData };

@Injectable()
export class RoomHub implements OnModuleInit {
  private readonly log = new Logger('Salons');

  constructor(@Inject(ENV) private readonly env: Env, @Inject(DB) private readonly db: Db, @Inject(SQL) private readonly sql: postgres.Sql,
    private readonly roomStore: RoomsService, readonly chat: ChatService, private readonly media: MediaService, private readonly library: RoomLibrary,
    readonly rooms: RoomRegistry, private readonly votes: Votes, @Inject(ACTIVITIES) private readonly activities: Activity[]) {}

  async onModuleInit() {
    this.rooms.useSwitch((rt, choice) => this.setActivity(rt, choice));
    this.votes.on('host', async (rt, v) => {
      if (!v.target) return;
      await this.rooms.setHost(rt, v.target);
      const [m] = await this.rooms.members(rt, v.target);
      await this.rooms.say(rt, `${m?.name ?? '?'} devient l'hôte (vote accepté).`, true);
    });
    this.votes.on('activity', async (rt, v) => { if (v.choice) await this.setActivity(rt, v.choice as ActivityChoice); });
    this.votes.on('kick', async (rt, v) => {
      if (!v.target) return;
      const [m] = await this.rooms.members(rt, v.target);
      await this.rooms.say(rt, `${m?.name ?? '?'} doit quitter la table : vote accepté.`);
      await this.tableLeaveOf(rt, v.target);
    });
    await this.votes.cancelOpen();
    await this.sql.listen(ADMIN_CHANNEL, payload => { try { this.onAdmin(JSON.parse(payload) as AdminNotice); } catch { /* malformed */ } });
  }

  /** A room starts being played (first player since the server started): its Demi-disque from the saved rules; a round
   *  that was running when the server stopped is cancelled, and it is said. */
  private async load(room: Room): Promise<RoomRt> {
    const ps = (room.rules.poll ?? {}) as { seconds?: number; secret?: boolean; round?: number };
    const ws = (room.rules.wheel ?? {}) as { items?: WheelView['items']; needle?: number; round?: number };
    const rt: RoomRt = { room, seq: 0, members: new Map(), vote: null, notice: null, slots: { chatPolls: new Map(), cards: { game: 'tdc', players: 4, settings: { tdc: 4, tarot: 4, holdem: 6, coinche: 4, ...((room.rules.cards as object | undefined) ?? {}) }, showTricks: true, tarot: null, holdem: null, coinche: null, next: null, handDone: 0, shownAt: { hand: 0, street: '' }, settled: false, seats: [], tdc: null, paid: {}, turnSince: 0, robot: null, late: null, art: {} },
      poll: { phase: 'writing', round: ps.round ?? 1, seconds: ps.seconds ?? 300, secret: ps.secret ?? false, poll: null, answers: {}, host: null, deadline: null, timer: null },
      wheel: { phase: 'writing', items: ws.items ?? [{ label: '', weight: '' }, { label: '', weight: '' }], spin: null, needle: ws.needle ?? 0, round: ws.round ?? 1, timer: null }, fx: {} } as Partial<RoomSlots> as RoomSlots };
    for (const a of this.activities) a.init?.(rt);
    for (const a of await this.db.select().from(trumpArt).where(eq(trumpArt.roomId, room.id))) rt.slots.cards.art[a.card] = a.mediaId;   // the trumps' pictures
    // the polls continued in the chat, still open: their clock again (closed at once if their time ran out meanwhile)
    for (const m of await this.db.select().from(messages).where(and(eq(messages.roomId, room.id), eq(messages.kind, 'poll'), sql`coalesce((${messages.data}->'chatPoll'->>'closed')::boolean, true) = false`))) {
      this.armChatPoll(rt, m.id, (m.data as { chatPoll: StoredChatPoll }).chatPoll);
    }
    // a game running when the server stopped: cancelled, back to its first step, said in the chat and in a window
    const live = (room.rules.live ?? {}) as { cards?: string; poll?: string };
    const lost: string[] = [];
    for (const a of this.activities) { const l = await a.restore?.(rt); if (l) lost.push(l); }
    lost.push(...[live.poll ? 'le sondage' : '', live.cards ? GAME_ROUND[live.cards as CardGameKey] ?? 'la partie de cartes' : ''].filter(Boolean));
    if (live.cards || live.poll) await this.rooms.saveRules(rt, 'live', {});
    if (lost.length) {
      const what = lost.join(' et '), text = `Le serveur a redémarré pendant ${what} : ${lost.length > 1 ? 'ils sont annulés' : 'la partie est annulée'}. Tout reprend à son début ; l'hôte peut relancer.`;
      rt.notice = { id: randomUUID(), title: 'Partie perdue', text, at: Date.now() };
      await this.chat.send(room.id, null, `Le serveur a redémarré : ${what} en cours ${lost.length > 1 ? 'sont annulés' : 'est annulé(e)'}.`, null, 'system');
    }
    return rt;
  }

  /** The activity changes during a round: the rounds of the other activities are cancelled (the host's choice, said in
   *  the chat); the activity chosen keeps its own (a round that just started switches to its activity). */
  private async cancelRunning(rt: RoomRt, to: ActivityChoice) {
    const lost: string[] = [];
    for (const a of this.activities) { const l = await a.cancel?.(rt, to); if (l) lost.push(l); }
    if (rt.slots.poll.phase === 'open' && to.activity !== 'poll') await this.pollToChat(rt);   // not lost: it goes on in the chat
    if (rt.slots.wheel.phase === 'spinning' && to.activity !== 'wheel') {
      if (rt.slots.wheel.timer) clearTimeout(rt.slots.wheel.timer);
      rt.slots.wheel = { ...rt.slots.wheel, phase: 'writing', spin: null, timer: null };
      this.emitWheel(rt);
      lost.push('le tirage');
    }
    if (this.inRound(rt) && (to.activity !== 'cards' || cardGameOf(to) !== rt.slots.cards.game)) {
      const c = rt.slots.cards;
      if (c.robot) { clearTimeout(c.robot); c.robot = null; }
      if (c.late) { clearTimeout(c.late); c.late = null; }
      lost.push(GAME_ROUND[c.game]);
      c.tdc = null; c.tarot = null; c.holdem = null; c.coinche = null; c.paid = {}; c.settled = false;
      await this.rooms.setLive(rt, 'cards', null); await this.emitCards(rt);
    }
    return lost;
  }

  // ---------------------------------------------------------------- join / leave
  async join(socket: Socket, key: string, after?: number): Promise<RoomState> {
    const room = await this.roomStore.byKey(key);
    if (!room) throw new UserError('unknown');
    const data = socket.data as SocketData, me = data.account.id;
    if (data.roomId && data.roomId !== room.id) this.leave(socket);
    const rt = this.rooms.get(room.id) ?? await this.load(room);
    this.rooms.add(rt);

    const existing = await this.db.query.roomMembers.findFirst({ where: and(eq(roomMembers.roomId, room.id), eq(roomMembers.accountId, me)) });
    if (!existing) {
      const taken = (await this.db.select({ hue: roomMembers.hue }).from(roomMembers).where(eq(roomMembers.roomId, room.id))).map(r => r.hue);
      await this.db.insert(roomMembers).values({ roomId: room.id, accountId: me, hue: data.account.hue ?? defaultHue(taken) }).onConflictDoNothing();
    }
    if (!rt.room.hostId) await this.rooms.setHost(rt, me);   // a new room: its first player hosts it

    const m = rt.members.get(me) ?? { sockets: new Set(), awaySince: null, grace: null };
    rt.members.set(me, m);
    const wasHere = m.sockets.size > 0 || m.grace !== null;
    if (m.grace) { clearTimeout(m.grace); m.grace = null; }
    m.sockets.add(socket.id);
    m.awaySince = null;
    data.roomId = room.id;
    await socket.join(`room:${room.id}`);
    if (!existing) await this.rooms.say(rt, `${data.account.name} rejoint le salon.`, true);
    if (!wasHere || !existing) await this.rooms.emitMember(rt, me);
    return this.state(rt, me, after);
  }

  /** The socket leaves its room; the player is away after the grace if it was his last connection there. */
  leave(socket: Socket) {
    const data = socket.data as SocketData;
    const rt = data.roomId ? this.rooms.get(data.roomId) : null;
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
      void this.rooms.emitMember(rt, me);
    }, PRESENCE.graceMs);
    m.grace.unref?.();
  }

  // ---------------------------------------------------------------- state
  async state(rt: RoomRt, me: string, after?: number): Promise<RoomState> {
    return { seq: rt.seq, room: { key: rt.room.key, name: rt.room.name, createdAt: rt.room.createdAt.getTime() }, me, hostId: rt.room.hostId,
      members: await this.rooms.members(rt), chat: after ? await this.chat.since(rt.room.id, rt.room.createdAt, after) : await this.chat.page(rt.room.id, rt.room.createdAt), serverTime: Date.now(),
      stickers: await this.library.stickers(rt), emoji: await this.library.emoji(rt), activity: this.rooms.activity(rt), scope: this.rooms.scope(rt),
      notice: rt.notice && Date.now() - rt.notice.at < 30 * 60_000 ? { id: rt.notice.id, title: rt.notice.title, text: rt.notice.text } : null,
      ...Object.assign({}, ...this.activities.map(a => a.view(rt, me))), poll: this.pollView(rt, me), wheel: this.wheelView(rt), cards: this.cardsView(rt, me), web: (rt.room.rules.web as Record<string, string> | undefined) ?? {} } as RoomState;
  }

  async giveHost(socket: Socket, to: string) {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account.id;
    if (rt.room.hostId !== me) throw new UserError('Seul l\'hôte peut donner son rôle.');
    const [target] = await this.rooms.members(rt, to);
    if (!target) throw new UserError('Ce joueur n\'est pas dans le salon.');
    await this.rooms.setHost(rt, to);
    await this.rooms.say(rt, `${target.name} devient l'hôte.`, true);
  }

  // ---------------------------------------------------------------- activity, votes, host, social credit
  private async setActivity(rt: RoomRt, choice: ActivityChoice) {
    const before = this.rooms.activity(rt);
    if (before.activity !== choice.activity || (choice.activity === 'cards' && (before.cardGame ?? 'tdc') !== (choice.cardGame ?? 'tdc'))) {
      const lost = await this.cancelRunning(rt, choice);
      if (lost.length) await this.rooms.say(rt, `Changement d'activité : ${lost.join(' et ')} en cours ${lost.length > 1 ? 'sont annulés' : 'est annulé(e)'}.`, true);
    }
    if (choice.cardGame === 'tarot' && choice.tarotPlayers) rt.slots.cards.settings = { ...rt.slots.cards.settings, tarot: choice.tarotPlayers };
    if (choice.activity === 'cards') this.prepareTable(rt, cardGameOf(choice));
    for (const a of this.activities) await a.choose?.(rt, choice);
    rt.room = { ...rt.room, rules: { ...rt.room.rules, activity: choice, scope: ((rt.room.rules.scope as number | undefined) ?? 0) + 1 } };   // a new session
    await this.db.update(rooms).set({ rules: rt.room.rules }).where(eq(rooms.id, rt.room.id));
    this.rooms.emit(rt, { type: 'activity', activity: choice, scope: this.rooms.scope(rt) });
    for (const a of this.activities) await a.chosen?.(rt, choice);
    if (choice.activity === 'cards') await this.emitCards(rt);
  }

  /** The table of a card game, before its first deal (or another number of seats): the players already seated keep
   *  their seat, robots on the others; players take a seat before the host deals (the robots wait for the deal). */
  private prepareTable(rt: RoomRt, game: CardGameKey) {
    const c = rt.slots.cards, n = c.settings[game];
    if (this.inRound(rt) && c.game === game) return;
    if (c.game === game && c.seats.length === n) return;
    const seated = c.seats.map(s => s.user).filter((u): u is string => !!u).slice(0, n);
    c.seats = Table.seatTable(seated, n).slice(0, n);
    c.game = game; c.players = n; c.tdc = null; c.tarot = null; c.holdem = null; c.coinche = null; c.paid = {};
  }

  /** /hote: the host already; the host away for 5 min or more (or gone): the role at once; else a vote. */
  async askHost(socket: Socket): Promise<'already' | 'taken' | 'vote'> {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account;
    if (rt.room.hostId === me.id) return 'already';
    const [host] = rt.room.hostId ? await this.rooms.members(rt, rt.room.hostId) : [];
    if (!host || host.presence === 'gone') {
      await this.rooms.setHost(rt, me.id);
      const mins = host?.awaySince ? Math.floor((Date.now() - host.awaySince) / 60_000) : 0;
      await this.rooms.say(rt, `${me.name} devient l'hôte : ${host ? `${host.name} n'était plus là depuis ${mins} min` : 'l\'hôte avait quitté le salon'}.`, true);
      return 'taken';
    }
    await this.votes.launch(rt, { kind: 'host', by: me.id, target: me.id, label: `demande à devenir l'hôte, à la place de ${host.name}` });
    return 'vote';
  }

  /** /activity: the host changes it at once; another player proposes it to a vote. */
  async chooseActivity(socket: Socket, choice: ActivityChoice, label: string): Promise<'applied' | 'vote'> {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account;
    if (!READY_ACTIVITIES.includes(choice.activity) || (choice.activity === 'cards' && !READY_CARD_GAMES.includes(choice.cardGame ?? 'tdc'))) throw new UserError('Cette activité arrive bientôt.');
    if (rt.room.hostId === me.id) {
      await this.setActivity(rt, choice);
      await this.rooms.say(rt, `${me.name} passe à ${label}.`, true);
      return 'applied';
    }
    await this.votes.launch(rt, { kind: 'activity', by: me.id, choice, label: `propose de passer à ${label}` });
    return 'vote';
  }

  /** /credit-social: never to oneself; said in the chat with the change. */
  async giveCredit(socket: Socket, to: string, delta: number) {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account.id;
    if (to === me) throw new UserError('Impossible de se donner du crédit soi-même.');
    const [row] = await this.db.update(roomMembers).set({ credit: sql`${roomMembers.credit} + ${delta}` })
      .where(and(eq(roomMembers.roomId, rt.room.id), eq(roomMembers.accountId, to))).returning();
    if (!row) throw new UserError('Ce joueur n\'est plus dans le salon.');
    const [m] = await this.db.insert(messages).values({ roomId: rt.room.id, authorId: null, kind: 'credit', data: { by: me, to, delta, tier: tierOf(delta).name, words: creditWord(Math.abs(delta)) } }).returning();
    this.rooms.emit(rt, { type: 'message', message: this.chat.view(m!) });
    await this.rooms.emitMember(rt, to);
  }

  /** « Réinitialiser la partie »: the ranking of the game being played back to zero (the others, and the Palmarès, kept);
   *  the Demi-disque also starts again from its first round. */
  async gameReset(socket: Socket) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    const key = scoreKey(this.rooms.activity(rt));
    if (!key) throw new UserError('Cette activité n\'a pas de classement.');
    await this.db.update(roomMembers).set({ scores: sql`${roomMembers.scores} - ${key}::text` }).where(eq(roomMembers.roomId, rt.room.id));
    await this.activities.find(a => a.key === this.rooms.activity(rt).activity)?.reset?.(rt);
    for (const m of await this.rooms.members(rt)) await this.rooms.emitMember(rt, m.id);   // the absent ones too
    await this.rooms.say(rt, `Le classement ${SCORE_NAMES[key]} est remis à zéro (le palmarès est gardé).`);
  }

  // ---------------------------------------------------------------- Sondage
  /** What a player sees: while open, who answered and his own answer; at the results, the answers (anonymous when secret). */
  private pollView(rt: RoomRt, me: string): PollView {
    const p = rt.slots.poll, open = p.phase === 'open';
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
    for (const s of await this.rooms.io.in(`room:${rt.room.id}`).fetchSockets()) s.emit('event', { type: 'poll', poll: this.pollView(rt, (s.data as SocketData).account.id), seq: rt.seq });
  }
  async pollSettings(socket: Socket, v: { seconds?: number; secret?: boolean }) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (v.seconds) rt.slots.poll.seconds = v.seconds;
    if (v.secret !== undefined) rt.slots.poll.secret = v.secret;
    await this.rooms.saveRules(rt, 'poll', { seconds: rt.slots.poll.seconds, secret: rt.slots.poll.secret, round: rt.slots.poll.round });
    await this.emitPoll(rt);
  }

  async pollPublish(socket: Socket, v: { kind: 'choices' | 'free' | 'gradient'; question: string; choices: string[]; pics: ({ mediaId?: string; stickerId?: string; gif?: GifRef } | null)[] }) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (rt.slots.poll.phase === 'open') throw new UserError('Un sondage est déjà ouvert.');
    const choices = v.kind === 'free' ? [] : v.choices;
    const pics: (PollPicView | null)[] = [];
    if (v.kind === 'choices') for (let i = 0; i < choices.length; i++) {
      const p = v.pics[i];
      let pic: PollPicView | null = null;
      if (p?.gif) pic = { kind: 'gif', src: p.gif.url, w: p.gif.w, h: p.gif.h };   // a link to its provider, as in the chat
      else if (p?.mediaId) { const m = await this.media.picture(p.mediaId, 'poll'); pic = { kind: 'image', src: this.media.url(m.id), w: m.width, h: m.height }; }
      else if (p?.stickerId) {
        const st = await this.library.sticker(rt, p.stickerId);
        if (st) pic = { kind: 'sticker', ...st };
      }
      pics.push(pic);
    }
    const draft = { kind: v.kind, question: v.question, choices, pics };
    if (!Poll.ready(draft as Poll.PollDraft) || (v.kind !== 'free' && (choices.length < Poll.MIN_CHOICES))) throw new UserError('Il manque la question ou un choix.');
    if (this.rooms.activity(rt).activity !== 'poll') await this.setActivity(rt, { activity: 'poll' });
    rt.slots.poll = { ...rt.slots.poll, phase: 'open', poll: draft, answers: {}, host: rt.room.hostId, deadline: Date.now() + rt.slots.poll.seconds * 1000, timer: null };
    rt.slots.poll.timer = setTimeout(() => void this.pollClose(rt), rt.slots.poll.seconds * 1000);
    await this.rooms.setLive(rt, 'poll', v.question);
    await this.media.keepFor(v.pics.flatMap(p => (p?.mediaId ? [p.mediaId] : [])), rt.slots.poll.seconds * 1000);   // not swept before the poll's end
    await this.rooms.say(rt, `Sondage ${rt.slots.poll.round} : « ${v.question} »`);
    await this.emitPoll(rt);
  }

  /** An answer fits the poll: a choice of its list, a text, a point of its gradient. */
  private validAnswer(poll: NonNullable<PollRt['poll']>, answer: PollAnswer) {
    return poll.kind === 'choices' ? typeof answer === 'number' && answer < poll.choices.length
      : poll.kind === 'free' ? typeof answer === 'string'
      : Array.isArray(answer) && answer.every(x => Number.isFinite(x) && Math.abs(x) <= 1.01) && (poll.choices.length > 2 || (answer[1] === 0 && answer[0] >= 0));
  }

  async pollAnswer(socket: Socket, answer: PollAnswer) {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account.id, p = rt.slots.poll;
    if (p.phase !== 'open' || !p.poll) throw new UserError('Le sondage est fermé.');
    if (me !== rt.room.hostId && !(await this.rooms.playingIds(rt)).has(me)) throw new UserError('Clique d\'abord « Participer ».');
    if (me in p.answers) throw new UserError('Tu as déjà répondu.');
    if (!this.validAnswer(p.poll, answer)) throw new UserError('Réponse invalide.');
    p.answers[me] = answer;
    await this.emitPoll(rt);
    const playing = await this.rooms.playingIds(rt);
    const candidates = this.rooms.connected(rt).filter(id => playing.has(id) && id !== p.host);
    if (candidates.length && candidates.every(id => id in p.answers)) await this.pollClose(rt);   // every candidate answered
  }

  private async pollClose(rt: RoomRt) {
    if (rt.slots.poll.phase !== 'open') return;
    if (rt.slots.poll.timer) clearTimeout(rt.slots.poll.timer);
    rt.slots.poll = { ...rt.slots.poll, phase: 'results', deadline: null, timer: null };
    await this.rooms.setLive(rt, 'poll', null);
    const n = Object.keys(rt.slots.poll.answers).length;
    await this.rooms.say(rt, `Sondage terminé : ${n} réponse${n > 1 ? 's' : ''}.`);
    await this.emitPoll(rt);
  }

  async pollEnd(socket: Socket) { const rt = this.rooms.roomOf(socket); this.rooms.hostOnly(rt, (socket.data as SocketData).account.id); await this.pollClose(rt); }

  async pollNext(socket: Socket) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (rt.slots.poll.phase === 'open') throw new UserError('Le sondage est encore ouvert.');
    rt.slots.poll = { ...rt.slots.poll, phase: 'writing', round: rt.slots.poll.round + 1, poll: null, answers: {}, host: null, deadline: null };
    await this.rooms.saveRules(rt, 'poll', { seconds: rt.slots.poll.seconds, secret: rt.slots.poll.secret, round: rt.slots.poll.round });
    await this.emitPoll(rt);
  }

  // ---------------------------------------------------------------- a poll continued in the chat
  /** The activity changes while a poll is open: it becomes a message of the chat (its time and its answers kept),
   *  answered there; the Sondage starts again from a blank page. */
  private async pollToChat(rt: RoomRt) {
    const p = rt.slots.poll;
    if (p.timer) clearTimeout(p.timer);
    const cp: StoredChatPoll = { poll: p.poll!, round: p.round, host: p.host, secret: p.secret, seconds: p.seconds, deadline: p.deadline ?? Date.now(), answers: { ...p.answers }, closed: false, outcome: null };
    const [row] = await this.db.insert(messages).values({ roomId: rt.room.id, authorId: p.host, kind: 'poll', text: p.poll!.question, data: { chatPoll: cp } }).returning();
    this.armChatPoll(rt, row!.id, cp);
    this.rooms.emit(rt, { type: 'message', message: this.chat.view(row!) });
    rt.slots.poll = { ...p, phase: 'writing', round: p.round + 1, poll: null, answers: {}, host: null, deadline: null, timer: null };
    await this.rooms.saveRules(rt, 'poll', { seconds: rt.slots.poll.seconds, secret: rt.slots.poll.secret, round: rt.slots.poll.round });
    await this.rooms.setLive(rt, 'poll', null);
    await this.emitPoll(rt);
    await this.rooms.say(rt, `Le sondage « ${cp.poll.question} » continue dans le chat : réponds-y directement.`, true);
  }

  private armChatPoll(rt: RoomRt, id: number, cp: StoredChatPoll) {
    const timer = setTimeout(() => void this.chatPollClose(rt, id), Math.max(0, cp.deadline - Date.now()));
    rt.slots.chatPolls.set(id, { cp, timer });
  }

  /** Its message rewritten (its answers kept; everyone sees who answered, not what, until it closes). */
  private async saveChatPoll(rt: RoomRt, id: number, cp: StoredChatPoll) {
    const [row] = await this.db.update(messages).set({ data: { chatPoll: cp } }).where(eq(messages.id, id)).returning();
    if (row) this.rooms.emit(rt, { type: 'message-updated', message: this.chat.view(row) });
  }

  /** An answer in the chat: any player of the room, once; closed when every connected player (but its host) answered. */
  async chatPollAnswer(socket: Socket, id: number, answer: PollAnswer) {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account.id, e = rt.slots.chatPolls.get(id);
    if (!e || e.cp.closed) throw new UserError('Ce sondage est fermé.');
    if (me in e.cp.answers) throw new UserError('Tu as déjà répondu.');
    if (!this.validAnswer(e.cp.poll, answer)) throw new UserError('Réponse invalide.');
    e.cp.answers[me] = answer;
    await this.saveChatPoll(rt, id, e.cp);
    const others = this.rooms.connected(rt).filter(x => x !== e.cp.host);
    if (others.length && others.every(x => x in e.cp.answers)) await this.chatPollClose(rt, id);
  }

  /** Its host (or the room's) ends it now. */
  async chatPollEnd(socket: Socket, id: number) {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account.id, e = rt.slots.chatPolls.get(id);
    if (!e || e.cp.closed) throw new UserError('Ce sondage est déjà fermé.');
    if (me !== e.cp.host && me !== rt.room.hostId) throw new UserError('Seul l\'hôte du sondage peut le terminer.');
    await this.chatPollClose(rt, id);
  }

  /** Closed: its outcome counted, shown in its message. */
  private async chatPollClose(rt: RoomRt, id: number) {
    const e = rt.slots.chatPolls.get(id);
    if (!e || e.cp.closed) return;
    if (e.timer) clearTimeout(e.timer);
    rt.slots.chatPolls.delete(id);
    e.cp.closed = true;
    e.cp.outcome = Poll.outcome({ ...e.cp.poll, answers: e.cp.answers } as Poll.Poll, e.cp.host ?? '');
    await this.saveChatPoll(rt, id, e.cp);
    const n = Object.keys(e.cp.answers).length;
    await this.rooms.say(rt, `Sondage « ${e.cp.poll.question} » terminé : ${n} réponse${n > 1 ? 's' : ''}, les résultats sont dans le chat.`, true);
  }

  // ---------------------------------------------------------------- Roulette
  private wheelView(rt: RoomRt): WheelView { const w = rt.slots.wheel; return { phase: w.phase, items: w.items, spin: w.spin, needle: w.needle, round: w.round }; }
  private emitWheel(rt: RoomRt) { this.rooms.emit(rt, { type: 'wheel', wheel: this.wheelView(rt) }); }

  /** The host builds the wheel: everyone sees it as it is typed. */
  async wheelSet(socket: Socket, items: WheelView['items']) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (rt.slots.wheel.phase === 'spinning') throw new UserError('La roue tourne.');
    const after = rt.slots.wheel.phase === 'result';   // changed after a draw: the next one
    rt.slots.wheel = { ...rt.slots.wheel, items, phase: after ? 'writing' : rt.slots.wheel.phase, round: rt.slots.wheel.round + (after ? 1 : 0) };
    await this.rooms.saveRules(rt, 'wheel', { items, needle: rt.slots.wheel.needle });
    this.emitWheel(rt);
  }

  /** The server draws the angle; every panel animates the same spin, the result comes after it. */
  async wheelSpin(socket: Socket) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (rt.slots.wheel.phase === 'spinning') throw new UserError('La roue tourne déjà.');
    const why = Wheel.problem(rt.slots.wheel.items);
    if (why) throw new UserError({ over: 'Le total des poids dépasse 100.', invalid: 'Un poids n\'est pas un nombre.', empty: 'Il faut au moins 2 propositions, toutes écrites.', zero: 'Tous les poids sont à 0.' }[why]);
    if (this.rooms.activity(rt).activity !== 'wheel') await this.setActivity(rt, { activity: 'wheel' });
    const spin = Wheel.draw(rt.slots.wheel.items, Date.now(), rt.slots.wheel.needle);
    rt.slots.wheel = { ...rt.slots.wheel, phase: 'spinning', spin, timer: setTimeout(() => void this.wheelStop(rt), Wheel.SPIN_MS) };
    await this.rooms.say(rt, 'La roue tourne…');
    this.emitWheel(rt);
  }

  private async wheelStop(rt: RoomRt) {
    const s = rt.slots.wheel.spin;
    if (rt.slots.wheel.phase !== 'spinning' || !s) return;
    rt.slots.wheel = { ...rt.slots.wheel, phase: 'result', needle: s.angle, timer: null };
    await this.rooms.saveRules(rt, 'wheel', { items: rt.slots.wheel.items, needle: s.angle, round: rt.slots.wheel.round + 1 });
    const label = s.items[s.winner]?.label.trim() || `Proposition ${s.winner + 1}`;
    await this.rooms.say(rt, `Roulette : « ${label} » (${Math.round(s.shares[s.winner] ?? 0)} % de chances).`);
    this.emitWheel(rt);
  }

  async wheelEdit(socket: Socket) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (rt.slots.wheel.phase === 'spinning') throw new UserError('La roue tourne.');
    rt.slots.wheel = { ...rt.slots.wheel, phase: 'writing', spin: null, round: rt.slots.wheel.round + (rt.slots.wheel.phase === 'result' ? 1 : 0) };   // the next draw
    this.emitWheel(rt);
  }

  // ---------------------------------------------------------------- integrations (Low Tide)
  /** The host saves an integration's address (checked in his panel: the page declares the integration's name). */
  async setWeb(socket: Socket, integration: string, url: string) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    const u = new URL(url), local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new UserError('L\'adresse doit commencer par https:// (http:// seulement pour localhost).');
    const web = { ...((rt.room.rules.web as Record<string, string> | undefined) ?? {}), [integration]: u.href };
    await this.rooms.saveRules(rt, 'web', web);
    this.rooms.emit(rt, { type: 'web', web });
    await this.rooms.say(rt, `Nouvelle adresse pour Low Tide : ${u.host}`);
  }

  // ---------------------------------------------------------------- Cartes: the Trou du cul
  /** What a player sees: the seats, his own hand (the others' as backs), the last round's points, the late seat. */
  private cardsView(rt: RoomRt, me: string): CardsView {
    const c = rt.slots.cards, mine = Table.seatOfUser(c.seats, me)?.id ?? null;
    return { game: c.game, players: c.players, settings: c.settings, showTricks: c.showTricks, seats: c.seats, tdc: c.tdc ? Tdc.tdcView(c.tdc, mine) : null,
      tarot: c.tarot ? Tarot.tarotView(c.tarot, mine) : null, holdem: c.holdem ? Holdem.holdemView(c.holdem, mine) : null, coinche: c.coinche ? Coinche.coincheView(c.coinche, mine) : null, next: c.game === 'coinche' ? c.next : null, paid: c.paid, turnSince: c.turnSince, late: this.lateSeat(rt),
      art: Object.fromEntries(Object.entries(c.art).map(([n, id]) => [n, this.media.url(id)])) };
  }
  private async emitCards(rt: RoomRt) {
    rt.seq++;
    for (const s of await this.rooms.io.in(`room:${rt.room.id}`).fetchSockets()) s.emit('event', { type: 'cards', cards: this.cardsView(rt, (s.data as SocketData).account.id), seq: rt.seq });
  }
  private async seatName(rt: RoomRt, seat: string) {
    const s = rt.slots.cards.seats.find(x => x.id === seat), uid = s ? s.user ?? s.credit : null;
    if (!uid) return s?.bot ?? '?';
    return (await this.rooms.members(rt, uid))[0]?.name ?? '?';
  }
  /** The player whose turn has lasted 30 s or more (a player, not a robot): /kick may propose to make him leave. */
  private lateSeat(rt: RoomRt) {
    const turn = this.turnOf(rt), s = turn !== null ? rt.slots.cards.seats.find(x => x.id === turn) : null;
    if (!s?.user || Date.now() - rt.slots.cards.turnSince < KICK_AFTER_MS) return null;
    return { seat: s.id, user: s.user, secs: Math.floor((Date.now() - rt.slots.cards.turnSince) / 1000) };
  }

  /** A new round (host): the first seats the players who joined (« Participer »), robots up to 3; then the same seats. */
  async cardsDeal(socket: Socket) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    const choice = this.rooms.activity(rt);
    if (choice.cardGame === 'tarot') return this.tarotDeal(rt, rt.slots.cards.settings.tarot as 4 | 5);
    if (choice.cardGame === 'holdem') return this.holdemStart(rt);
    if (choice.cardGame === 'coinche') return this.coincheStart(rt);
    const c = rt.slots.cards;
    if (c.game === 'tdc' && c.tdc && c.tdc.turn !== null) throw new UserError('Une manche est en cours.');
    const n = c.settings.tdc, fresh = c.game !== 'tdc' || c.seats.length !== n || !c.tdc;   // a new table, or another number of seats
    this.prepareTable(rt, 'tdc');
    c.players = n;
    c.seats = c.seats.map(s => ({ ...s, credit: s.user }));
    c.paid = {};
    const names = new Map<string, string>();
    for (const s of c.seats) names.set(s.id, await this.seatName(rt, s.id));
    c.tdc = Tdc.deal(c.seats.map(s => s.id), fresh ? null : c.tdc, id => names.get(id) ?? '?');
    await this.rooms.setLive(rt, 'cards', 'tdc');
    c.settled = false;
    c.turnSince = Date.now();
    if (this.rooms.activity(rt).activity !== 'cards') await this.setActivity(rt, { activity: 'cards', cardGame: 'tdc' });
    const robots = c.seats.filter(s => !s.user).length;
    await this.rooms.say(rt, `Trou du cul, manche ${c.tdc.round} : ${c.seats.length} places${robots ? `, dont ${robots} robot${robots > 1 ? 's' : ''}` : ''}.`);
    for (const e of c.tdc.exchanges) await this.rooms.say(rt, `Échange : ${e}`);
    await this.afterMove(rt);
  }

  async cardsMove(socket: Socket, move: { play: string[] } | { pass: true }) {
    if (this.rooms.roomOf(socket).slots.cards.game === 'coinche') { if ('play' in move) await this.coincheDo(socket, { play: move.play[0]! }); return; }
    if (this.rooms.roomOf(socket).slots.cards.game === 'holdem') throw new UserError('Au Hold\'em, utilise les boutons de mise.');
    if (this.rooms.roomOf(socket).slots.cards.game === 'tarot') return 'play' in move ? this.tarotDo(socket, { play: move.play[0]! }) : undefined;
    const rt = this.rooms.roomOf(socket), c = rt.slots.cards, t = c.tdc, me = (socket.data as SocketData).account.id;
    const seat = Table.seatOfUser(c.seats, me);
    if (!t || !seat) throw new UserError('Tu n\'es pas à la table.');
    if (t.turn !== seat.id) throw new UserError('Ce n\'est pas ton tour.');
    const ok = 'play' in move ? Tdc.play(t, seat.id, t.hands[seat.id]!.filter(x => move.play.includes(x.id)).slice(0, move.play.length)) : Tdc.pass(t, seat.id);
    if (!ok) throw new UserError('pass' in move ? 'Tu ouvres le pli : tu ne peux pas passer.' : 'Pas jouable : autant de cartes que le pli, de même valeur, plus fortes.');
    await this.afterMove(rt);
  }

  /** After a move: the clock of the turn, the end of the round (points to the last player of each seat), the robots. */
  private async afterMove(rt: RoomRt, before: string | null = null) {
    if (rt.slots.cards.game === 'tarot') return this.afterTarot(rt, before);
    if (rt.slots.cards.game === 'holdem') return this.afterHoldem(rt, before);
    if (rt.slots.cards.game === 'coinche') return this.afterCoinche(rt, before);
    const c = rt.slots.cards, t = c.tdc;
    if (!t) { await this.emitCards(rt); return; }   // before the first deal: the seats changed
    if (t.turn !== before) c.turnSince = Date.now();
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
    if (t.turn === null && !c.settled) {   // the round's end, counted once
      c.settled = true;
      await this.rooms.setLive(rt, 'cards', null);
      const humans = c.seats.filter(s => s.credit).length;   // the Palmarès: alone with robots, it counts only as played
      for (const sid of t.out) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, role = t.roles[sid]!;
        c.paid[sid] = uid;
        if (!uid) continue;
        await this.rooms.addScore(rt, uid, 'tdc', Tdc.ROLES[role].points);
        await this.db.insert(palmares).values({ roomId: rt.room.id, game: 'tdc', data: { account: uid, won: role === 'president', role, humans } });
        await this.rooms.emitMember(rt, uid);
      }
      const parts = [];
      for (const sid of t.out) parts.push(`${await this.seatName(rt, sid)} ${Tdc.ROLES[t.roles[sid]!].name}`);
      await this.rooms.say(rt, `Manche ${t.round} : ${parts.join(', ')}.`);
      const settled = Table.settle(c.seats);
      c.seats = settled.seats;
      for (const u of settled.freed) { const [m] = await this.rooms.members(rt, u); await this.rooms.say(rt, `${m?.name ?? '?'} a quitté la table : un robot prend sa place.`); }
    } else if (t.turn !== null) {
      const s = c.seats.find(x => x.id === t.turn);
      const opens = !t.trick.length && t.lastTrick.length > 0;   // a trick just taken: seen a moment before the next lead
      if (!s?.user) c.robot = setTimeout(() => void this.robotPlays(rt), this.env.ROBOT_DELAY_MS * (opens ? 1.6 : 1));   // a robot plays this seat
      else c.late = setTimeout(() => void this.emitCards(rt), KICK_AFTER_MS + 200);   // 30 s: the « Exclure ? » button appears
    }
    await this.emitCards(rt);
  }

  private async robotPlays(rt: RoomRt) {
    const t = rt.slots.cards.tdc;
    if (!t || t.turn === null || rt.slots.cards.seats.find(s => s.id === t.turn)?.user) return;
    const turn = t.turn, m = Tdc.botMove(t, turn);
    if ('play' in m) Tdc.play(t, turn, m.play); else Tdc.pass(t, turn);
    await this.afterMove(rt, turn);
  }

  /** Watching: take a seat a robot plays (my own first); its hand and this round's points become mine. */
  async tableJoin(socket: Socket): Promise<'ok' | 'full'> {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account, g = rt.slots.cards.game === 'holdem' && rt.slots.cards.holdem && !rt.slots.cards.holdem.over ? rt.slots.cards.holdem : null;
    if (Table.seatOfUser(rt.slots.cards.seats, me.id)) return 'ok';
    const r = Table.join(g ? rt.slots.cards.seats.filter(s => !g.out.includes(s.id)) : rt.slots.cards.seats, me.id);   // Hold'em: an eliminated seat is not taken
    if (r === 'seated') return 'ok';
    if (r === 'full') return 'full';
    rt.slots.cards.seats = rt.slots.cards.seats.map(s => r.seats.find(x => x.id === s.id) ?? s);
    await this.rooms.setPlaying(rt, me.id, true);   // seated: a player, not a spectator
    const inRound = this.inRound(rt);
    await this.rooms.say(rt, r.was.owner === me.id ? `${me.name} reprend sa place.` : `${me.name} prend la place de ${r.was.name}${inRound ? ' et joue sa main en cours : les points de la manche seront les siens' : ''}.`);
    await this.afterMove(rt, this.turnOf(rt));
    return 'ok';
  }

  async tableLeave(socket: Socket) { await this.tableLeaveOf(this.rooms.roomOf(socket), (socket.data as SocketData).account.id); }

  private async tableLeaveOf(rt: RoomRt, user: string) {
    if (!Table.seatOfUser(rt.slots.cards.seats, user)) return;
    const inRound = this.inRound(rt);
    rt.slots.cards.seats = Table.leave(rt.slots.cards.seats, user, inRound);
    await this.rooms.setPlaying(rt, user, false);
    const [m] = await this.rooms.members(rt, user);
    await this.rooms.say(rt, inRound ? `${m?.name ?? '?'} quitte la table : un robot finit la manche à sa place (les points de la manche restent les siens).` : `${m?.name ?? '?'} quitte la table : un robot prend sa place.`);
    await this.afterMove(rt, this.turnOf(rt));
  }

  /** /kick (or the button on his seat): a vote to make the late player leave the table. */
  async askKick(socket: Socket, name?: string): Promise<'vote'> {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account.id;
    if (this.rooms.activity(rt).activity !== 'cards' || !this.inRound(rt)) throw new UserError('/kick sert pendant une partie de cartes.');
    const late = this.lateSeat(rt);
    const lateName = late ? (await this.rooms.members(rt, late.user))[0]?.name ?? '?' : '';
    if (name && (!late || lateName.toLowerCase() !== name.toLowerCase())) throw new UserError(`${name} ne fait pas attendre la table : seul le joueur dont le tour dure depuis 30 s peut être exclu.`);
    if (!late) throw new UserError('Personne ne fait attendre la table : /kick vise le joueur dont le tour dure depuis 30 s.');
    await this.votes.launch(rt, { kind: 'kick', by: me, target: late.user, label: `propose d'exclure ${lateName} de la table : son tour dure depuis ${late.secs} s` });
    return 'vote';
  }

  // ---------------------------------------------------------------- Cartes: the Tarot
  private inRound(rt: RoomRt) {
    const c = rt.slots.cards;
    return c.game === 'tarot' ? !!c.tarot && c.tarot.phase !== 'done' : c.game === 'holdem' ? !!c.holdem && !c.holdem.over : c.game === 'coinche' ? !!c.coinche && !c.coinche.over : !!c.tdc && c.tdc.turn !== null;
  }
  private turnOf(rt: RoomRt) { const c = rt.slots.cards; return (c.game === 'tarot' ? c.tarot?.turn : c.game === 'holdem' ? c.holdem?.turn : c.game === 'coinche' ? c.coinche?.turn : c.tdc?.turn) ?? null; }

  /** A new deal at 4 or 5: the same seats while the number holds; robots take the free ones. */
  private async tarotDeal(rt: RoomRt, n: 4 | 5) {
    const c = rt.slots.cards;
    if (c.game === 'tarot' && c.tarot && c.tarot.phase !== 'done') throw new UserError('Une donne est en cours.');
    if (c.game !== 'tarot' || c.players !== n || c.seats.length !== n) { c.settings = { ...c.settings, tarot: n }; this.prepareTable(rt, 'tarot'); }
    c.game = 'tarot'; c.players = n; c.tdc = null;
    c.seats = c.seats.map(s => ({ ...s, credit: s.user }));
    c.paid = {}; c.settled = false;
    c.tarot = Tarot.deal(c.seats.map(s => s.id), c.tarot, c.settings.dealMode ?? 'random');
    await this.rooms.setLive(rt, 'cards', 'tarot');
    c.turnSince = Date.now();
    const names = [];
    for (const s of c.tarot.seats) names.push(await this.seatName(rt, s));
    await this.rooms.say(rt, `Tarot à ${n}, donne ${c.tarot.deal} : ${names.join(', ')}.`);
    await this.afterTarot(rt);
  }

  /** A player's bid, call, écart or card (checked by the rules), then what follows. */
  async tarotDo(socket: Socket, act: { bid: Tarot.Bid } | { call: string } | { discard: string[] } | { play: string }) {
    const rt = this.rooms.roomOf(socket), c = rt.slots.cards, t = c.tarot, me = (socket.data as SocketData).account.id;
    const seat = Table.seatOfUser(c.seats, me);
    if (!t || !seat || c.game !== 'tarot') throw new UserError('Tu n\'es pas à la table.');
    const hand = t.hands[seat.id] ?? [];
    await this.tarotApply(rt, seat.id, 'bid' in act ? act : 'call' in act ? act
      : 'discard' in act ? { discard: hand.filter(x => act.discard.includes(x.id)) } : { play: hand.find(x => x.id === act.play)! });
  }

  private async tarotApply(rt: RoomRt, seat: string, act: { bid: Tarot.Bid } | { call: string } | { discard: Tarot.TCard[] } | { play: Tarot.TCard }) {
    const t = rt.slots.cards.tarot!, before = t.phase, revealed = t.revealed, turn = t.turn;
    const ok = 'bid' in act ? Tarot.bid(t, seat, act.bid) : 'call' in act ? Tarot.call(t, seat, act.call)
      : 'discard' in act ? (seat === t.taker && Tarot.discard(t, act.discard)) : !!act.play && Tarot.play(t, seat, act.play);
    if (!ok) throw new UserError('bid' in act ? 'Enchère impossible.' : 'call' in act ? 'Carte impossible à appeler.' : 'discard' in act ? `Écart impossible : ${Tarot.ecartSize(t)} cartes, ni Roi ni bout.` : 'Carte impossible : fournis la couleur, sinon coupe (en montant si tu peux).');
    const name = (id: string) => this.seatName(rt, id);
    if (before === 'bid' && t.phase !== 'bid') await this.rooms.say(rt, t.taker ? `${await name(t.taker)} prend : ${Tarot.BIDS[t.bid!].name}.` : t.note);
    if ('call' in act && t.called) await this.rooms.say(rt, `${await name(seat)} appelle ${Tarot.cardName(t.called)}.`);
    if (before !== 'play' && t.phase === 'play' && t.taker && !rt.slots.cards.seats.find(s => s.id === t.taker)?.user
      && TarotAI.aiChelem(Tarot.tarotView(t, t.taker), t.taker, rt.slots.cards.settings.bots ?? 'moyen') && Tarot.announceChelem(t, t.taker)) {
      await this.rooms.say(rt, `${await name(t.taker)} annonce un chelem : tous les plis !`);
    }
    if (!revealed && t.revealed && t.partner) await this.rooms.say(rt, `${await name(t.partner)} joue ${Tarot.cardName(t.called!)} : ${t.partner === t.taker ? 'seul contre 4' : `partenaire de ${await name(t.taker!)}`}.`);
    // the tables show it before the robots go on: the take (2 s), the called card (2,8 s), the trick taken (2 s)
    const pause = before === 'bid' && t.taker ? 2.6 : 'call' in act ? 3.4 : 'play' in act && !t.trick.length ? 2.4 : 1;
    await this.afterTarot(rt, turn, pause);
  }

  /** After a step: the deal's end (each mark to the last player of each seat), the robots (on their seat's view). */
  private async afterTarot(rt: RoomRt, before: string | null = null, pause = 1) {
    const c = rt.slots.cards, t = c.tarot;
    if (!t) { await this.emitCards(rt); return; }   // before the first deal: the seats changed
    if (t.turn !== before) c.turnSince = Date.now();
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
    if (t.phase === 'done' && t.result && !c.settled) {
      c.settled = true;
      await this.rooms.setLive(rt, 'cards', null);
      const r = t.result, humans = c.seats.filter(s => s.credit).length;
      for (const sid of t.seats) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, mark = r.marks[sid] ?? 0;
        c.paid[sid] = uid;
        if (!uid) continue;
        await this.rooms.addScore(rt, uid, 'tarot', mark);
        await this.db.insert(palmares).values({ roomId: rt.room.id, game: 'tarot', data: { account: uid, won: mark > 0, pts: mark, taker: sid === r.taker, partner: sid === r.partner, humans } });
        await this.rooms.emitMember(rt, uid);
      }
      await this.rooms.say(rt, `${await this.seatName(rt, r.taker)} ${r.won ? 'gagne' : 'chute'} sa ${Tarot.BIDS[r.bid].name} (${String(r.made).replace('.', ',')} points pour ${r.need}) : ${(r.marks[r.taker] ?? 0) > 0 ? '+' : ''}${r.marks[r.taker] ?? 0}.`);
      const settled = Table.settle(c.seats);
      c.seats = settled.seats;
    } else if (t.phase === 'done' && !t.result) {   // everyone passed: a new deal, the same seats
      c.robot = setTimeout(() => { if (rt.slots.cards.tarot === t) void this.tarotDeal(rt, c.players as 4 | 5).catch(() => {}); }, Math.max(1500, this.env.ROBOT_DELAY_MS));
    } else if (t.phase !== 'done' && t.turn !== null) {
      const who = t.phase === 'dog' ? t.taker : t.turn, s = c.seats.find(x => x.id === who);
      if (who && !s?.user) c.robot = setTimeout(() => void this.tarotRobot(rt), this.env.ROBOT_DELAY_MS * Math.max(pause, t.phase === 'dog' ? 2 : 1));
      else if (s?.user) c.late = setTimeout(() => void this.emitCards(rt), KICK_AFTER_MS + 200);
    }
    await this.emitCards(rt);
  }

  private async tarotRobot(rt: RoomRt) {
    const t = rt.slots.cards.tarot;
    if (!t || t.phase === 'done') return;
    const seat = t.phase === 'dog' ? t.taker! : t.turn!;
    if (rt.slots.cards.seats.find(s => s.id === seat)?.user) return;
    const view = Tarot.tarotView(t, seat), level = rt.slots.cards.settings.bots ?? 'moyen';   // a robot plays on what its seat may see, at the host's level
    const d = TarotAI.decide(view, seat, level, Math.random, Tarot.play);
    if ('play' in d && d.handful && Tarot.declareHandful(t, seat, d.handful)) await this.sayHandful(rt, seat);
    await this.tarotApply(rt, seat, d).catch(() => { /* a robot never makes an illegal move */ });
  }

  /** A poignée shown: said in the chat, its trumps seen by everyone (the table shows them a moment). */
  private async sayHandful(rt: RoomRt, seat: string) {
    const h = rt.slots.cards.tarot!.handfuls[seat]!;
    await this.rooms.say(rt, `${await this.seatName(rt, seat)} montre une ${Tarot.HANDFUL_NAMES[h.level - 1]} (${h.cards.length} atouts).`);
  }

  /** A player shows a poignée, before his first card. */
  async tarotHandful(socket: Socket, level: 1 | 2 | 3) {
    const rt = this.rooms.roomOf(socket), t = rt.slots.cards.tarot, seat = Table.seatOfUser(rt.slots.cards.seats, (socket.data as SocketData).account.id);
    if (!t || !seat || !Tarot.declareHandful(t, seat.id, level)) throw new UserError(`Poignée impossible : ${Tarot.handfulSizes(t?.seats.length ?? 4)[level - 1]} atouts à montrer, avant ta première carte.`);
    await this.sayHandful(rt, seat.id);
    await this.emitCards(rt);
  }

  /** The taker announces a chelem, before the first card: he leads. */
  async tarotChelem(socket: Socket) {
    const rt = this.rooms.roomOf(socket), t = rt.slots.cards.tarot, seat = Table.seatOfUser(rt.slots.cards.seats, (socket.data as SocketData).account.id);
    if (!t || !seat || !Tarot.announceChelem(t, seat.id)) throw new UserError('Le chelem s\'annonce par le preneur, avant la première carte.');
    await this.rooms.say(rt, `${await this.seatName(rt, seat.id)} annonce un chelem : tous les plis !`);
    await this.afterTarot(rt, null);
  }

  /** The robots' level at the card games (host). */
  async cardsBots(socket: Socket, level: TarotAI.Level) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, bots: level };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    await this.rooms.say(rt, `Robots des cartes : niveau ${TarotAI.LEVELS[level]}.`);
    await this.emitCards(rt);
  }

  /** The host's number of seats for a game (robots complete them), from the next deal. */
  async cardsPlayers(socket: Socket, game: CardGameKey, players: number) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (!(CARD_PLAYERS[game] as readonly number[]).includes(players)) throw new UserError({ tarot: 'Le Tarot se joue à 4 ou à 5.', tdc: 'Le Trou du cul se joue de 3 à 8.', holdem: 'Le Texas Hold\'em se joue de 2 à 8.', coinche: 'La Coinche se joue à 4 (deux équipes de deux).' }[game]);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, [game]: players };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    if (!this.inRound(rt)) this.prepareTable(rt, game);
    await this.rooms.say(rt, `${GAME_NAME[game]} à ${players} joueurs${this.inRound(rt) ? (game === 'holdem' ? ', à partir de la partie suivante' : ', à partir de la donne suivante') : ''} : des robots complètent les places libres.`);
    await this.emitCards(rt);
  }

  // ---------------------------------------------------------------- Cartes: the Texas Hold'em
  private holdemRules(rt: RoomRt): HoldemRules { return { ...Holdem.DEFAULT_SETTINGS, ...rt.slots.cards.settings.holdemRules }; }

  /** « Distribuer »: a new game (the seats taken, robots on the others, the same chips for all); a game stopped
   *  between two hands goes on. */
  private async holdemStart(rt: RoomRt) {
    const c = rt.slots.cards;
    if (c.game === 'holdem' && c.holdem && !c.holdem.over) {
      if (c.holdem.street !== 'showdown' || c.robot) throw new UserError('Une partie est en cours.');
      return this.holdemNext(rt);
    }
    const n = c.settings.holdem;
    if (c.game !== 'holdem' || c.seats.length !== n) this.prepareTable(rt, 'holdem');
    c.game = 'holdem'; c.players = n; c.tdc = null; c.tarot = null;
    c.seats = c.seats.map(s => ({ ...s, credit: s.user }));
    c.paid = {}; c.settled = false; c.handDone = 0; c.shownAt = { hand: 0, street: '' };
    const rules = this.holdemRules(rt);
    c.holdem = Holdem.newGame(c.seats.map(s => s.id), rules);
    await this.rooms.setLive(rt, 'cards', 'holdem');
    c.turnSince = Date.now();
    if (this.rooms.activity(rt).activity !== 'cards') await this.setActivity(rt, { activity: 'cards', cardGame: 'holdem' });
    const names = [];
    for (const s of c.holdem.seats) names.push(await this.seatName(rt, s));
    await this.rooms.say(rt, `Texas Hold'em à ${n} : ${names.join(', ')} ; ${rules.stack} jetons chacun, blindes 10 / 20${rules.every ? `, qui montent toutes les ${rules.every} mains` : ''}.`);
    await this.afterHoldem(rt);
  }

  /** A player's move (fold, check, call, raise to, all-in), checked by the rules. */
  async holdemDo(socket: Socket, move: Holdem.Move) {
    const rt = this.rooms.roomOf(socket), c = rt.slots.cards, g = c.holdem, seat = Table.seatOfUser(c.seats, (socket.data as SocketData).account.id);
    if (!g || !seat || c.game !== 'holdem') throw new UserError('Tu n\'es pas à la table.');
    if (g.turn !== seat.id) throw new UserError('Ce n\'est pas ton tour.');
    if (!Holdem.act(g, seat.id, move)) {
      const o = Holdem.options(g, seat.id);
      throw new UserError(move.act === 'raise' && o?.raise ? `Relance de ${o.raise.min} à ${o.raise.max}, par multiples de 5 (au moins la dernière relance).` : move.act === 'raise' ? 'Tu ne peux plus relancer : suis ou couche-toi.' : 'Coup impossible.');
    }
    await this.afterHoldem(rt, seat.id);
  }

  /** After a move: a hand's end (the players out, said), the game's end (each place's points to the seat's last
   *  player), the next hand after a pause, the robots (on their seat's view). */
  private async afterHoldem(rt: RoomRt, before: string | null = null) {
    const c = rt.slots.cards, g = c.holdem;
    if (!g) { await this.emitCards(rt); return; }
    // the tables show each step (ui/holdem-anim.ts, the same durations): the deal, a new card on the board, the showdown
    const pace = this.env.ROBOT_DELAY_MS / 900, newHand = g.hand !== c.shownAt.hand, newCards = !newHand && g.street !== c.shownAt.street;
    const dealMs = newHand ? g.inHand.length * 2 * 90 + 380 + 380 + 300 + (g.levelUp ? 1800 : 0) : 0, cardsMs = newCards ? 450 + 3 * 260 + 380 + 450 + 300 : 0;
    c.shownAt = { hand: g.hand, street: g.street };
    if (g.turn !== before) c.turnSince = Date.now();
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
    if (g.street === 'showdown' && g.result && c.handDone !== g.hand) {   // a hand's end, said once
      c.handDone = g.hand;
      for (const s of g.result.out) await this.rooms.say(rt, `${await this.seatName(rt, s)} est éliminé${g.places[s]! > 1 ? ` : ${g.places[s]}e place` : ''}.`);
    }
    if (g.over && !c.settled) {
      c.settled = true;
      await this.rooms.setLive(rt, 'cards', null);
      const n = g.seats.length, order = [...g.seats].sort((a, b) => g.places[a]! - g.places[b]!), parts = [], humans = c.seats.filter(s => s.credit).length;
      for (const sid of order) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, place = g.places[sid]!, pts = Holdem.placePoints(place, n);
        c.paid[sid] = uid;
        parts.push(`${place}. ${await this.seatName(rt, sid)}${uid && pts ? ` +${pts}` : ''}`);
        if (!uid) continue;
        if (pts) await this.rooms.addScore(rt, uid, 'holdem', pts);
        await this.db.insert(palmares).values({ roomId: rt.room.id, game: 'holdem', data: { account: uid, won: place === 1, place, of: n, pts, humans } });
        await this.rooms.emitMember(rt, uid);
      }
      await this.rooms.say(rt, `Fin de la partie de Texas Hold'em (${g.hand} main${g.hand > 1 ? 's' : ''}) : ${parts.join(', ')}.`);
      c.seats = Table.settle(c.seats).seats;
    } else if (!g.over && g.street === 'showdown') {   // the hand shown a moment, then the next one
      const r = g.result, read = !r || r.uncontested ? 450 + 900 + 650 + 1200 : 450 + (g.revealed ? 5 * 260 + 830 : 0) + 2400 + 650 + 2000;   // gather, run out, read, pay
      c.robot = setTimeout(() => { if (rt.slots.cards.holdem === g) void this.holdemNext(rt).catch(() => {}); }, pace * (read + 2000 * (r?.out.length ?? 0)));
    } else if (g.turn) {
      const s = c.seats.find(x => x.id === g.turn);
      if (!s?.user) c.robot = setTimeout(() => void this.holdemRobot(rt), this.env.ROBOT_DELAY_MS + pace * (dealMs + cardsMs));
      else c.late = setTimeout(() => void this.emitCards(rt), KICK_AFTER_MS + 200);
    }
    await this.emitCards(rt);
  }

  /** The next hand; when no seat still in belongs to a player (the players are out, or left before playing), the
   *  game ends: the robots' order gives nobody points. */
  private async holdemNext(rt: RoomRt) {
    const c = rt.slots.cards, g = c.holdem;
    if (!g || g.over) return;
    c.robot = null;
    if (!Holdem.alive(g).some(s => c.seats.find(x => x.id === s)?.credit)) Holdem.finish(g);
    else if (Holdem.dealHand(g) && g.levelUp) await this.rooms.say(rt, `Les blindes montent : ${g.sb} / ${g.bb}.`);
    c.turnSince = Date.now();
    await this.afterHoldem(rt);
  }

  private async holdemRobot(rt: RoomRt) {
    const g = rt.slots.cards.holdem;
    if (!g || !g.turn || rt.slots.cards.seats.find(s => s.id === g.turn)?.user) return;
    const seat = g.turn;
    const m = HoldemAI.decide(Holdem.holdemView(g, seat), seat, rt.slots.cards.settings.bots ?? 'moyen');   // its seat's view, the host's level
    if (!Holdem.act(g, seat, m)) Holdem.act(g, seat, { act: Holdem.options(g, seat)?.check ? 'check' : 'fold' });
    await this.afterHoldem(rt, seat);
  }

  /** The host's game: starting chips, the blinds' pace (from the next game). */
  async holdemSetRules(socket: Socket, v: Partial<HoldemRules>) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    const rules = { ...this.holdemRules(rt), ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) };
    rt.slots.cards.settings = { ...rt.slots.cards.settings, holdemRules: rules };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    await this.rooms.say(rt, `Texas Hold'em : ${rules.stack} jetons au départ, blindes ${rules.every ? `qui montent toutes les ${rules.every} mains` : 'fixes'}${this.inRound(rt) && rt.slots.cards.game === 'holdem' ? ', à partir de la partie suivante' : ''}.`);
    await this.emitCards(rt);
  }

  /** The host ends the game: the seats still in are placed by their chips. */
  async holdemEnd(socket: Socket) {
    const rt = this.rooms.roomOf(socket), g = rt.slots.cards.holdem;
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    if (!g || g.over || rt.slots.cards.game !== 'holdem') throw new UserError('Aucune partie de Hold\'em en cours.');
    Holdem.finish(g);
    await this.rooms.say(rt, 'L\'hôte termine la partie : les joueurs encore en jeu sont classés selon leurs jetons.');
    await this.afterHoldem(rt);
  }

  // ---------------------------------------------------------------- Cartes: the Coinche
  private coincheTarget(rt: RoomRt) { return rt.slots.cards.settings.coincheTarget ?? 1000; }

  /** « Distribuer »: a new game (two teams facing each other: seats 1 & 3, 2 & 4; robots on the free seats); a game
   *  stopped between two deals goes on. */
  private async coincheStart(rt: RoomRt) {
    const c = rt.slots.cards;
    if (c.game === 'coinche' && c.coinche && !c.coinche.over) {
      if (c.coinche.phase !== 'done' || c.robot) throw new UserError('Une partie est en cours.');
      return this.coincheNext(rt);
    }
    if (c.game !== 'coinche' || c.seats.length !== 4) this.prepareTable(rt, 'coinche');
    c.game = 'coinche'; c.players = 4; c.tdc = null; c.tarot = null; c.holdem = null;
    c.seats = c.seats.map(s => ({ ...s, credit: s.user }));
    c.paid = {}; c.settled = false;
    c.next = null;
    c.coinche = Coinche.newGame(c.seats.map(s => s.id), this.coincheTarget(rt));
    await this.rooms.setLive(rt, 'cards', 'coinche');
    c.turnSince = Date.now();
    if (this.rooms.activity(rt).activity !== 'cards') await this.setActivity(rt, { activity: 'cards', cardGame: 'coinche' });
    const n = await Promise.all(c.coinche.seats.map(s => this.seatName(rt, s)));
    await this.rooms.say(rt, `Coinche en ${c.coinche.target} points : ${n[0]} et ${n[2]} contre ${n[1]} et ${n[3]}.`);
    await this.afterCoinche(rt);
  }

  /** The next deal (the dealer moves on); the seats' points go to whoever sits there now. */
  private async coincheNext(rt: RoomRt) {
    const c = rt.slots.cards, g = c.coinche;
    if (!g || g.over) return;
    c.robot = null;
    Coinche.dealHand(g, true, c.settings.dealMode ?? 'random');
    c.seats = c.seats.map(s => ({ ...s, credit: s.user }));
    c.settled = false; c.paid = {}; c.next = null;
    c.turnSince = Date.now();
    await this.afterCoinche(rt);
  }

  /** A player's word in the bidding, or his card. */
  async coincheDo(socket: Socket, act: { say: Coinche.Say } | { play: string }) {
    const rt = this.rooms.roomOf(socket), c = rt.slots.cards, g = c.coinche, seat = Table.seatOfUser(c.seats, (socket.data as SocketData).account.id);
    if (!g || !seat || c.game !== 'coinche') throw new UserError('Tu n\'es pas à la table.');
    if (g.turn !== seat.id) throw new UserError('Ce n\'est pas ton tour.');
    await this.coincheApply(rt, seat.id, 'say' in act ? act : { play: g.hands[seat.id]!.find(x => x.id === act.play)! });
  }

  private async coincheApply(rt: RoomRt, seat: string, act: { say: Coinche.Say } | { play: Coinche.CCard }) {
    const g = rt.slots.cards.coinche!, before = g.phase, turn = g.turn, belote = g.belote.said;
    const ok = 'say' in act ? Coinche.bid(g, seat, act.say) : !!act.play && Coinche.play(g, seat, act.play);
    if (!ok) throw new UserError('say' in act ? 'Annonce impossible : plus haut que le contrat, une couleur d\'atout ; coinche seulement sur l\'annonce d\'un adversaire.'
      : 'Carte impossible : fournis la couleur ; à l\'atout, monte ; sinon coupe (et surcoupe, ou pisse), sauf si ton partenaire est maître.');
    const name = (id: string) => this.seatName(rt, id);
    if ('say' in act && act.say.kind === 'coinche') await this.rooms.say(rt, `${await name(seat)} coinche !`);
    if ('say' in act && act.say.kind === 'surcoinche') await this.rooms.say(rt, `${await name(seat)} surcoinche !`);
    if (before === 'bid' && g.phase === 'play') await this.rooms.say(rt, `Contrat : ${await name(g.contract!.by)}, ${Coinche.contractName(g.contract!)}.`);
    // the tables show it before the robots go on: the contract, a coinche, the trick taken, the belote
    const pause = before === 'bid' && g.phase === 'play' ? 3.2 : 'say' in act && act.say.kind === 'coinche' ? 2.4 : 'play' in act && !g.trick.length ? 2.4 : g.belote.said !== belote ? 1.8 : 1;
    await this.afterCoinche(rt, turn, pause);
  }

  /** After a step: the deal's end (each team's points to the seats' last players; the score), the game's end, the
   *  next deal after a pause, the robots (on their seat's view). */
  private async afterCoinche(rt: RoomRt, before: string | null = null, pause = 1) {
    const c = rt.slots.cards, g = c.coinche;
    if (!g) { await this.emitCards(rt); return; }
    if (g.turn !== before) c.turnSince = Date.now();
    if (c.robot) { clearTimeout(c.robot); c.robot = null; }
    if (c.late) { clearTimeout(c.late); c.late = null; }
    const pace = this.env.ROBOT_DELAY_MS / 900;
    if (g.phase === 'done' && !c.settled) {
      c.settled = true;
      if (g.result) {
        const r = g.result, humans = c.seats.filter(s => s.credit).length;
        for (const sid of g.seats) {
          const uid = c.seats.find(s => s.id === sid)?.credit ?? null, t = Coinche.team(g, sid), pts = r.score[t];
          c.paid[sid] = uid;
          if (!uid) continue;
          if (pts) await this.rooms.addScore(rt, uid, 'coinche', pts);
          await this.db.insert(palmares).values({ roomId: rt.room.id, game: 'coinche', data: { account: uid, won: t === r.attack ? r.made : !r.made, pts, taker: sid === r.contract.by, humans } });
          await this.rooms.emitMember(rt, uid);
        }
        const k = r.contract, team = await Promise.all(g.seats.filter(s => Coinche.team(g, s) === r.attack).map(s => this.seatName(rt, s)));
        await this.rooms.say(rt, `Donne ${g.deal} : ${team.join(' et ')} ${r.made ? 'remplissent' : 'chutent'} ${Coinche.contractName(k)} (${r.points[r.attack]}${r.belote === r.attack ? ' + belote' : ''}). Score : ${g.scores[0]} – ${g.scores[1]}.`);
        c.seats = Table.settle(c.seats).seats;
      } else Coinche.passedOut(g);
      if (g.over) {
        await this.rooms.setLive(rt, 'cards', null);
        const w = await Promise.all(g.seats.filter(s => Coinche.team(g, s) === g.winner).map(s => this.seatName(rt, s)));
        await this.rooms.say(rt, `Fin de la partie : ${w.join(' et ')} gagnent ${Math.max(...g.scores)} à ${Math.min(...g.scores)}.`);
      } else {   // the count read: the next deal when every seated player is ready, or after a minute (robots alone: a moment)
        const people = c.seats.some(s => s.user);
        c.next = { at: Date.now() + pace * (!g.result ? 2500 : people ? 60_000 : 7000), ready: [] };
      }
    }
    if (g.phase === 'done' && !g.over && c.next) {
      const seated = c.seats.filter(s => s.user).map(s => s.user!);
      if (g.result && seated.length && seated.every(u => c.next!.ready.includes(u))) c.next.at = Math.min(c.next.at, Date.now());   // everyone ready
      c.robot = setTimeout(() => { if (rt.slots.cards.coinche === g) void this.coincheNext(rt).catch(() => {}); }, Math.max(0, c.next.at - Date.now()));
    } else if (g.phase !== 'done' && g.turn) {
      const s = c.seats.find(x => x.id === g.turn);
      if (!s?.user) c.robot = setTimeout(() => void this.coincheRobot(rt), this.env.ROBOT_DELAY_MS * pause);
      else c.late = setTimeout(() => void this.emitCards(rt), KICK_AFTER_MS + 200);
    }
    await this.emitCards(rt);
  }

  private async coincheRobot(rt: RoomRt) {
    const g = rt.slots.cards.coinche;
    if (!g || !g.turn || g.phase === 'done' || rt.slots.cards.seats.find(s => s.id === g.turn)?.user) return;
    const seat = g.turn, d = CoincheAI.decide(Coinche.coincheView(g, seat), seat, rt.slots.cards.settings.bots ?? 'moyen');   // its seat's view, the host's level
    await this.coincheApply(rt, seat, 'say' in d ? d : { play: g.hands[seat]!.find(x => x.id === d.play.id)! }).catch(async () => {
      if (g.phase === 'bid') await this.coincheApply(rt, seat, { say: { kind: 'pass' } }); else await this.coincheApply(rt, seat, { play: Coinche.legal(g, seat)[0]! });
    });
  }

  /** The host's way of dealing at the Tarot and the Coinche (from the next deal): random, or as at a table. */
  async cardsDealMode(socket: Socket, mode: 'random' | 'classic') {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, dealMode: mode };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    await this.rooms.say(rt, mode === 'classic' ? 'Distribution à l\'ancienne : les plis ramassés, coupés, distribués par paquets (plus de mains déséquilibrées), à partir de la donne suivante.'
      : 'Distribution aléatoire : le paquet mélangé à chaque donne, à partir de la donne suivante.');
    await this.emitCards(rt);
  }

  /** « Continuer » after a deal's count: the next deal once every seated player clicked it. */
  async coincheReady(socket: Socket) {
    const rt = this.rooms.roomOf(socket), c = rt.slots.cards, me = (socket.data as SocketData).account.id;
    if (c.game !== 'coinche' || !c.coinche || c.coinche.phase !== 'done' || c.coinche.over || !c.next) throw new UserError('Il n\'y a pas de donne à suivre.');
    if (!Table.seatOfUser(c.seats, me)) throw new UserError('Tu n\'es pas à la table.');
    if (!c.next.ready.includes(me)) c.next.ready.push(me);
    await this.afterCoinche(rt, c.coinche.turn);
  }

  /** The host's target (from the next game). */
  async coincheSetTarget(socket: Socket, target: number) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, coincheTarget: target };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    await this.rooms.say(rt, `Coinche : partie en ${target} points${this.inRound(rt) && rt.slots.cards.game === 'coinche' ? ', à partir de la partie suivante' : ''}.`);
    await this.emitCards(rt);
  }

  // ---------------------------------------------------------------- /effet (openspec: chat-activity, Effets visuels)
  /** An effect for everyone, now: checked (who, how many at once), its picture resolved (a screamer's image is relayed,
   *  never stored), sent on the « fx » channel. */
  async playEffect(socket: Socket, v: { kind: EffectKind; target?: string | null; pic?: { kind: 'image' | 'sticker' | 'gif' | 'emoji'; value: string } }) {
    const rt = this.rooms.roomOf(socket), me = (socket.data as SocketData).account.id, now = Date.now();
    const photo = ON_PHOTO.includes(v.kind), group = photo ? 'photo' : v.kind;
    const target = v.target ? (await this.rooms.members(rt, v.target))[0] : null;
    if (v.target && !target) throw new UserError('Ce joueur n\'est pas dans le salon.');
    if (photo && !target) throw new UserError(`/effet ${v.kind} vise un joueur : par exemple /effet ${v.kind} Léa.`);
    const running = (rt.slots.fx[group] ?? []).filter(end => end > now), max = EFFECT_PARALLEL[v.kind] ?? 1;
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
        const lib = await this.library.stickers(rt), st = lib.find(x => x.id === p.value);
        if (!st) throw new UserError('Ce sticker n\'est plus dans le salon.');
        pic = { kind: 'image', src: st.src };
      } else if (p.kind === 'gif') {
        let host = '';
        try { const u = new URL(p.value); host = u.protocol === 'https:' ? u.hostname : ''; } catch { /* not an address */ }
        if (!/(^|\.)(klipy\.com|giphy\.com)$/.test(host)) throw new UserError('GIF refusé : il doit venir de KLIPY ou GIPHY.');
        pic = { kind: 'image', src: p.value };
      } else if (p.value.startsWith(':')) {
        const e = (await this.library.emoji(rt)).find(x => `:${x.name}:` === p.value);
        if (!e) throw new UserError('Cet emoji n\'existe pas dans le salon.');
        pic = { kind: 'image', src: e.url };
      } else {
        if (p.value.length > 32 || /[<>&"]/.test(p.value)) throw new UserError('Emoji refusé.');
        pic = { kind: 'emoji', src: p.value };
      }
    }
    rt.slots.fx[group] = [...running, now + EFFECT_MS[v.kind]];
    const effect: EffectView = { id: randomUUID(), kind: v.kind, by: me, target: target?.id ?? null, hue: target?.hue ?? null, pic };
    this.rooms.io.to(`room:${rt.room.id}`).emit('fx', effect);
  }

  /** The host dresses a trump with a picture (its « trump » format), or gives it back its default look (null). */
  async tarotArt(socket: Socket, card: number, mediaId: string | null) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    const key = String(card), old = rt.slots.cards.art[key];
    if (mediaId) {
      const m = await this.media.picture(mediaId, 'trump');
      await this.db.insert(trumpArt).values({ roomId: rt.room.id, card: key, mediaId: m.id }).onConflictDoUpdate({ target: [trumpArt.roomId, trumpArt.card], set: { mediaId: m.id } });
      rt.slots.cards.art[key] = m.id;
    } else {
      await this.db.delete(trumpArt).where(and(eq(trumpArt.roomId, rt.room.id), eq(trumpArt.card, key)));
      delete rt.slots.cards.art[key];
    }
    if (old && old !== mediaId) void this.media.sweep([old]);   // no longer used: deleted (unless used elsewhere)
    await this.emitCards(rt);
  }

  async tarotArtReset(socket: Socket) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    const old = Object.values(rt.slots.cards.art);
    await this.db.delete(trumpArt).where(eq(trumpArt.roomId, rt.room.id));
    rt.slots.cards.art = {};
    if (old.length) void this.media.sweep(old);
    await this.rooms.say(rt, 'Les atouts reprennent leur habillage par défaut.');
    await this.emitCards(rt);
  }

  async tarotTricks(socket: Socket, show: boolean) {
    const rt = this.rooms.roomOf(socket);
    this.rooms.hostOnly(rt, (socket.data as SocketData).account.id);
    rt.slots.cards.showTricks = show;
    await this.emitCards(rt);
  }

  // ---------------------------------------------------------------- the console's notices
  private onAdmin(n: AdminNotice) {
    if (n.type === 'room-deleted') {
      for (const rt of this.rooms.all()) if (rt.room.key === n.key) {
        const id = rt.room.id;
        this.rooms.io.to(`room:${id}`).emit('room-gone', { key: n.key });
        this.rooms.io.in(`room:${id}`).socketsLeave(`room:${id}`);
        for (const m of rt.members.values()) if (m.grace) clearTimeout(m.grace);
        this.rooms.remove(id);
        this.log.log(`salon ${n.key} supprimé par un admin`);
      }
    } else if (n.type === 'code-reset') this.rooms.kickAccount(n.accountId, null);
    else if (n.type === 'message-removed') { const rt = this.rooms.get(n.roomId); if (rt) this.rooms.emit(rt, { type: 'message-removed', id: n.id }); }
    else if (n.type === 'members-changed' || n.type === 'room-changed') {
      for (const rt of this.rooms.all()) if ('roomId' in n ? rt.room.id === n.roomId : rt.room.key === n.key) void this.resync(rt);
    }
  }

  /** Something changed behind the room's back (the console): each player gets the room's full state again. */
  private async resync(rt: RoomRt) {
    const [fresh] = await this.db.select().from(rooms).where(eq(rooms.id, rt.room.id));
    if (fresh) rt.room = fresh;
    rt.seq++;
    for (const s of await this.rooms.io.in(`room:${rt.room.id}`).fetchSockets()) s.emit('state', await this.state(rt, (s.data as SocketData).account.id));
  }


}
