// The Coinche (openspec: define-game-concept, Coinche): two teams facing each other (seats 1 & 3, 2 & 4), the bidding
// (coinche, surcoinche), the tricks and the belote, each team's points to its seats' last players, a game in 1 000
// points or the host's target; after a deal's count, the next one when every seated player is ready.
import { Injectable } from '@nestjs/common';
import { Coinche, CoincheAI, Table } from '@slopesque/engines';
import { UserError } from '../../../errors.js';
import { RoomRegistry } from '../../../rooms/room-registry.js';
import type { RoomRt } from '../../../rooms/room-rt.js';
import { Palmares } from '../../palmares/palmares.service.js';
import type { CardGame, CardMove } from '../table.js';
import { CardsTable } from '../table.service.js';

/** The game; after a deal's count, when the next one comes (at `at`, or when every seated player is ready). */
interface CoincheRt { game: Coinche.Coinche | null; next: { at: number; ready: string[] } | null }
declare module '../../../rooms/room-rt.js' { interface RoomSlots { coinche: CoincheRt } }

type Act = { say: Coinche.Say } | { play: Coinche.CCard };

@Injectable()
export class CoincheGame implements CardGame {
  readonly key = 'coinche';

  constructor(private readonly table: CardsTable, private readonly rooms: RoomRegistry, private readonly palmares: Palmares) {
    table.register(this);
  }

  init(rt: RoomRt) { rt.slots.coinche = { game: null, next: null }; }
  clear(rt: RoomRt) { rt.slots.coinche.game = null; }
  inRound(rt: RoomRt) { const g = rt.slots.coinche.game; return !!g && !g.over; }
  turn(rt: RoomRt) { return rt.slots.coinche.game?.turn ?? null; }
  view(rt: RoomRt, seat: string | null) {
    const k = rt.slots.coinche;
    return { coinche: k.game ? Coinche.coincheView(k.game, seat) : null, next: rt.slots.cards.game === 'coinche' ? k.next : null };
  }
  async move(rt: RoomRt, me: string, move: CardMove) { if ('play' in move) await this.act(rt, me, { play: move.play[0]! }); }

  private target(rt: RoomRt) { return rt.slots.cards.settings.coincheTarget ?? 1000; }

  /** « Distribuer »: a new game (two teams facing each other: seats 1 & 3, 2 & 4; robots on the free seats); a game
   *  stopped between two deals goes on. */
  async deal(rt: RoomRt) {
    const c = rt.slots.cards, k = rt.slots.coinche;
    if (c.game === 'coinche' && k.game && !k.game.over) {
      if (k.game.phase !== 'done' || c.robot) throw new UserError('Une partie est en cours.');
      return this.nextDeal(rt);
    }
    if (c.game !== 'coinche' || c.seats.length !== 4) this.table.prepare(rt, 'coinche');
    c.game = 'coinche'; c.players = 4;
    this.table.credit(rt);
    c.paid = {}; c.settled = false;
    k.next = null;
    k.game = Coinche.newGame(c.seats.map(s => s.id), this.target(rt));
    await this.rooms.setLive(rt, 'cards', 'coinche');
    c.turnSince = Date.now();
    await this.rooms.enter(rt, { activity: 'cards', cardGame: 'coinche' });
    const n = await Promise.all(k.game!.seats.map(s => this.table.seatName(rt, s)));
    await this.rooms.say(rt, `Coinche en ${k.game!.target} points : ${n[0]} et ${n[2]} contre ${n[1]} et ${n[3]}.`);
    await this.after(rt);
  }

  /** The next deal (the dealer moves on); the seats' points go to whoever sits there now. */
  private async nextDeal(rt: RoomRt) {
    const c = rt.slots.cards, k = rt.slots.coinche, g = k.game;
    if (!g || g.over) return;
    c.robot = null;
    Coinche.dealHand(g, true, c.settings.dealMode ?? 'random');
    this.table.credit(rt);
    c.settled = false; c.paid = {}; k.next = null;
    c.turnSince = Date.now();
    await this.after(rt);
  }

  /** A player's word in the bidding, or his card. */
  async act(rt: RoomRt, me: string, act: { say: Coinche.Say } | { play: string }) {
    const c = rt.slots.cards, g = rt.slots.coinche.game, seat = Table.seatOfUser(c.seats, me);
    if (!g || !seat || c.game !== 'coinche') throw new UserError('Tu n\'es pas à la table.');
    if (g.turn !== seat.id) throw new UserError('Ce n\'est pas ton tour.');
    await this.apply(rt, seat.id, 'say' in act ? act : { play: g.hands[seat.id]!.find(x => x.id === act.play)! });
  }

  private async apply(rt: RoomRt, seat: string, act: Act) {
    const g = rt.slots.coinche.game!, before = g.phase, turn = g.turn, belote = g.belote.said;
    const ok = 'say' in act ? Coinche.bid(g, seat, act.say) : !!act.play && Coinche.play(g, seat, act.play);
    if (!ok) {
      throw new UserError('say' in act
        ? 'Annonce impossible : plus haut que le contrat, une couleur d\'atout ; coinche seulement sur l\'annonce d\'un adversaire.'
        : 'Carte impossible : fournis la couleur ; à l\'atout, monte ; sinon coupe (et surcoupe, ou pisse), '
          + 'sauf si ton partenaire est maître.');
    }
    const name = (id: string) => this.table.seatName(rt, id);
    if ('say' in act && act.say.kind === 'coinche') await this.rooms.say(rt, `${await name(seat)} coinche !`);
    if ('say' in act && act.say.kind === 'surcoinche') await this.rooms.say(rt, `${await name(seat)} surcoinche !`);
    if (before === 'bid' && g.phase === 'play') await this.rooms.say(rt,
      `Contrat : ${await name(g.contract!.by)}, ${Coinche.contractName(g.contract!)}.`);
    // the tables show it before the robots go on: the contract, a coinche, the trick taken, the belote
    const pause = before === 'bid' && g.phase === 'play' ? 3.2 : 'say' in act && act.say.kind === 'coinche' ? 2.4
      : 'play' in act && !g.trick.length ? 2.4 : g.belote.said !== belote ? 1.8 : 1;
    await this.after(rt, turn, pause);
  }

  /** After a step: the deal's end (each team's points to the seats' last players; the score), the game's end, the
   *  next deal after a pause, the robots (on their seat's view). */
  async after(rt: RoomRt, before: string | null = null, pause = 1) {
    const c = rt.slots.cards, k = rt.slots.coinche, g = k.game, delay = this.table.env.ROBOT_DELAY_MS;
    if (!g) { await this.table.emit(rt); return; }
    this.table.restart(rt, g.turn, before);
    const pace = delay / 900;
    if (g.phase === 'done' && !c.settled) {
      c.settled = true;
      if (g.result) {
        const r = g.result, humans = c.seats.filter(s => s.credit).length;
        for (const sid of g.seats) {
          const uid = c.seats.find(s => s.id === sid)?.credit ?? null, t = Coinche.team(g, sid), pts = r.score[t];
          c.paid[sid] = uid;
          if (!uid) continue;
          if (pts) await this.rooms.addScore(rt, uid, 'coinche', pts);
          await this.palmares.record(rt, 'coinche', { account: uid, won: t === r.attack ? r.made : !r.made, pts,
            taker: sid === r.contract.by, humans });
          await this.rooms.emitMember(rt, uid);
        }
        const team = await Promise.all(g.seats.filter(s => Coinche.team(g, s) === r.attack).map(s => this.table.seatName(rt, s)));
        await this.rooms.say(rt,
          `Donne ${g.deal} : ${team.join(' et ')} ${r.made ? 'remplissent' : 'chutent'} ${Coinche.contractName(r.contract)} `
          + `(${r.points[r.attack]}${r.belote === r.attack ? ' + belote' : ''}). Score : ${g.scores[0]} – ${g.scores[1]}.`);
        c.seats = Table.settle(c.seats).seats;
      } else Coinche.passedOut(g);
      if (g.over) {
        await this.rooms.setLive(rt, 'cards', null);
        const w = await Promise.all(g.seats.filter(s => Coinche.team(g, s) === g.winner).map(s => this.table.seatName(rt, s)));
        await this.rooms.say(rt, `Fin de la partie : ${w.join(' et ')} gagnent ${Math.max(...g.scores)} à ${Math.min(...g.scores)}.`);
      } else {   // the count read: the next deal when every seated player is ready, or after a minute (robots alone: a moment)
        const people = c.seats.some(s => s.user);
        k.next = { at: Date.now() + pace * (!g.result ? 2500 : people ? 60_000 : 7000), ready: [] };
      }
    }
    if (g.phase === 'done' && !g.over && k.next) {
      const seated = c.seats.filter(s => s.user).map(s => s.user!), next = k.next;
      if (g.result && seated.length && seated.every(u => next.ready.includes(u))) next.at = Math.min(next.at, Date.now());   // all ready
      const deal = () => { if (rt.slots.coinche.game === g) void this.nextDeal(rt).catch(() => {}); };
      c.robot = setTimeout(deal, Math.max(0, next.at - Date.now()));
    } else if (g.phase !== 'done' && g.turn) {
      const s = c.seats.find(x => x.id === g.turn);
      if (!s?.user) c.robot = setTimeout(() => void this.robot(rt), delay * pause);
      else this.table.waitFor(rt);
    }
    await this.table.emit(rt);
  }

  private async robot(rt: RoomRt) {
    const g = rt.slots.coinche.game;
    if (!g || !g.turn || g.phase === 'done' || rt.slots.cards.seats.find(s => s.id === g.turn)?.user) return;
    const seat = g.turn, d = CoincheAI.decide(Coinche.coincheView(g, seat), seat, rt.slots.cards.settings.bots ?? 'moyen');   // its view
    await this.apply(rt, seat, 'say' in d ? d : { play: g.hands[seat]!.find(x => x.id === d.play.id)! }).catch(async () => {
      if (g.phase === 'bid') await this.apply(rt, seat, { say: { kind: 'pass' } });
      else await this.apply(rt, seat, { play: Coinche.legal(g, seat)[0]! });
    });
  }

  /** « Continuer » after a deal's count: the next deal once every seated player clicked it. */
  async ready(rt: RoomRt, me: string) {
    const c = rt.slots.cards, k = rt.slots.coinche;
    if (c.game !== 'coinche' || !k.game || k.game.phase !== 'done' || k.game.over || !k.next) {
      throw new UserError('Il n\'y a pas de donne à suivre.');
    }
    if (!Table.seatOfUser(c.seats, me)) throw new UserError('Tu n\'es pas à la table.');
    if (!k.next.ready.includes(me)) k.next.ready.push(me);
    await this.after(rt, k.game.turn);
  }

  /** The host's target (from the next game). */
  async setTarget(rt: RoomRt, me: string, target: number) {
    this.rooms.hostOnly(rt, me);
    rt.slots.cards.settings = { ...rt.slots.cards.settings, coincheTarget: target };
    await this.rooms.saveRules(rt, 'cards', rt.slots.cards.settings);
    const later = this.table.inRound(rt) && rt.slots.cards.game === 'coinche' ? ', à partir de la partie suivante' : '';
    await this.rooms.say(rt, `Coinche : partie en ${target} points${later}.`);
    await this.table.emit(rt);
  }
}
