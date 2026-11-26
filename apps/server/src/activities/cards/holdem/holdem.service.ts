// The Texas Hold'em (openspec: define-game-concept, Texas Hold'em): a game of hands until one seat has every chip, the
// blinds going up at the host's pace, each place's points to the seat's last player; robots on the free seats. The
// server waits for the tables' animations (ui/holdem-anim.ts) before the robots go on.
import { Injectable } from '@nestjs/common';
import { Holdem, HoldemAI, Table } from '@slopesque/engines';
import type { HoldemRules } from '@slopesque/shared';
import { UserError } from '../../../errors.js';
import { RoomRegistry } from '../../../rooms/room-registry.js';
import type { RoomRt } from '../../../rooms/room-rt.js';
import { Palmares } from '../../palmares/palmares.service.js';
import type { CardGame } from '../table.js';
import { CardsTable } from '../table.service.js';

/** The game; the last hand said (its eliminated players); the step the tables were last shown (their animations). */
interface HoldemRt { game: Holdem.Holdem | null; handDone: number; shownAt: { hand: number; street: string } }
declare module '../../../rooms/room-rt.js' { interface RoomSlots { holdem: HoldemRt } }

@Injectable()
export class HoldemGame implements CardGame {
  readonly key = 'holdem';

  constructor(private readonly table: CardsTable, private readonly rooms: RoomRegistry, private readonly palmares: Palmares) {
    table.register(this);
  }

  init(rt: RoomRt) { rt.slots.holdem = { game: null, handDone: 0, shownAt: { hand: 0, street: '' } }; }
  clear(rt: RoomRt) { rt.slots.holdem.game = null; }
  inRound(rt: RoomRt) { const g = rt.slots.holdem.game; return !!g && !g.over; }
  turn(rt: RoomRt) { return rt.slots.holdem.game?.turn ?? null; }
  view(rt: RoomRt, seat: string | null) { const g = rt.slots.holdem.game; return { holdem: g ? Holdem.holdemView(g, seat) : null }; }
  out(rt: RoomRt) { const g = rt.slots.holdem.game; return g && !g.over ? g.out : null; }
  async move() { throw new UserError('Au Hold\'em, utilise les boutons de mise.'); }

  private rules(rt: RoomRt): HoldemRules { return { ...Holdem.DEFAULT_SETTINGS, ...rt.slots.cards.settings.holdemRules }; }

  /** « Distribuer »: a new game (the seats taken, robots on the others, the same chips for all); a game stopped
   *  between two hands goes on. */
  async deal(rt: RoomRt) {
    const c = rt.slots.cards, h = rt.slots.holdem;
    if (c.game === 'holdem' && h.game && !h.game.over) {
      if (h.game.street !== 'showdown' || c.robot) throw new UserError('Une partie est en cours.');
      return this.next(rt);
    }
    const n = c.settings.holdem;
    if (c.game !== 'holdem' || c.seats.length !== n) this.table.prepare(rt, 'holdem');
    c.game = 'holdem'; c.players = n;
    this.table.credit(rt);
    c.paid = {}; c.settled = false; h.handDone = 0; h.shownAt = { hand: 0, street: '' };
    const rules = this.rules(rt);
    h.game = Holdem.newGame(c.seats.map(s => s.id), rules);
    await this.rooms.setLive(rt, 'cards', 'holdem');
    c.turnSince = Date.now();
    await this.rooms.enter(rt, { activity: 'cards', cardGame: 'holdem' });
    const names = [];
    for (const s of h.game!.seats) names.push(await this.table.seatName(rt, s));
    const blinds = rules.every ? `, qui montent toutes les ${rules.every} mains` : '';
    await this.rooms.say(rt, `Texas Hold'em à ${n} : ${names.join(', ')} ; ${rules.stack} jetons chacun, blindes 10 / 20${blinds}.`);
    await this.after(rt);
  }

  /** A player's move (fold, check, call, raise to, all-in), checked by the rules. */
  async act(rt: RoomRt, me: string, move: Holdem.Move) {
    const c = rt.slots.cards, g = rt.slots.holdem.game, seat = Table.seatOfUser(c.seats, me);
    if (!g || !seat || c.game !== 'holdem') throw new UserError('Tu n\'es pas à la table.');
    if (g.turn !== seat.id) throw new UserError('Ce n\'est pas ton tour.');
    if (!Holdem.act(g, seat.id, move)) {
      const o = Holdem.options(g, seat.id);
      throw new UserError(move.act === 'raise' && o?.raise
        ? `Relance de ${o.raise.min} à ${o.raise.max}, par multiples de 5 (au moins la dernière relance).`
        : move.act === 'raise' ? 'Tu ne peux plus relancer : suis ou couche-toi.' : 'Coup impossible.');
    }
    await this.after(rt, seat.id);
  }

  /** After a move: a hand's end (the players out, said), the game's end (each place's points to the seat's last
   *  player), the next hand after a pause, the robots (on their seat's view). */
  async after(rt: RoomRt, before: string | null = null) {
    const c = rt.slots.cards, h = rt.slots.holdem, g = h.game, delay = this.table.env.ROBOT_DELAY_MS;
    if (!g) { await this.table.emit(rt); return; }
    // the tables show each step (ui/holdem-anim.ts, the same durations): the deal, a new card on the board, the showdown
    const pace = delay / 900, newHand = g.hand !== h.shownAt.hand, newCards = !newHand && g.street !== h.shownAt.street;
    const dealMs = newHand ? g.inHand.length * 2 * 90 + 380 + 380 + 300 + (g.levelUp ? 1800 : 0) : 0;
    const cardsMs = newCards ? 450 + 3 * 260 + 380 + 450 + 300 : 0;
    h.shownAt = { hand: g.hand, street: g.street };
    this.table.restart(rt, g.turn, before);
    if (g.street === 'showdown' && g.result && h.handDone !== g.hand) {   // a hand's end, said once
      h.handDone = g.hand;
      for (const s of g.result.out) await this.rooms.say(rt,
        `${await this.table.seatName(rt, s)} est éliminé${g.places[s]! > 1 ? ` : ${g.places[s]}e place` : ''}.`);
    }
    if (g.over && !c.settled) {
      c.settled = true;
      await this.rooms.setLive(rt, 'cards', null);
      const n = g.seats.length, order = [...g.seats].sort((a, b) => g.places[a]! - g.places[b]!), parts = [],
        humans = c.seats.filter(s => s.credit).length;
      for (const sid of order) {
        const uid = c.seats.find(s => s.id === sid)?.credit ?? null, place = g.places[sid]!, pts = Holdem.placePoints(place, n);
        c.paid[sid] = uid;
        parts.push(`${place}. ${await this.table.seatName(rt, sid)}${uid && pts ? ` +${pts}` : ''}`);
        if (!uid) continue;
        if (pts) await this.rooms.addScore(rt, uid, 'holdem', pts);
        await this.palmares.record(rt, 'holdem', { account: uid, won: place === 1, place, of: n, pts, humans });
        await this.rooms.emitMember(rt, uid);
      }
      await this.rooms.say(rt, `Fin de la partie de Texas Hold'em (${g.hand} main${g.hand > 1 ? 's' : ''}) : ${parts.join(', ')}.`);
      c.seats = Table.settle(c.seats).seats;
    } else if (!g.over && g.street === 'showdown') {   // the hand shown a moment, then the next one
      // gather, run out, read, pay
      const r = g.result, read = !r || r.uncontested ? 450 + 900 + 650 + 1200 : 450 + (g.revealed ? 5 * 260 + 830 : 0) + 2400 + 650 + 2000;
      const go = () => { if (rt.slots.holdem.game === g) void this.next(rt).catch(() => {}); };
      c.robot = setTimeout(go, pace * (read + 2000 * (r?.out.length ?? 0)));
    } else if (g.turn) {
      const s = c.seats.find(x => x.id === g.turn);
      if (!s?.user) c.robot = setTimeout(() => void this.robot(rt), delay + pace * (dealMs + cardsMs));
      else this.table.waitFor(rt);
    }
    await this.table.emit(rt);
  }

  /** The next hand; when no seat still in belongs to a player (the players are out, or left before playing), the
   *  game ends: the robots' order gives nobody points. */
  private async next(rt: RoomRt) {
    const c = rt.slots.cards, g = rt.slots.holdem.game;
    if (!g || g.over) return;
    c.robot = null;
    if (!Holdem.alive(g).some(s => c.seats.find(x => x.id === s)?.credit)) Holdem.finish(g);
    else if (Holdem.dealHand(g) && g.levelUp) await this.rooms.say(rt, `Les blindes montent : ${g.sb} / ${g.bb}.`);
    c.turnSince = Date.now();
    await this.after(rt);
  }

  private async robot(rt: RoomRt) {
    const g = rt.slots.holdem.game;
    if (!g || !g.turn || rt.slots.cards.seats.find(s => s.id === g.turn)?.user) return;
    const seat = g.turn;
    const m = HoldemAI.decide(Holdem.holdemView(g, seat), seat, rt.slots.cards.settings.bots ?? 'moyen');   // its view, the host's level
    if (!Holdem.act(g, seat, m)) Holdem.act(g, seat, { act: Holdem.options(g, seat)?.check ? 'check' : 'fold' });
    await this.after(rt, seat);
  }

  /** The host's game: starting chips, the blinds' pace (from the next game). */
  async setRules(rt: RoomRt, me: string, v: Partial<HoldemRules>) {
    this.rooms.hostOnly(rt, me);
    const rules = { ...this.rules(rt), ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) };
    rt.slots.cards.settings = { ...rt.slots.cards.settings, holdemRules: rules };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    const later = this.table.inRound(rt) && rt.slots.cards.game === 'holdem' ? ', à partir de la partie suivante' : '';
    const blinds = rules.every ? `qui montent toutes les ${rules.every} mains` : 'fixes';
    await this.rooms.say(rt, `Texas Hold'em : ${rules.stack} jetons au départ, blindes ${blinds}${later}.`);
    await this.table.emit(rt);
  }

  /** The host ends the game: the seats still in are placed by their chips. */
  async end(rt: RoomRt, me: string) {
    const g = rt.slots.holdem.game;
    this.rooms.hostOnly(rt, me);
    if (!g || g.over || rt.slots.cards.game !== 'holdem') throw new UserError('Aucune partie de Hold\'em en cours.');
    Holdem.finish(g);
    await this.rooms.say(rt, 'L\'hôte termine la partie : les joueurs encore en jeu sont classés selon leurs jetons.');
    await this.after(rt);
  }
}
