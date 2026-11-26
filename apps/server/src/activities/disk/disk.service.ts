// The Demi-disque (openspec: define-game-concept): the host writes a word and places his answer, the candidates
// place theirs within the round's time, the points go by distance (to the Palmarès too). Its rules are kept with the
// room's; a round running when the server stopped is lost, and it is said.
import { Injectable } from '@nestjs/common';
import * as D from '@slopesque/engines';
import type { ActivityChoice } from '@slopesque/shared';
import type { Account } from '../../accounts/accounts.service.js';
import { UserError } from '../../errors.js';
import type { Activity } from '../../rooms/activity.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';
import { Palmares } from '../palmares/palmares.service.js';

interface DiskRt { state: D.DiskState; timer: NodeJS.Timeout | null }
declare module '../../rooms/room-rt.js' { interface RoomSlots { disk: DiskRt } }

/** The engine's refusal, said to the player. */
const said = <T>(f: () => T): T => { try { return f(); } catch (e) { if (e instanceof D.DiskError) throw new UserError(e.message); throw e; } };

@Injectable()
export class DiskActivity implements Activity {
  readonly key = 'disk';

  constructor(private readonly rooms: RoomRegistry, private readonly palmares: Palmares) {}

  init(rt: RoomRt) {
    const saved = (rt.room.rules.disk ?? {}) as { rules?: D.DiskRules; round?: number };
    const round = saved.round ?? 1;
    rt.slots.disk = { state: { ...D.newDisk({ ...D.DEFAULT_RULES, ...saved.rules }), round, phase: round > 1 ? 'writing' : 'lobby' }, timer: null };
  }

  /** A round was running: it starts again from the writing (its rules saved without it). */
  async restore(rt: RoomRt) {
    if (!(rt.room.rules.disk as { guessing?: boolean } | undefined)?.guessing) return null;
    await this.save(rt);
    return 'le tour du Demi-disque';
  }

  /** Each player gets the round as he may see it (the host's answer hidden from the others until the reveal). */
  view(rt: RoomRt, me: string) { return { disk: D.diskView(rt.slots.disk.state, me) }; }

  async cancel(rt: RoomRt, to: ActivityChoice) {
    const d = rt.slots.disk;
    if (d.state.phase !== 'guessing' || to.activity === 'disk') return null;
    if (d.timer) { clearTimeout(d.timer); d.timer = null; }
    d.state = { ...D.newDisk({ ...d.state.rules, ...d.state.pending }), round: d.state.round, phase: 'writing' };
    await this.save(rt); await this.emit(rt);
    return 'le tour du Demi-disque';
  }

  /** The format chosen with the activity: its voting mode. */
  async choose(rt: RoomRt, to: ActivityChoice) {
    const d = rt.slots.disk;
    if (to.activity !== 'disk' || !to.mode || to.mode === { ...d.state.rules, ...d.state.pending }.mode) return;
    d.state = D.setRules(d.state, { mode: to.mode }).state;
    await this.save(rt);
    await this.emit(rt);
  }

  /** « Réinitialiser la partie »: from the first round again. */
  async reset(rt: RoomRt) {
    const d = rt.slots.disk;
    if (d.timer) { clearTimeout(d.timer); d.timer = null; }
    d.state = { ...D.newDisk(d.state.rules), round: 1 };
    await this.save(rt);
    await this.emit(rt);
  }

  private async emit(rt: RoomRt) { await this.rooms.emitEach(rt, me => ({ type: 'disk', disk: D.diskView(rt.slots.disk.state, me) })); }
  private async save(rt: RoomRt) {
    const s = rt.slots.disk.state;
    await this.rooms.saveRules(rt, 'disk', { rules: { ...s.rules, ...s.pending }, round: s.round, guessing: s.phase === 'guessing' });
  }
  /** The candidates of a round: the players who joined (« Participer »), connected, except the host. */
  private candidates(rt: RoomRt, playing: Set<string>) { return this.rooms.connected(rt).filter(id => playing.has(id) && id !== rt.slots.disk.state.host); }

  async rules(rt: RoomRt, me: string, changes: Partial<D.DiskRules>) {
    this.rooms.hostOnly(rt, me);
    const d = rt.slots.disk, r = D.setRules(d.state, changes);
    d.state = r.state;
    await this.save(rt);
    await this.emit(rt);
    return r.now ? 'now' as const : 'pending' as const;
  }

  /** « Participer »: a candidate of the next rounds. */
  async join(rt: RoomRt, me: Account) {
    await this.rooms.setPlaying(rt, me.id, true);
    await this.rooms.say(rt, `${me.name} rejoint la partie.`);
  }

  async start(rt: RoomRt, me: string, word: string, target: number) {
    this.rooms.hostOnly(rt, me);
    const d = rt.slots.disk;
    d.state = said(() => D.startRound(d.state.phase === 'reveal' || d.state.phase === 'lobby' ? D.nextRound(d.state) : d.state, rt.room.hostId!, word, target));
    await this.rooms.enter(rt, { activity: 'disk', mode: d.state.mode });
    await this.save(rt);
    await this.rooms.say(rt, `Tour ${d.state.round} : « ${d.state.word} »`);
    if (d.timer) clearTimeout(d.timer);
    d.timer = setTimeout(() => void this.reveal(rt), d.state.deadline! - Date.now());
    await this.emit(rt);
  }

  async guess(rt: RoomRt, me: string, value: number) {
    if (!(await this.rooms.playingIds(rt)).has(me)) throw new UserError('Clique d\'abord « Participer ».');
    const d = rt.slots.disk;
    d.state = said(() => D.guess(d.state, me, value));
    await this.emit(rt);
    const playing = await this.rooms.playingIds(rt);
    if (D.allValidated(d.state, this.candidates(rt, playing))) await this.reveal(rt);   // everyone validated: no need to wait
  }

  /** The end of the answer time (or everyone validated): the points, the Palmarès, the pending rules. */
  private async reveal(rt: RoomRt) {
    const d = rt.slots.disk;
    if (d.state.phase !== 'guessing') return;
    if (d.timer) { clearTimeout(d.timer); d.timer = null; }
    const r = D.reveal(d.state);
    d.state = r.state;
    for (const [id, pts] of Object.entries(r.points)) if (pts) await this.rooms.addScore(rt, id, 'disk', pts);
    const top = Math.max(0, ...Object.values(r.state.results).map(x => x.points));
    const humans = Object.keys(r.state.results).length;   // the Palmarès: a round counts for the level with 2 players or more
    for (const [id, x] of Object.entries(r.state.results)) {
      await this.palmares.record(rt, 'disk', { account: id, won: x.points === top && top > 0, pts: x.points, perfect: x.perfect, humans });
    }
    await this.save(rt);
    await this.emit(rt);
    for (const id of Object.keys(r.points)) await this.rooms.emitMember(rt, id);
    if (r.best) await this.rooms.say(rt, `${await this.rooms.nameOf(rt, r.best[0])} gagne le tour (+${r.best[1].points}${r.best[1].perfect ? ', perfect !' : ''})`);
  }

  async next(rt: RoomRt, me: string) {
    this.rooms.hostOnly(rt, me);
    const d = rt.slots.disk;
    if (d.state.phase === 'guessing') throw new UserError('Le tour n\'est pas fini.');
    d.state = D.nextRound(d.state);
    await this.save(rt);
    await this.emit(rt);
  }
}
