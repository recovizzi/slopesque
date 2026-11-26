// The Tarot at 4 or 5 (openspec: define-game-concept, Tarot): the bidding, the call of a King at 5, the dog and the
// écart, the poignées and the chelem, the tricks, each mark to the seat's last player; robots on the free seats.
import { Injectable } from '@nestjs/common';
import { Table, Tarot, TarotAI } from '@slopesque/engines';
import { UserError } from '../../../errors.js';
import { RoomRegistry } from '../../../rooms/room-registry.js';
import type { RoomRt } from '../../../rooms/room-rt.js';
import { Palmares } from '../../palmares/palmares.service.js';
import type { CardGame, CardMove } from '../table.js';
import { CardsTable } from '../table.service.js';

declare module '../../../rooms/room-rt.js' { interface RoomSlots { tarot: Tarot.Tarot | null } }

type Act = { bid: Tarot.Bid } | { call: string } | { discard: Tarot.TCard[] } | { play: Tarot.TCard };

@Injectable()
export class TarotGame implements CardGame {
  readonly key = 'tarot';

  constructor(private readonly table: CardsTable, private readonly rooms: RoomRegistry, private readonly palmares: Palmares) {
    table.register(this);
  }

  init(rt: RoomRt) { rt.slots.tarot = null; }
  clear(rt: RoomRt) { rt.slots.tarot = null; }
  inRound(rt: RoomRt) { return !!rt.slots.tarot && rt.slots.tarot.phase !== 'done'; }
  turn(rt: RoomRt) { return rt.slots.tarot?.turn ?? null; }
  view(rt: RoomRt, seat: string | null) { const t = rt.slots.tarot; return { tarot: t ? Tarot.tarotView(t, seat) : null }; }

  deal(rt: RoomRt) { return this.dealAt(rt, rt.slots.cards.settings.tarot as 4 | 5); }

  /** A new deal at 4 or 5: the same seats while the number holds; robots take the free ones. */
  private async dealAt(rt: RoomRt, n: 4 | 5) {
    const c = rt.slots.cards;
    if (c.game === 'tarot' && rt.slots.tarot && rt.slots.tarot.phase !== 'done') throw new UserError('Une donne est en cours.');
    if (c.game !== 'tarot' || c.players !== n || c.seats.length !== n) {
      c.settings = { ...c.settings, tarot: n };
      this.table.prepare(rt, 'tarot');
    }
    c.game = 'tarot'; c.players = n;
    this.table.credit(rt);
    c.paid = {}; c.settled = false;
    const t = rt.slots.tarot = Tarot.deal(c.seats.map(s => s.id), rt.slots.tarot, c.settings.dealMode ?? 'random');
    await this.rooms.setLive(rt, 'cards', 'tarot');
    c.turnSince = Date.now();
    const names = [];
    for (const s of t.seats) names.push(await this.table.seatName(rt, s));
    await this.rooms.say(rt, `Tarot à ${n}, donne ${t.deal} : ${names.join(', ')}.`);
    await this.after(rt);
  }

  async move(rt: RoomRt, me: string, move: CardMove) { if ('play' in move) await this.act(rt, me, { play: move.play[0]! }); }

  /** A player's bid, call, écart or card (checked by the rules), then what follows. */
  async act(rt: RoomRt, me: string, act: { bid: Tarot.Bid } | { call: string } | { discard: string[] } | { play: string }) {
    const c = rt.slots.cards, t = rt.slots.tarot, seat = Table.seatOfUser(c.seats, me);
    if (!t || !seat || c.game !== 'tarot') throw new UserError('Tu n\'es pas à la table.');
    const hand = t.hands[seat.id] ?? [];
    await this.apply(rt, seat.id, 'bid' in act ? act : 'call' in act ? act
      : 'discard' in act ? { discard: hand.filter(x => act.discard.includes(x.id)) } : { play: hand.find(x => x.id === act.play)! });
  }

  private async apply(rt: RoomRt, seat: string, act: Act) {
    const t = rt.slots.tarot!, before = t.phase, revealed = t.revealed, turn = t.turn;
    const ok = 'bid' in act ? Tarot.bid(t, seat, act.bid) : 'call' in act ? Tarot.call(t, seat, act.call)
      : 'discard' in act ? (seat === t.taker && Tarot.discard(t, act.discard)) : !!act.play && Tarot.play(t, seat, act.play);
    if (!ok) {
      throw new UserError('bid' in act ? 'Enchère impossible.' : 'call' in act ? 'Carte impossible à appeler.'
        : 'discard' in act ? `Écart impossible : ${Tarot.ecartSize(t)} cartes, ni Roi ni bout.`
          : 'Carte impossible : fournis la couleur, sinon coupe (en montant si tu peux).');
    }
    const name = (id: string) => this.table.seatName(rt, id);
    if (before === 'bid' && t.phase !== 'bid') await this.rooms.say(rt,
      t.taker ? `${await name(t.taker)} prend : ${Tarot.BIDS[t.bid!].name}.` : t.note);
    if ('call' in act && t.called) await this.rooms.say(rt, `${await name(seat)} appelle ${Tarot.cardName(t.called)}.`);
    if (before !== 'play' && t.phase === 'play' && t.taker && !rt.slots.cards.seats.find(s => s.id === t.taker)?.user
      && TarotAI.aiChelem(Tarot.tarotView(t, t.taker), t.taker, rt.slots.cards.settings.bots ?? 'moyen')
      && Tarot.announceChelem(t, t.taker)) {
      await this.rooms.say(rt, `${await name(t.taker)} annonce un chelem : tous les plis !`);
    }
    if (!revealed && t.revealed && t.partner) {
      const partner = await name(t.partner), side = t.partner === t.taker ? 'seul contre 4' : `partenaire de ${await name(t.taker!)}`;
      await this.rooms.say(rt, `${partner} joue ${Tarot.cardName(t.called!)} : ${side}.`);
    }
    // the tables show it before the robots go on: the take (2 s), the called card (2,8 s), the trick taken (2 s)
    const pause = before === 'bid' && t.taker ? 2.6 : 'call' in act ? 3.4 : 'play' in act && !t.trick.length ? 2.4 : 1;
    await this.after(rt, turn, pause);
  }

  /** After a step: the deal's end (each mark to the last player of each seat), the robots (on their seat's view). */
  async after(rt: RoomRt, before: string | null = null, pause = 1) {
    const c = rt.slots.cards, t = rt.slots.tarot, delay = this.table.env.ROBOT_DELAY_MS;
    if (!t) { await this.table.emit(rt); return; }   // before the first deal: the seats changed
    this.table.restart(rt, t.turn, before);
    if (t.phase === 'done' && t.result && !c.settled) {
      c.settled = true;
      await this.rooms.setLive(rt, 'cards', null);
      const r = t.result, humans = c.seats.filter(s => s.credit).length;
      for (const sid of t.seats) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, mark = r.marks[sid] ?? 0;
        c.paid[sid] = uid;
        if (!uid) continue;
        await this.rooms.addScore(rt, uid, 'tarot', mark);
        await this.palmares.record(rt, 'tarot', { account: uid, won: mark > 0, pts: mark, taker: sid === r.taker,
          partner: sid === r.partner, humans });
        await this.rooms.emitMember(rt, uid);
      }
      const taken = r.marks[r.taker] ?? 0;
      await this.rooms.say(rt, `${await this.table.seatName(rt, r.taker)} ${r.won ? 'gagne' : 'chute'} sa ${Tarot.BIDS[r.bid].name} `
        + `(${String(r.made).replace('.', ',')} points pour ${r.need}) : ${taken > 0 ? '+' : ''}${taken}.`);
      c.seats = Table.settle(c.seats).seats;
    } else if (t.phase === 'done' && !t.result) {   // everyone passed: a new deal, the same seats
      const again = () => { if (rt.slots.tarot === t) void this.dealAt(rt, c.players as 4 | 5).catch(() => {}); };
      c.robot = setTimeout(again, Math.max(1500, delay));
    } else if (t.phase !== 'done' && t.turn !== null) {
      const who = t.phase === 'dog' ? t.taker : t.turn, s = c.seats.find(x => x.id === who);
      if (who && !s?.user) c.robot = setTimeout(() => void this.robot(rt), delay * Math.max(pause, t.phase === 'dog' ? 2 : 1));
      else if (s?.user) this.table.waitFor(rt);
    }
    await this.table.emit(rt);
  }

  private async robot(rt: RoomRt) {
    const t = rt.slots.tarot;
    if (!t || t.phase === 'done') return;
    const seat = t.phase === 'dog' ? t.taker! : t.turn!;
    if (rt.slots.cards.seats.find(s => s.id === seat)?.user) return;
    const view = Tarot.tarotView(t, seat), level = rt.slots.cards.settings.bots ?? 'moyen';   // what its seat may see, the host's level
    const d = TarotAI.decide(view, seat, level, Math.random, Tarot.play);
    if ('play' in d && d.handful && Tarot.declareHandful(t, seat, d.handful)) await this.sayHandful(rt, seat);
    await this.apply(rt, seat, d).catch(() => { /* a robot never makes an illegal move */ });
  }

  /** A poignée shown: said in the chat, its trumps seen by everyone (the table shows them a moment). */
  private async sayHandful(rt: RoomRt, seat: string) {
    const h = rt.slots.tarot!.handfuls[seat]!;
    await this.rooms.say(rt,
      `${await this.table.seatName(rt, seat)} montre une ${Tarot.HANDFUL_NAMES[h.level - 1]} (${h.cards.length} atouts).`);
  }

  /** A player shows a poignée, before his first card. */
  async handful(rt: RoomRt, me: string, level: 1 | 2 | 3) {
    const t = rt.slots.tarot, seat = Table.seatOfUser(rt.slots.cards.seats, me);
    if (!t || !seat || !Tarot.declareHandful(t, seat.id, level)) {
      const size = Tarot.handfulSizes(t?.seats.length ?? 4)[level - 1];
      throw new UserError(`Poignée impossible : ${size} atouts à montrer, avant ta première carte.`);
    }
    await this.sayHandful(rt, seat.id);
    await this.table.emit(rt);
  }

  /** The taker announces a chelem, before the first card: he leads. */
  async chelem(rt: RoomRt, me: string) {
    const t = rt.slots.tarot, seat = Table.seatOfUser(rt.slots.cards.seats, me);
    if (!t || !seat || !Tarot.announceChelem(t, seat.id)) {
      throw new UserError('Le chelem s\'annonce par le preneur, avant la première carte.');
    }
    await this.rooms.say(rt, `${await this.table.seatName(rt, seat.id)} annonce un chelem : tous les plis !`);
    await this.after(rt, null);
  }
}
