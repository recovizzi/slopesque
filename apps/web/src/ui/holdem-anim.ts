// The Hold'em's flights (openspec: card-games, Texas Hold'em, Jetons et animations): the server sends each step at
// once; the table shows it piece by piece — the cards dealt from the deck to each player, the board's cards from the
// deck to the felt (then turned over), a bet's chips from the player to the felt under him, the round's bets to the
// pot, the pot to the winners once everyone could read the hands. The pieces on their way stay hidden at their place
// (CardsStage keeps the selectors) until they land. The server waits as long before the robots go on (×
// ROBOT_DELAY_MS / 900: the tests go fast).
import type { CardsView } from '@slopesque/shared';
import { backSvg } from '../lib/cards';
import { chipsHtml } from '../lib/holdem-view';
import { painted, wait } from './cards-anim';

type View = NonNullable<CardsView['holdem']>;
const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
/** The durations (ms), the server's pauses are made of the same. */
export const T = { chips: 380, gather: 450, card: 380, cardGap: 260, deal: 90, turn: 450, read: 2400, readFold: 900, pay: 650 };

/** A piece flies over everything from a place to another: its HTML (cards at the target's size, chips at theirs). */
export function fly(html: string, from: DOMRect, to: DOMRect, o: { ms?: number; delay?: number; cls?: string; sized?: boolean } = {}): Promise<void> {
  const f = document.createElement('div');
  f.className = `card-fly hd-fly ${o.cls ?? ''}`;
  f.innerHTML = html;
  f.style.visibility = 'hidden';
  if (o.sized) Object.assign(f.style, { width: `${to.width}px`, height: `${to.height}px` });
  document.body.append(f);
  const r = f.getBoundingClientRect(), a = centre(from), b = centre(to);
  Object.assign(f.style, { left: `${a.x - r.width / 2}px`, top: `${a.y - r.height / 2}px`, visibility: '' });
  return f.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)` }],
    { duration: o.ms ?? T.chips, delay: o.delay ?? 0, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }).finished.catch(() => undefined).then(() => f.remove());
}

/** Where things are on the table drawn now (read before the next view is drawn). */
export function places(box: HTMLElement, v: View) {
  const r = (sel: string) => box.querySelector(sel)?.getBoundingClientRect() ?? null;
  return {
    seat: Object.fromEntries(v.seats.map(s => [s, r(`[data-seat="${CSS.escape(s)}"]`)])),
    bet: Object.fromEntries(v.seats.map(s => [s, r(`[data-bet="${CSS.escape(s)}"] .hd-chips`) ?? r(`[data-bet="${CSS.escape(s)}"]`)])),
    pot: r('[data-pot]'),
  };
}

export interface Plan {
  hide: string[];                                  // what stays hidden until its flight lands
  run: (box: HTMLElement, show: (sel: string) => void) => Promise<void>;
}
const q = (s: string) => CSS.escape(s);

/** What flies between two views of the same game (nothing when it changed). `paying`: the showdown arrives — the pot
 *  goes to the winners after the reading time, `payDone` then shows the banks with it. */
export function plan(box: HTMLElement, a: View | null, b: View, me: string, payDone: () => void): Plan | null {
  if (!a || a.startedAt !== b.startedAt) return null;
  const was = places(box, a), hide: string[] = [], steps: ((box: HTMLElement, show: (sel: string) => void) => Promise<void>)[] = [];
  const sameHand = a.hand === b.hand;
  const seatSel = (s: string) => `[data-seat="${q(s)}"]`, betSel = (s: string) => `[data-bet="${q(s)}"] .hd-chips`;
  const at = (sel: string) => box.querySelector(sel)?.getBoundingClientRect() ?? null;

  if (sameHand) {
    const streetEnd = b.street !== a.street;
    // a bet on this round: its chips from the player to the felt under him
    const added = streetEnd ? [] : b.seats.filter(s => (b.bets[s] ?? 0) > (a.bets[s] ?? 0));
    for (const s of added) hide.push(betSel(s));
    if (added.length) steps.push(async (box, show) => {
      await Promise.all(added.map(s => {
        const from = was.seat[s], to = at(betSel(s));
        if (!from || !to) { show(betSel(s)); return; }
        return fly(chipsHtml((b.bets[s] ?? 0) - (a.bets[s] ?? 0)), from, to).then(() => show(betSel(s)));
      }));
    });
    // the round's end: the bets on the felt (and the last call, from its player) slide to the pot
    if (streetEnd) {
      hide.push('[data-pot] .hd-chips');
      steps.push(async (box, show) => {
        const pot = at('[data-pot]');
        if (pot) await Promise.all(b.seats.flatMap(s => {
          const old = a.bets[s] ?? 0, more = (b.paid[s] ?? 0) - (a.paid[s] ?? 0), out = [];
          if (old && was.bet[s]) out.push(fly(chipsHtml(old), was.bet[s]!, pot, { ms: T.gather }));
          if (more > 0 && was.seat[s]) out.push(fly(chipsHtml(more), was.seat[s]!, pot, { ms: T.gather }));
          return out;
        }));
        show('[data-pot] .hd-chips');
      });
    }
    // the board's new cards: from the deck to the felt, then turned over
    const fresh = b.board.filter(c => !a.board.some(x => x.id === c.id));
    for (const c of fresh) hide.push(`.hd-board [data-card="${q(c.id)}"]`);
    if (fresh.length) steps.push(async (box, show) => {
      const deck = at('[data-deck]');
      await Promise.all(fresh.map((c, i) => {
        const sel = `.hd-board [data-card="${q(c.id)}"]`, to = at(sel);
        if (!deck || !to) { show(sel); return; }
        return fly(backSvg(), deck, to, { ms: T.card, delay: i * T.cardGap, sized: true }).then(() => { show(sel); box.querySelector(sel)?.classList.add('is-turned'); });
      }));
      await wait(T.turn);
    });
    // the showdown (or the others folded): time to read, then the pot to its winners
    if (b.street === 'showdown' && b.result && a.street !== 'showdown') {
      const r = b.result;
      steps.push(async () => {
        await wait(r.uncontested ? T.readFold : T.read);
        const pot = at('[data-pot]');
        if (pot) await Promise.all(r.awards.flatMap(aw => aw.winners.map(w => {
          const to = at(seatSel(w));
          return to ? fly(chipsHtml(r.won[w] ?? aw.amount / aw.winners.length), pot, to, { ms: T.pay }) : undefined;
        })));
        payDone();
      });
    }
  } else {
    // a new hand: two cards to each player from the deck, one at a time from the left of the button; then the blinds
    const order = b.seats.filter(s => b.inHand.includes(s)), i0 = order.indexOf(b.button ?? '') + 1;
    const deal = [...order.slice(i0), ...order.slice(0, i0)];
    for (const s of deal) hide.push(`[data-hole="${q(s)}:0"]`, `[data-hole="${q(s)}:1"]`);
    const blinds = [b.sbSeat, b.bbSeat].filter((s): s is string => !!s && (b.bets[s] ?? 0) > 0);
    for (const s of blinds) hide.push(betSel(s));
    steps.push(async (box, show) => {
      const deck = at('[data-deck]');
      const flights = [0, 1].flatMap(k => deal.map((s, i) => {
        const sel = `[data-hole="${q(s)}:${k}"]`, to = at(sel);
        if (!deck || !to) { show(sel); return undefined; }
        return fly(backSvg(), deck, to, { ms: T.card, delay: (k * deal.length + i) * T.deal, sized: true })
          .then(() => { show(sel); if (s === me) box.querySelector(sel)?.classList.add('is-turned'); });
      }));
      await Promise.all(flights);
      await Promise.all(blinds.map(s => {
        const from = at(seatSel(s)), to = at(betSel(s));
        if (!from || !to) { show(betSel(s)); return; }
        return fly(chipsHtml(b.bets[s] ?? 0), from, to).then(() => show(betSel(s)));
      }));
    });
  }
  if (!steps.length) return null;
  return { hide, run: async (box, show) => { await painted(); for (const st of steps) await st(box, show); } };
}
