// The Roulette (openspec: define-game-concept, Roulette): the host builds a wheel of weighted proposals (everyone sees
// it as it is typed), the server draws the angle, every panel animates the same spin, the result comes after it.
import { Injectable } from '@nestjs/common';
import { Wheel } from '@slopesque/engines';
import type { ActivityChoice, WheelView } from '@slopesque/shared';
import { UserError } from '../../errors.js';
import type { Activity } from '../../rooms/activity.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';

interface WheelRt {
  phase: WheelView['phase']; items: WheelView['items']; spin: WheelView['spin']; needle: number; round: number;
  timer: NodeJS.Timeout | null;
}
declare module '../../rooms/room-rt.js' { interface RoomSlots { wheel: WheelRt } }

/** Why a wheel can't be spun (Wheel.problem), in words. */
const PROBLEMS = { over: 'Le total des poids dépasse 100.', invalid: 'Un poids n\'est pas un nombre.',
  empty: 'Il faut au moins 2 propositions, toutes écrites.', zero: 'Tous les poids sont à 0.' };

@Injectable()
export class WheelActivity implements Activity {
  readonly key = 'wheel';

  constructor(private readonly rooms: RoomRegistry) {}

  init(rt: RoomRt) {
    const ws = (rt.room.rules.wheel ?? {}) as { items?: WheelView['items']; needle?: number; round?: number };
    const items = ws.items ?? [{ label: '', weight: '' }, { label: '', weight: '' }];
    rt.slots.wheel = { phase: 'writing', items, spin: null, needle: ws.needle ?? 0, round: ws.round ?? 1, timer: null };
  }

  view(rt: RoomRt) { return { wheel: this.wheelView(rt) }; }

  /** A draw cut short: lost, the wheel back to its writing. */
  async cancel(rt: RoomRt, to: ActivityChoice) {
    const w = rt.slots.wheel;
    if (w.phase !== 'spinning' || to.activity === 'wheel') return null;
    if (w.timer) clearTimeout(w.timer);
    rt.slots.wheel = { ...w, phase: 'writing', spin: null, timer: null };
    this.emit(rt);
    return 'le tirage';
  }

  private wheelView(rt: RoomRt): WheelView {
    const w = rt.slots.wheel;
    return { phase: w.phase, items: w.items, spin: w.spin, needle: w.needle, round: w.round };
  }
  private emit(rt: RoomRt) { this.rooms.emit(rt, { type: 'wheel', wheel: this.wheelView(rt) }); }

  /** The host builds the wheel: everyone sees it as it is typed. */
  async set(rt: RoomRt, me: string, items: WheelView['items']) {
    this.rooms.hostOnly(rt, me);
    const w = rt.slots.wheel;
    if (w.phase === 'spinning') throw new UserError('La roue tourne.');
    const after = w.phase === 'result';   // changed after a draw: the next one
    rt.slots.wheel = { ...w, items, phase: after ? 'writing' : w.phase, round: w.round + (after ? 1 : 0) };
    await this.rooms.saveRules(rt, 'wheel', { items, needle: rt.slots.wheel.needle });
    this.emit(rt);
  }

  /** The server draws the angle; every panel animates the same spin, the result comes after it. */
  async spin(rt: RoomRt, me: string) {
    this.rooms.hostOnly(rt, me);
    if (rt.slots.wheel.phase === 'spinning') throw new UserError('La roue tourne déjà.');
    const why = Wheel.problem(rt.slots.wheel.items);
    if (why) throw new UserError(PROBLEMS[why]);
    await this.rooms.enter(rt, { activity: 'wheel' });
    const w = rt.slots.wheel, spin = Wheel.draw(w.items, Date.now(), w.needle);
    rt.slots.wheel = { ...w, phase: 'spinning', spin, timer: setTimeout(() => void this.stop(rt), Wheel.SPIN_MS) };
    await this.rooms.say(rt, 'La roue tourne…');
    this.emit(rt);
  }

  private async stop(rt: RoomRt) {
    const s = rt.slots.wheel.spin;
    if (rt.slots.wheel.phase !== 'spinning' || !s) return;
    rt.slots.wheel = { ...rt.slots.wheel, phase: 'result', needle: s.angle, timer: null };
    await this.rooms.saveRules(rt, 'wheel', { items: rt.slots.wheel.items, needle: s.angle, round: rt.slots.wheel.round + 1 });
    const label = s.items[s.winner]?.label.trim() || `Proposition ${s.winner + 1}`;
    await this.rooms.say(rt, `Roulette : « ${label} » (${Math.round(s.shares[s.winner] ?? 0)} % de chances).`);
    this.emit(rt);
  }

  /** Back to the editing (after a draw: the next one). */
  async edit(rt: RoomRt, me: string) {
    this.rooms.hostOnly(rt, me);
    const w = rt.slots.wheel;
    if (w.phase === 'spinning') throw new UserError('La roue tourne.');
    rt.slots.wheel = { ...w, phase: 'writing', spin: null, round: w.round + (w.phase === 'result' ? 1 : 0) };
    this.emit(rt);
  }
}
