// The Trou du cul (openspec: define-game-concept, Trou du cul): rounds on the same seats, the exchanges of the roles,
// the points of each role to the seat's last player, the robots on the free seats.
import { Injectable } from '@nestjs/common';
import { Table, Tdc } from '@slopesque/engines';
import { UserError } from '../../../errors.js';
import { RoomRegistry } from '../../../rooms/room-registry.js';
import type { RoomRt } from '../../../rooms/room-rt.js';
import { Palmares } from '../../palmares/palmares.service.js';
import type { CardGame, CardMove } from '../table.js';
import { CardsTable } from '../table.service.js';

declare module '../../../rooms/room-rt.js' { interface RoomSlots { tdc: Tdc.Tdc | null } }

@Injectable()
export class TdcGame implements CardGame {
  readonly key = 'tdc';

  constructor(private readonly table: CardsTable, private readonly rooms: RoomRegistry, private readonly palmares: Palmares) {
    table.register(this);
  }

  init(rt: RoomRt) { rt.slots.tdc = null; }
  clear(rt: RoomRt) { rt.slots.tdc = null; }
  inRound(rt: RoomRt) { return !!rt.slots.tdc && rt.slots.tdc.turn !== null; }
  turn(rt: RoomRt) { return rt.slots.tdc?.turn ?? null; }
  view(rt: RoomRt, seat: string | null) { const t = rt.slots.tdc; return { tdc: t ? Tdc.tdcView(t, seat) : null }; }

  /** A new round (host): the first seats the players who joined (« Participer »), robots up to 3; then the same seats. */
  async deal(rt: RoomRt) {
    const c = rt.slots.cards;
    if (c.game === 'tdc' && rt.slots.tdc && rt.slots.tdc.turn !== null) throw new UserError('Une manche est en cours.');
    const n = c.settings.tdc, fresh = c.game !== 'tdc' || c.seats.length !== n || !rt.slots.tdc;   // a new table, or other seats
    this.table.prepare(rt, 'tdc');
    c.players = n;
    this.table.credit(rt);
    c.paid = {};
    const names = new Map<string, string>();
    for (const s of c.seats) names.set(s.id, await this.table.seatName(rt, s.id));
    rt.slots.tdc = Tdc.deal(c.seats.map(s => s.id), fresh ? null : rt.slots.tdc, id => names.get(id) ?? '?');
    await this.rooms.setLive(rt, 'cards', 'tdc');
    c.settled = false;
    c.turnSince = Date.now();
    await this.rooms.enter(rt, { activity: 'cards', cardGame: 'tdc' });
    const robots = c.seats.filter(s => !s.user).length, t = rt.slots.tdc!;
    await this.rooms.say(rt,
      `Trou du cul, manche ${t.round} : ${c.seats.length} places${robots ? `, dont ${robots} robot${robots > 1 ? 's' : ''}` : ''}.`);
    for (const e of t.exchanges) await this.rooms.say(rt, `Échange : ${e}`);
    await this.table.after(rt);
  }

  async move(rt: RoomRt, me: string, move: CardMove) {
    const c = rt.slots.cards, t = rt.slots.tdc, seat = Table.seatOfUser(c.seats, me);
    if (!t || !seat) throw new UserError('Tu n\'es pas à la table.');
    if (t.turn !== seat.id) throw new UserError('Ce n\'est pas ton tour.');
    const ok = 'play' in move ? Tdc.play(t, seat.id, t.hands[seat.id]!.filter(x => move.play.includes(x.id)).slice(0, move.play.length))
      : Tdc.pass(t, seat.id);
    if (!ok) throw new UserError('pass' in move ? 'Tu ouvres le pli : tu ne peux pas passer.'
      : 'Pas jouable : autant de cartes que le pli, de même valeur, plus fortes.');
    await this.table.after(rt);
  }

  /** After a move: the clock of the turn, the end of the round (points to the last player of each seat), the robots. */
  async after(rt: RoomRt, before: string | null = null) {
    const c = rt.slots.cards, t = rt.slots.tdc;
    if (!t) { await this.table.emit(rt); return; }   // before the first deal: the seats changed
    this.table.restart(rt, t.turn, before);
    if (t.turn === null && !c.settled) {   // the round's end, counted once
      c.settled = true;
      await this.rooms.setLive(rt, 'cards', null);
      const humans = c.seats.filter(s => s.credit).length;   // the Palmarès: alone with robots, it counts only as played
      for (const sid of t.out) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, role = t.roles[sid]!;
        c.paid[sid] = uid;
        if (!uid) continue;
        await this.rooms.addScore(rt, uid, 'tdc', Tdc.ROLES[role].points);
        await this.palmares.record(rt, 'tdc', { account: uid, won: role === 'president', role, humans });
        await this.rooms.emitMember(rt, uid);
      }
      const parts = [];
      for (const sid of t.out) parts.push(`${await this.table.seatName(rt, sid)} ${Tdc.ROLES[t.roles[sid]!].name}`);
      await this.rooms.say(rt, `Manche ${t.round} : ${parts.join(', ')}.`);
      const settled = Table.settle(c.seats);
      c.seats = settled.seats;
      for (const u of settled.freed) await this.rooms.say(rt,
        `${await this.rooms.nameOf(rt, u)} a quitté la table : un robot prend sa place.`);
    } else if (t.turn !== null) {
      const s = c.seats.find(x => x.id === t.turn);
      const opens = !t.trick.length && t.lastTrick.length > 0;   // a trick just taken: seen a moment before the next lead
      if (!s?.user) c.robot = setTimeout(() => void this.robot(rt), this.table.env.ROBOT_DELAY_MS * (opens ? 1.6 : 1));   // a robot's seat
      else this.table.waitFor(rt);
    }
    await this.table.emit(rt);
  }

  private async robot(rt: RoomRt) {
    const t = rt.slots.tdc;
    if (!t || t.turn === null || rt.slots.cards.seats.find(s => s.id === t.turn)?.user) return;
    const turn = t.turn, m = Tdc.botMove(t, turn);
    if ('play' in m) Tdc.play(t, turn, m.play); else Tdc.pass(t, turn);
    await this.table.after(rt, turn);
  }
}
