// The Sondage (openspec: define-game-concept, Sondage): the host publishes a question (choices with a picture, free
// answers, a gradient in 1D or 2D), the players answer within its time, the results for everyone (anonymous when
// secret). An open poll is not lost when the activity changes: it goes on in the chat (ChatPolls).
import { Injectable } from '@nestjs/common';
import { Poll } from '@slopesque/engines';
import type { ActivityChoice, Intent, PollAnswer, PollPicView, PollView } from '@slopesque/shared';
import { MediaService } from '../../media/media.service.js';
import { RoomLibrary } from '../../chat/library.service.js';
import { UserError } from '../../errors.js';
import type { Activity } from '../../rooms/activity.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';
import { validAnswer } from './answers.js';
import { ChatPolls } from './chat-poll.service.js';

interface PollRt {
  phase: PollView['phase']; round: number; seconds: number; secret: boolean; poll: PollView['poll']; answers: Record<string, PollAnswer>;
  host: string | null; deadline: number | null; timer: NodeJS.Timeout | null;
}
declare module '../../rooms/room-rt.js' { interface RoomSlots { poll: PollRt } }

@Injectable()
export class PollActivity implements Activity {
  readonly key = 'poll';

  constructor(private readonly rooms: RoomRegistry, private readonly chatPolls: ChatPolls, private readonly media: MediaService,
    private readonly library: RoomLibrary) {}

  init(rt: RoomRt) {
    const ps = (rt.room.rules.poll ?? {}) as { seconds?: number; secret?: boolean; round?: number };
    rt.slots.poll = { phase: 'writing', round: ps.round ?? 1, seconds: ps.seconds ?? 300, secret: ps.secret ?? false,
      poll: null, answers: {}, host: null, deadline: null, timer: null };
    this.chatPolls.init(rt);
  }

  async restore(rt: RoomRt) {
    await this.chatPolls.restore(rt);
    return this.rooms.wasLive(rt, 'poll') ? 'le sondage' : null;
  }

  view(rt: RoomRt, me: string) { return { poll: this.pollView(rt, me) }; }

  /** Not lost: the open poll becomes a message of the chat (its time and its answers kept), answered there; the
   *  Sondage starts again from a blank page. */
  async cancel(rt: RoomRt, to: ActivityChoice) {
    const p = rt.slots.poll;
    if (p.phase !== 'open' || to.activity === 'poll') return null;
    if (p.timer) clearTimeout(p.timer);
    const cp = { poll: p.poll!, round: p.round, host: p.host, secret: p.secret, seconds: p.seconds, deadline: p.deadline ?? Date.now(),
      answers: { ...p.answers }, closed: false, outcome: null };
    await this.chatPolls.open(rt, cp);
    rt.slots.poll = { ...p, phase: 'writing', round: p.round + 1, poll: null, answers: {}, host: null, deadline: null, timer: null };
    await this.save(rt);
    await this.rooms.setLive(rt, 'poll', null);
    await this.emit(rt);
    await this.rooms.say(rt, `Le sondage « ${cp.poll.question} » continue dans le chat : réponds-y directement.`, true);
    return null;
  }

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
  private async emit(rt: RoomRt) { await this.rooms.emitEach(rt, me => ({ type: 'poll', poll: this.pollView(rt, me) })); }
  private async save(rt: RoomRt) {
    const p = rt.slots.poll;
    await this.rooms.saveRules(rt, 'poll', { seconds: p.seconds, secret: p.secret, round: p.round });
  }

  async settings(rt: RoomRt, me: string, v: { seconds?: number; secret?: boolean }) {
    this.rooms.hostOnly(rt, me);
    if (v.seconds) rt.slots.poll.seconds = v.seconds;
    if (v.secret !== undefined) rt.slots.poll.secret = v.secret;
    await this.save(rt);
    await this.emit(rt);
  }

  async publish(rt: RoomRt, me: string, v: Intent<'poll:publish'>) {
    this.rooms.hostOnly(rt, me);
    if (rt.slots.poll.phase === 'open') throw new UserError('Un sondage est déjà ouvert.');
    const choices = v.kind === 'free' ? [] : v.choices;
    const pics: (PollPicView | null)[] = [];
    if (v.kind === 'choices') for (let i = 0; i < choices.length; i++) {
      const p = v.pics[i];
      let pic: PollPicView | null = null;
      if (p?.gif) pic = { kind: 'gif', src: p.gif.url, w: p.gif.w, h: p.gif.h };   // a link to its provider, as in the chat
      else if (p?.mediaId) {
        const m = await this.media.picture(p.mediaId, 'poll');
        pic = { kind: 'image', src: this.media.url(m.id), w: m.width, h: m.height };
      }
      else if (p?.stickerId) {
        const st = await this.library.sticker(rt, p.stickerId);
        if (st) pic = { kind: 'sticker', ...st };
      }
      pics.push(pic);
    }
    const draft = { kind: v.kind, question: v.question, choices, pics };
    if (!Poll.ready(draft as Poll.PollDraft) || (v.kind !== 'free' && (choices.length < Poll.MIN_CHOICES))) {
      throw new UserError('Il manque la question ou un choix.');
    }
    await this.rooms.enter(rt, { activity: 'poll' });
    const seconds = rt.slots.poll.seconds;
    rt.slots.poll = { ...rt.slots.poll, phase: 'open', poll: draft, answers: {}, host: rt.room.hostId,
      deadline: Date.now() + seconds * 1000, timer: null };
    rt.slots.poll.timer = setTimeout(() => void this.close(rt), seconds * 1000);
    await this.rooms.setLive(rt, 'poll', v.question);
    const pictures = v.pics.flatMap(x => (x?.mediaId ? [x.mediaId] : []));
    await this.media.keepFor(pictures, rt.slots.poll.seconds * 1000);   // not swept before the poll's end
    await this.rooms.say(rt, `Sondage ${rt.slots.poll.round} : « ${v.question} »`);
    await this.emit(rt);
  }

  async answer(rt: RoomRt, me: string, answer: PollAnswer) {
    const p = rt.slots.poll;
    if (p.phase !== 'open' || !p.poll) throw new UserError('Le sondage est fermé.');
    if (me !== rt.room.hostId && !(await this.rooms.playingIds(rt)).has(me)) throw new UserError('Clique d\'abord « Participer ».');
    if (me in p.answers) throw new UserError('Tu as déjà répondu.');
    if (!validAnswer(p.poll, answer)) throw new UserError('Réponse invalide.');
    p.answers[me] = answer;
    await this.emit(rt);
    const playing = await this.rooms.playingIds(rt);
    const candidates = this.rooms.connected(rt).filter(id => playing.has(id) && id !== p.host);
    if (candidates.length && candidates.every(id => id in p.answers)) await this.close(rt);   // every candidate answered
  }

  private async close(rt: RoomRt) {
    if (rt.slots.poll.phase !== 'open') return;
    if (rt.slots.poll.timer) clearTimeout(rt.slots.poll.timer);
    rt.slots.poll = { ...rt.slots.poll, phase: 'results', deadline: null, timer: null };
    await this.rooms.setLive(rt, 'poll', null);
    const n = Object.keys(rt.slots.poll.answers).length;
    await this.rooms.say(rt, `Sondage terminé : ${n} réponse${n > 1 ? 's' : ''}.`);
    await this.emit(rt);
  }

  async end(rt: RoomRt, me: string) { this.rooms.hostOnly(rt, me); await this.close(rt); }

  async next(rt: RoomRt, me: string) {
    this.rooms.hostOnly(rt, me);
    const p = rt.slots.poll;
    if (p.phase === 'open') throw new UserError('Le sondage est encore ouvert.');
    rt.slots.poll = { ...p, phase: 'writing', round: p.round + 1, poll: null, answers: {}, host: null, deadline: null };
    await this.save(rt);
    await this.emit(rt);
  }
}
