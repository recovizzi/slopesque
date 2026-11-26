// LEGACY (task 3.3 of openspec refactor-architecture turns them into components, then deletes this file): the Texas
// Hold'em and the Coinche, still drawn from HTML strings (holdem/holdem-view.ts, coinche/coinche-view.ts, with the
// helpers of legacy.ts) through LiveHtml — their clicks read by delegation (data-action), my hand's fan, the game's
// clock and the next deal's countdown set on the drawn page.
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type { CardsView } from '@slopesque/shared';
import { Coinche as CO, Holdem as HE } from '@slopesque/engines';
import { useStore } from '../../app/store';
import { LiveHtml } from '../../legacy/LiveHtml';
import * as CV from './coinche/coinche-view';
import * as HV from './holdem/holdem-view';
import { fanOf, fmtClock, type Late, type TableActions, type WhoOf } from './model';

/** My hand's fan for the hand's width (the hand drawn, or the stage before it is). */
function fan(n: number, box: HTMLElement | null) {
  const hand = box?.querySelector<HTMLElement>('[data-hand]'),
    card = hand?.querySelector<HTMLElement>('.in-hand');
  const small = (box?.clientWidth ?? 600) <= 480,
    w = hand?.clientWidth || (box?.clientWidth ?? 600) - 24;
  return fanOf(n, w, card?.offsetWidth || (small ? 48 : 58), card?.offsetHeight || (small ? 68 : 82));
}

export interface LegacyTableProps {
  c: CardsView;
  holdem: HE.Holdem | null;
  coinche: CO.Coinche | null;
  /** My account, my seat ('' : watching). */
  me: string;
  mySeat: string;
  host: boolean;
  who: WhoOf;
  late: Late | null;
  full: boolean;
  showLast: boolean;
  wonView: string | null;
  countFor: number | null;
  fresh: Set<string>;
  pay: boolean;
  act: TableActions;
  box: RefObject<HTMLDivElement | null>;
}

export function LegacyTable(props: LegacyTableProps) {
  const { c, holdem, coinche, me, mySeat, host, who, late, full, showLast, wonView, countFor, fresh, pay, act, box } =
    props;
  const [sel, setSel] = useState<Set<string>>(new Set()),
    [coBid, setCoBid] = useState<{ value: number | null; suit: CO.Trump | null }>({ value: null, suit: null }),
    [pending, setPending] = useState<number[]>([]);
  useEffect(() => setSel(new Set()), [coinche?.deal, coinche?.phase]);
  useEffect(() => setCoBid({ value: null, suit: null }), [coinche?.deal, coinche?.turn]);
  useEffect(() => setPending([]), [holdem?.hand, holdem?.turn, holdem?.street]);

  const html = coinche
    ? CV.coincheTableHtml({
        g: coinche,
        me: mySeat,
        playing: !!mySeat,
        host,
        selected: sel,
        fan: fan(coinche.hands[mySeat]?.length ?? 0, box.current),
        who,
        showLast,
        bid: coBid,
        wonView,
        late,
        count: countFor === coinche.deal,
        next: c.next
          ? {
              at: c.next.at,
              ready: new Set(c.seats.filter(s => s.user && c.next!.ready.includes(s.user)).map(s => s.id)),
              waiting: c.seats.filter(s => s.user).map(s => s.id),
            }
          : null,
      })
    : HV.holdemTableHtml({
        g: holdem!,
        me: mySeat,
        playing: !!mySeat,
        host,
        who,
        fresh,
        pending,
        pay,
        late,
        seats: (() => {
          const open = c.seats.filter(st => !holdem!.out.includes(st.id) || holdem!.over),
            freeOpen = open.filter(st => !st.user),
            mineOpen = freeOpen.find(st => st.credit === me);
          return {
            free: freeOpen.length,
            total: open.length,
            mine: !!mineOpen,
            takes: freeOpen[0] ? who(freeOpen[0].id).name : '',
            full,
          };
        })(),
      });

  useLayoutEffect(() => {
    // the exact fan for the hand's width, after each redraw
    const hand = box.current?.querySelector<HTMLElement>('[data-hand]'),
      cards = hand ? [...hand.querySelectorAll<HTMLElement>('.in-hand')] : [];
    if (!hand || !cards.length) return;
    const { r, step } = fan(cards.length, box.current),
      n = cards.length;
    hand.style.setProperty('--r', `${r}px`);
    cards.forEach((el, i) => el.style.setProperty('--a', `${((i - (n - 1) / 2) * step).toFixed(4)}rad`));
  });
  useEffect(() => {
    // the clock of the game, the next deal's countdown
    const start = (coinche ?? holdem)?.startedAt;
    const tick = () => {
      const el = box.current?.querySelector('[data-card-clock]');
      if (el && start) el.textContent = fmtClock(Date.now() - start);
      box.current?.querySelectorAll<HTMLElement>('[data-countdown]').forEach(x => {
        x.textContent = String(
          Math.max(0, Math.ceil((Number(x.dataset.countdown) - Date.now() - useStore.getState().clockSkew) / 1000)),
        );
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdem, coinche, box]);

  const onAction = (a: string, el: HTMLElement) => {
    if (a.startsWith('holdem-') && holdem) {
      const stack = holdem.stacks[mySeat] ?? 0;
      const sum = (vs: number[]) => vs.reduce((x, y) => x + y, 0),
        v = Number(el.dataset.v);
      if (a === 'holdem-chip') {
        setPending(p => (sum(p) + v <= stack ? [...p, v] : p));
        return;
      } // a chip clicked: on my bet
      if (a === 'holdem-pend') {
        setPending(HE.chipsOf(Math.min(stack, v)).flatMap(([c, n]) => Array<number>(n).fill(c)));
        return;
      }
      if (a === 'holdem-clear') {
        setPending([]);
        return;
      }
      const move =
        a === 'holdem-bet'
          ? HV.pendingMove(holdem, mySeat, sum(pending)).move
          : a === 'holdem-fold'
            ? { act: 'fold' as const }
            : a === 'holdem-check'
              ? { act: 'check' as const }
              : a === 'holdem-call'
                ? { act: 'call' as const }
                : { act: 'allin' as const };
      if (move) act.send('holdem:act', move);
      return;
    }
    if (a === 'card-pick' && coinche) {
      // a card: chosen, then clicked again to play it
      const card = (coinche.hands[mySeat] ?? []).find(x => x.id === el.dataset.card);
      if (
        !card ||
        coinche.phase !== 'play' ||
        coinche.turn !== mySeat ||
        !CO.legal(coinche, mySeat).some(x => x.id === card.id)
      )
        return;
      if (sel.has(card.id)) act.send('cards:play', { cards: [card.id] });
      else setSel(new Set([card.id]));
      return;
    }
    if (a === 'co-value') setCoBid(b => ({ ...b, value: Number(el.dataset.v) }));
    else if (a === 'co-suit') setCoBid(b => ({ ...b, suit: el.dataset.v as CO.Trump }));
    else if (a === 'co-bid' && coBid.value && coBid.suit)
      act.send('coinche:say', { kind: 'bid', value: coBid.value, suit: coBid.suit });
    else if (a === 'co-next') act.send('coinche:next');
    else if (a === 'co-pass' || a === 'co-coinche' || a === 'co-surcoinche')
      act.send('coinche:say', { kind: a === 'co-pass' ? 'pass' : a === 'co-coinche' ? 'coinche' : 'surcoinche' });
    else if (a === 'cards-deal') act.send('cards:deal');
    else if (a === 'table-leave') act.send('table:leave');
    else if (a === 'table-join') act.join();
    else if (a === 'kick') act.kick();
    else if (a === 'cards-rules') act.rules();
  };
  return <LiveHtml className="cards-holder" html={html} onAction={onAction} />;
}

/** An announcement of the Hold'em or the Coinche over the table (useCardsQueue shows it a moment). */
export const LegacyAnnounce = ({ html }: { html: string }) => <LiveHtml className="announce" html={html} />;

/** The rules of the Hold'em or the Coinche (closed by their ✕, by the backdrop, or by Escape: CardsStage). */
export const LegacyRules = ({ game, onClose }: { game: 'holdem' | 'coinche'; onClose: () => void }) => (
  <LiveHtml
    html={game === 'coinche' ? CV.coincheRulesHtml() : HV.holdemRulesHtml()}
    onAction={a => a === 'rules-close' && onClose()}
  />
);
