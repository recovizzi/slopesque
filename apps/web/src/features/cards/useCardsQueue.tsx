// The server's views of the card table, shown one after the other with their animations (cards-anim.ts; the
// Hold'em's, holdem/holdem-anim.ts) and their announcements over the table: the server sends each step at once, the
// table plays them in turn. Too far behind (a hidden tab, more than 6 waiting, reduced motion): the last view at once.
// The cards on their way stay hidden at their place until they land (set on the drawn page, outside React).
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import type { CardsView } from '@slopesque/shared';
import { Holdem as HE, Tarot as TA } from '@slopesque/engines';
import { useStore } from '../../app/store';
import * as A from './cards-anim';
import * as CV from './coinche/coinche-view';
import * as HA from './holdem/holdem-anim';
import * as HV from './holdem/holdem-view';
import { LegacyAnnounce } from './LegacyTable';
import { CallAnnounce, ChelemAnnounce, HandfulAnnounce, TakeAnnounce } from './tarot/TarotAnnounce';

/** A seat's name in a view (« Toi » for me), from the room's members now. */
const nameIn = (v: CardsView, me: string) => (id: string) => {
  const s = v.seats.find(x => x.id === id),
    u = s?.user ?? s?.credit;
  return u === me ? 'Toi' : (u && useStore.getState().room?.members.find(m => m.id === u)?.name) || s?.bot || '?';
};

export function useCardsQueue(box: RefObject<HTMLDivElement | null>, me: string) {
  const cards = useStore(s => s.room!.cards);
  const [c, setShown] = useState<CardsView>(cards),
    [showLast, setShowLast] = useState(false),
    [announce, setAnnounce] = useState<ReactElement | null>(null);
  // the Coinche: the deal whose count is shown (after its last trick); the Hold'em: the pots paid, the hands turned
  const [countFor, setCountFor] = useState<number | null>(cards.coinche?.result ? cards.coinche.deal : null);
  const [pay, setPay] = useState(false),
    [fresh, setFresh] = useState<Set<string>>(new Set());
  const shown = useRef(c),
    queue = useRef<CardsView[]>([]),
    busy = useRef(false),
    hidden = useRef(new Set<string>()),
    hideSel = useRef(new Set<string>()),
    seq = useRef(0);

  // an announcement: a component, or (Hold'em, Coinche) an HTML string; a new key each time (its animation replays)
  const said = (n: ReactNode) => (
    <div className="announce" key={++seq.current}>
      {n}
    </div>
  );
  const saidHtml = (html: string) => <LegacyAnnounce key={++seq.current} html={html} />;
  const hold = async (a: ReactElement, ms: number) => {
    setAnnounce(a);
    await A.wait(ms);
    setAnnounce(null);
  };
  /** Said a moment while the table goes on. */
  const flash = (a: ReactElement, ms: number) => {
    setAnnounce(a);
    setTimeout(() => setAnnounce(x => (x === a ? null : x)), ms);
  };

  useEffect(() => {
    queue.current.push(cards);
    void play();
  }, [cards]);

  const show = (v: CardsView, last = false) => {
    const a = shown.current.holdem,
      b = v.holdem;
    if (b && v.game === 'holdem') {
      // Hold'em: the hands just turned over (they flip, once)
      const same = !!a && a.hand === b.hand && a.startedAt === b.startedAt,
        f = new Set<string>(),
        mine = v.seats.find(x => x.user === me)?.id;
      if (same)
        for (const [seat, h] of Object.entries(b.holes))
          h.forEach((cd, i) => {
            if (seat !== mine && cd.r && !a!.holes[seat]?.[i]?.r) f.add(`${seat}:${i}`);
          });
      setFresh(f);
    }
    shown.current = v;
    setShown(v);
    setShowLast(last);
  };

  async function play() {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length) {
        const el = box.current;
        if (!el || queue.current.length > 6 || document.hidden || A.reduced()) {
          // too far behind: the last view
          const v = queue.current.at(-1)!,
            was = shown.current.holdem,
            h = v.holdem;
          hideSel.current.clear();
          setPay(false);
          if (v.coinche?.result) setCountFor(v.coinche.deal);
          show(v);
          queue.current = [];
          if (
            h?.street === 'showdown' &&
            h.result &&
            !(was && was.startedAt === h.startedAt && was.hand === h.hand && was.street === 'showdown')
          ) {
            // behind: the winning hand all the same
            const seat = v.seats.find(x => x.user === me)?.id ?? '';
            flash(
              saidHtml(
                HV.handAnnounce(
                  h as unknown as HE.Holdem,
                  h.result.awards[0]!,
                  nameIn(v, me),
                  seat,
                  h.result.awards.length,
                ),
              ),
              HA.T.read,
            );
          }
          break;
        }
        const next = queue.current.shift()!,
          prev = shown.current,
          step = A.diff(prev, next);
        if (next.game === 'holdem' && next.holdem) {
          await holdemStep(el, prev, next);
          continue;
        }
        const seat = prev.seats.find(s => s.user === me)?.id ?? '';
        const from = step.played.map(p => A.sources(el, p, p.by === seat));
        from.forEach(f => f.forEach((_, id) => hidden.current.add(id)));
        show(next, !!step.gather);
        if (from.length) {
          await A.painted();
          for (const f of from) {
            await A.flyIn(el, f);
            f.forEach((_, id) => hidden.current.delete(id));
          }
        }
        hidden.current.clear();
        if (step.gather) {
          await A.wait(700);
          await A.gather(el, step.gather, step.gather === seat);
          setShowLast(false);
        }
        const name = nameIn(next, me);
        if (step.take)
          await hold(
            said(<TakeAnnounce name={name(step.take.seat)} bid={step.take.bid as Exclude<TA.Bid, 'pass'>} />),
            2000,
          );
        for (const h of step.handfuls)
          await hold(said(<HandfulAnnounce name={name(h.seat)} level={h.level} cards={h.cards as TA.TCard[]} />), 2400);
        const ca = prev.coinche,
          cb = next.coinche;
        if (ca && cb && ca.deal === cb.deal && ca.startedAt === cb.startedAt) {
          // the Coinche: the coinche, the contract, the belote, the deal's end
          if (!ca.coincheBy && cb.coincheBy) await hold(saidHtml(CV.coincheAnnounce(name(cb.coincheBy), false)), 1800);
          if (ca.contract?.mult !== 4 && cb.contract?.mult === 4)
            await hold(saidHtml(CV.coincheAnnounce(name(cb.speeches.at(-1)!.by), true)), 1800);
          if (ca.phase === 'bid' && cb.phase === 'play' && cb.contract)
            await hold(saidHtml(CV.contractAnnounce(name(cb.contract.by), cb.contract)), 2200);
          if (cb.belote.said > ca.belote.said && cb.belote.by)
            await hold(saidHtml(CV.beloteAnnounce(name(cb.belote.by), cb.belote.said)), 1400);
          if (!ca.result && cb.result) {
            await A.wait(500);
            await hold(saidHtml(CV.dealAnnounce(cb.result.made, cb.result.contract)), 1800);
          }
        }
        if (cb?.result) setCountFor(cb.deal); // its last trick gathered: the count in the foreground
        if (step.chelem) await hold(said(<ChelemAnnounce name={name(step.chelem)} />), 2000);
        if (step.call) {
          const mine = step.call.taker !== seat && !!next.tarot?.hands[seat]?.some(x => x.id === step.call!.card.id);
          await hold(
            said(<CallAnnounce name={name(step.call.taker)} card={step.call.card as TA.TCard} mine={mine} />),
            2800,
          );
        }
      }
    } finally {
      busy.current = false;
    }
  }

  /** Hold'em: the step's flights (cards from the deck, chips to the felt, to the pot, to the winners), then what is
   *  announced (an all-in, a player out, the winner, the blinds up). */
  async function holdemStep(el: HTMLElement, prev: CardsView, next: CardsView) {
    const a = prev.game === 'holdem' ? prev.holdem : null,
      b = next.holdem!,
      seat = next.seats.find(x => x.user === me)?.id ?? '',
      name = nameIn(next, me);
    const reveal = async () => {
      // the hand's end in the foreground: each pot, its winner's cards + the board, the hand's name
      for (const aw of b.result?.awards ?? []) {
        setAnnounce(saidHtml(HV.handAnnounce(b as unknown as HE.Holdem, aw, name, seat, b.result!.awards.length)));
        await A.wait(HA.T.read);
      }
      setAnnounce(null);
    };
    const p = HA.plan(el, a, b, seat, () => setPay(false), reveal);
    hideSel.current = new Set(p?.hide ?? []);
    setPay(!!p && !!a && a.hand === b.hand && a.street !== 'showdown' && b.street === 'showdown' && !!b.result);
    show(next);
    const same = !!a && a.startedAt === b.startedAt;
    if (same)
      for (const [s, l] of Object.entries(b.last))
        if (l.act === 'allin' && a!.last[s]?.act !== 'allin')
          flash(saidHtml(HV.allinAnnounce(name(s), b.bets[s] || l.amount)), 1300); // an all-in: said a moment, the table goes on
    if (same && b.hand !== a!.hand && b.levelUp) await hold(saidHtml(HV.levelAnnounce(b.sb, b.bb)), 1800);
    if (p)
      await p.run(el, sel => {
        hideSel.current.delete(sel);
        el.querySelectorAll<HTMLElement>(sel).forEach(x => {
          x.style.visibility = '';
        });
      });
    hideSel.current.clear();
    setPay(false);
    if (!same) return;
    for (const s of b.out.filter(x => !a!.out.includes(x)))
      await hold(saidHtml(HV.outAnnounce(name(s), b.places[s] ?? 0, s === seat)), 2000);
    if (b.over && !a!.over) {
      const w = Object.keys(b.places).find(x => b.places[x] === 1);
      if (w) await hold(saidHtml(HV.winAnnounce(name(w), w === seat)), 2400);
    }
  }

  useLayoutEffect(() => {
    // the pieces on their way (cards, the Hold'em's chips) stay hidden at their place until they land
    for (const sel of hideSel.current)
      box.current?.querySelectorAll<HTMLElement>(sel).forEach(x => x.style.setProperty('visibility', 'hidden'));
    for (const id of hidden.current)
      box.current
        ?.querySelector<HTMLElement>(`.on-table[data-card="${CSS.escape(id)}"]`)
        ?.style.setProperty('visibility', 'hidden');
  });

  return { c, showLast, announce, countFor, pay, fresh };
}
