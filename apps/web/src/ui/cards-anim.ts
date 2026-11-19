// The card table's animations (as the maquette's app.ts): the server sends each step at once, the table shows them one
// after the other — a card flies from its seat (or my hand) to the pile, a Tarot trick stays a moment then goes to its
// winner, the take and the called card are announced. Too far behind (a hidden tab), it jumps to the last view.
import type { CardsView } from '@slopesque/shared';

type Play = { by: string; cards: { id: string }[] };
export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** After a React update: two frames, the new table is in the page. */
export const painted = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** The plays on the table (the trick taken last, then the current one), as card ids. */
function plays(v: CardsView): Play[] {
  if (v.game === 'tdc' && v.tdc) return [...v.tdc.lastTrick, ...v.tdc.trick];
  if (v.game === 'tarot' && v.tarot) return [...v.tarot.lastTrick, ...v.tarot.trick].map(p => ({ by: p.by, cards: [p.card] }));
  return [];
}
const sameDeal = (a: CardsView, b: CardsView) => a.game === b.game && (a.game === 'tdc'
  ? !!a.tdc && !!b.tdc && a.tdc.round === b.tdc.round && a.tdc.startedAt === b.tdc.startedAt
  : !!a.tarot && !!b.tarot && a.tarot.deal === b.tarot.deal && a.tarot.startedAt === b.tarot.startedAt);

export interface Step {
  played: Play[];                        // new plays, to fly in this order
  gather: string | null;                 // Tarot: the trick just taken, to show then send to this seat
  take: { seat: string; bid: string } | null;
  call: { taker: string; card: NonNullable<NonNullable<CardsView['tarot']>['called']> } | null;
}
/** What happened between two views of the table (nothing when the deal changed). */
export function diff(a: CardsView, b: CardsView): Step {
  const none: Step = { played: [], gather: null, take: null, call: null };
  if (!sameDeal(a, b)) return none;
  const seen = new Set(plays(a).flatMap(p => p.cards.map(c => c.id)));
  const played = plays(b).filter(p => p.cards.some(c => !seen.has(c.id)));
  if (b.game !== 'tarot' || !a.tarot || !b.tarot) return { ...none, played };
  const ta = a.tarot, tb = b.tarot;
  const closed = !tb.trick.length && tb.lastTrick.length > 0 && tb.lastTrick[0]!.card.id !== ta.lastTrick[0]?.card.id;
  return {
    played,
    gather: closed ? tb.lastWinner : null,
    take: !ta.taker && tb.taker && tb.bid ? { seat: tb.taker, bid: tb.bid } : null,
    call: !ta.called && tb.called && tb.taker ? { taker: tb.taker, card: tb.called } : null,
  };
}

const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export type From = Map<string, { x: number; y: number; w: number; h: number; a: number; hand: boolean }>;
/** Where a play's cards come from, read before the table is redrawn: my hand (the card itself) or the player's seat. */
export function sources(box: HTMLElement, play: Play, mine: boolean): From {
  const seat = box.querySelector(`[data-seat="${CSS.escape(play.by)}"]`)?.getBoundingClientRect(), out: From = new Map();
  for (const c of play.cards) {
    const el = mine ? box.querySelector<HTMLElement>(`.in-hand[data-card="${CSS.escape(c.id)}"]`) : null;
    if (el) out.set(c.id, { ...centre(el.getBoundingClientRect()), w: el.offsetWidth, h: el.offsetHeight, a: parseFloat(el.style.getPropertyValue('--a')) || 0, hand: true });
    else if (seat) out.set(c.id, { ...centre(seat), w: 30, h: 42, a: 0, hand: false });
  }
  return out;
}

/** The cards fly to their place on the redrawn table (hidden there until they land). */
export function flyIn(box: HTMLElement, from: From) {
  return Promise.all([...from].map(([id, f]) => {
    const el = box.querySelector<HTMLElement>(`.on-table[data-card="${CSS.escape(id)}"]`);
    if (!el) return Promise.resolve();
    const r = el.getBoundingClientRect(), to = centre(r), c = document.createElement('div');
    c.className = `card-fly ${f.hand ? 'from-hand' : 'from-seat'}`;
    c.innerHTML = el.innerHTML;
    Object.assign(c.style, { left: `${f.x - r.width / 2}px`, top: `${f.y - r.height / 2}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.append(c);
    el.style.visibility = 'hidden';
    return c.animate([{ transform: `rotate(${f.a}rad) scale(${f.w / r.width})` }, { transform: `translate(${to.x - f.x}px, ${to.y - f.y}px) rotate(0) scale(1)` }],
      { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }).finished.catch(() => undefined)
      .then(() => { el.style.visibility = ''; c.remove(); });
  })).then(() => undefined);
}

/** The trick on the table gathered, then sent to its winner: my pile (bottom right) or his seat. */
export function gather(box: HTMLElement, winner: string, me: boolean) {
  const els = [...box.querySelectorAll<HTMLElement>('.cg-pile .on-table')];
  const target = me ? box.querySelector('.won-pile') : box.querySelector(`[data-seat="${CSS.escape(winner)}"]`);
  const pile = box.querySelector('[data-pile]')?.getBoundingClientRect();
  if (!els.length || !target || !pile) return Promise.resolve();
  const p = centre(pile), to = centre(target.getBoundingClientRect());
  return Promise.all(els.map((el, i) => {
    const r = el.getBoundingClientRect(), f = document.createElement('div');
    f.className = 'card-fly gather';
    f.innerHTML = el.innerHTML;
    Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.append(f);
    el.style.visibility = 'hidden';
    const o = centre(r);
    return f.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${p.x - o.x}px, ${p.y - o.y}px) rotate(${(i - els.length / 2) * 4}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${to.x - o.x}px, ${to.y - o.y}px) scale(${me ? 0.55 : 0.3})`, opacity: me ? 1 : 0 },
    ], { duration: 850, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' }).finished.catch(() => undefined).then(() => f.remove());
  })).then(() => undefined);
}
