// The card table (openspec: card-games): the Trou du cul of the maquette (lib/cards.ts) drawn through LiveHtml; the
// server deals, checks every play, makes the robots play, and only ever sends me my own hand.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hueColor } from '@slopesque/engines';
import type { CardsView, MemberView } from '@slopesque/shared';
import * as K from '../lib/cards';
import * as TV from '../lib/tarot-view';
import * as HV from '../lib/holdem-view';
import * as CV from '../lib/coinche-view';
import { Coinche as CO, Holdem as HE, Tarot as TA } from '@slopesque/engines';
import { request } from '../net';
import { useStore } from '../store';
import { LiveHtml } from './LiveHtml';
import { useEscape } from './common';
import * as A from './cards-anim';
import * as HA from './holdem-anim';

/** My hand's fan for the hand's width: the outer cards stay inside, a flat arc (as the maquette). */
function fan(n: number, box: HTMLElement | null) {
  const hand = box?.querySelector<HTMLElement>('[data-hand]'), card = hand?.querySelector<HTMLElement>('.in-hand');
  const small = (box?.clientWidth ?? 600) <= 480, W = hand?.clientWidth || (box?.clientWidth ?? 600) - 24;
  const cw = card?.offsetWidth || (small ? 48 : 58), ch = card?.offsetHeight || (small ? 68 : 82), R = ch * 8;
  const wide = Math.asin(Math.min(1, Math.max(0, (W / 2 - cw / 2 - 4) / (R + ch / 2)))), flat = Math.acos(1 - 34 / R);
  return { r: R, step: n > 1 ? Math.min(0.06, (2 * Math.min(wide, flat)) / (n - 1)) : 0 };
}
const fmtClock = (ms: number) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), p = (n: number) => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`; };

export function CardsStage() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const [c, setShown] = useState<CardsView>(room.cards), [showLast, setShowLast] = useState(false), [announce, setAnnounce] = useState('');
  const box = useRef<HTMLDivElement>(null), shown = useRef(c), queue = useRef<CardsView[]>([]), busy = useRef(false), hidden = useRef(new Set<string>());
  const want = room.activity.cardGame ?? 'tdc';   // the game the host chose (the table may still hold the other)
  const t = c.game === 'tdc' && want === 'tdc' ? c.tdc : null, tarot = c.game === 'tarot' && want === 'tarot' ? c.tarot : null;
  const holdem = c.game === 'holdem' && want === 'holdem' ? c.holdem as unknown as HE.Holdem | null : null;
  const coinche = c.game === 'coinche' && want === 'coinche' ? c.coinche as unknown as CO.Coinche | null : null;
  const [coBid, setCoBid] = useState<{ value: number | null; suit: CO.Trump | null }>({ value: null, suit: null });
  const [countFor, setCountFor] = useState<number | null>(room.cards.coinche?.result ? room.cards.coinche.deal : null);   // the deal whose count is shown (after its last trick)
  const [pending, setPending] = useState<number[]>([]), [pay, setPay] = useState(false), [fresh, setFresh] = useState<Set<string>>(new Set()), hideSel = useRef(new Set<string>());
  const [wonView, setWonView] = useState<string | null>(null);
  const members = new Map(room.members.map(m => [m.id, m]));
  const [sel, setSel] = useState<Set<string>>(new Set()), [rules, setRules] = useState(false), [full, setFull] = useState(false), [note, setNote] = useState('');
  useEscape(() => setRules(false), rules);
  const mySeat = c.seats.find(s => s.user === me)?.id ?? '';
  useEffect(() => { setSel(new Set()); }, [t?.round, t?.turn, tarot?.deal, tarot?.phase, coinche?.deal, coinche?.phase]);
  useEffect(() => { setCoBid({ value: null, suit: null }); }, [coinche?.deal, coinche?.turn]);
  useEffect(() => { setPending([]); }, [holdem?.hand, holdem?.turn, holdem?.street]);

  const who = (id: string) => {
    const s = c.seats.find(x => x.id === id), uid = s ? s.user ?? s.credit : null, m: MemberView | undefined = uid ? members.get(uid) : undefined;
    return { name: uid === me ? 'Toi' : m?.name ?? s?.bot ?? '?', color: m ? hueColor(m.hue) : '#8a8f98', bot: !s?.user, photo: s?.user ? m?.photo ?? null : null };
  };
  const free = c.seats.filter(s => !s.user), mine = free.find(s => s.credit === me);
  const late = c.late ? { seat: c.late.seat, secs: c.late.secs, vote: room.chat.messages.some(m => m.kind === 'vote' && !(m.data?.vote as { result?: string } | undefined)?.result) } : null;
  const html = coinche ? CV.coincheTableHtml({ g: coinche, me: mySeat, playing: !!mySeat, host: room.hostId === me, selected: sel, fan: fan(coinche.hands[mySeat]?.length ?? 0, box.current),
      who, showLast, bid: coBid, wonView, late: late && late.seat !== mySeat ? late : null, count: countFor === coinche.deal,
      next: c.next ? { at: c.next.at, ready: new Set(c.seats.filter(s => s.user && c.next!.ready.includes(s.user)).map(s => s.id)), waiting: c.seats.filter(s => s.user).map(s => s.id) } : null })
    : holdem ? HV.holdemTableHtml({ g: holdem, me: mySeat, playing: !!mySeat, host: room.hostId === me, who, fresh, pending, pay,
      late: late && late.seat !== mySeat ? late : null,
      seats: (() => { const open = c.seats.filter(st => !holdem.out.includes(st.id) || holdem.over), freeOpen = open.filter(st => !st.user), mineOpen = freeOpen.find(st => st.credit === me);
        return { free: freeOpen.length, total: open.length, mine: !!mineOpen, takes: freeOpen[0] ? who(freeOpen[0].id).name : '', full }; })() })
    : tarot ? TV.tarotTableHtml({ t: tarot as unknown as TA.Tarot, me: mySeat, playing: !!mySeat, host: room.hostId === me, selected: sel,
      fan: fan((tarot.hands[mySeat]?.length ?? 0), box.current), who, art: c.art ?? {}, showLast, wonView, showTricks: c.showTricks })
    : t ? K.tableHtml({ t: t as unknown as K.TableCtx['t'], me: mySeat, playing: !!mySeat, host: room.hostId === me, selected: sel, fan: fan(t.hands[mySeat]?.length ?? 0, box.current),
    who, elapsed: '', late: late && late.seat !== mySeat ? late : null,
    seats: { free: free.length, total: c.seats.length, mine: !!mine, takes: free[0] ? who(free[0].id).name : '', full,
      paid: id => { const u = c.paid[id]; const m = u ? members.get(u) : undefined; return u ? { name: u === me ? 'Toi' : m?.name ?? '?', color: m ? hueColor(m.hue) : '#8a8f98', bot: false } : { ...who(id), bot: true }; } } })
    : (() => {   // before the first deal: the seats (take one, or leave it), the host deals when the players are seated
      const n = c.settings[want as 'tdc'] ?? 2, seats = c.game === want ? c.seats : [];
      const chips = seats.map(st => K.seatPill(who(st.id))).join('');
      const freeSeats = seats.filter(st => !st.user).length;
      const mine = !!mySeat;
      return `<div class="cards-game"><header class="cg-head"><b class="cg-title">${want === 'tarot' ? `Tarot à ${c.settings.tarot}` : want === 'holdem' ? `Texas Hold'em à ${n}` : want === 'coinche' ? 'Coinche, 2 contre 2' : `Trou du cul à ${c.settings.tdc}`}</b>
        <span class="cg-info">Avant la donne : prends une place ; des robots jouent les places libres.</span></header>
        <div class="cg-table"><ul class="cg-seats" style="--cols:${K.seatCols(seats.length)}">${chips}</ul><div class="cg-pile">${room.hostId === me ? `<button class="btn big" type="button" data-action="cards-deal">Distribuer</button>` : ''}</div>
          <p class="cg-pile-text">${seats.length - freeSeats} joueur${seats.length - freeSeats > 1 ? 's' : ''} sur ${n} place${n > 1 ? 's' : ''}${room.hostId === me ? '' : ' · l\'hôte distribue'}</p></div>
        <div class="cg-me"><div class="cg-watch">${mine ? '<button class="btn ghost" type="button" data-action="table-leave">Quitter la table</button>'
          : `<button class="btn cg-join ${full ? 'is-error' : ''}" type="button" data-action="table-join">${freeSeats || !seats.length ? 'Prendre une place' : `Table complète (${n}/${n})`}</button>`}</div></div></div>`;
    })();

  useEffect(() => {   // the server's views, shown one after the other with their animations
    queue.current.push(room.cards);
    void play();
  }, [room.cards]);
  const show = (v: CardsView, last = false) => {
    const a = shown.current.holdem, b = v.holdem;
    if (b && v.game === 'holdem') {   // Hold'em: the hands just turned over (they flip, once)
      const same = !!a && a.hand === b.hand && a.startedAt === b.startedAt, f = new Set<string>(), mine = v.seats.find(x => x.user === me)?.id;
      if (same) for (const [seat, h] of Object.entries(b.holes)) h.forEach((cd, i) => { if (seat !== mine && cd.r && !a!.holes[seat]?.[i]?.r) f.add(`${seat}:${i}`); });
      setFresh(f);
    }
    shown.current = v; setShown(v); setShowLast(last);
  };
  async function play() {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length) {
        const el = box.current;
        if (!el || queue.current.length > 6 || document.hidden || A.reduced()) {   // too far behind: the last view
          const v = queue.current.at(-1)!;
          hideSel.current.clear(); setPay(false); if (v.coinche?.result) setCountFor(v.coinche.deal);
          show(v); queue.current = []; break;
        }
        const next = queue.current.shift()!, prev = shown.current, step = A.diff(prev, next);
        if (next.game === 'holdem' && next.holdem) { await holdemStep(el, prev, next); continue; }
        const seat = prev.seats.find(s => s.user === me)?.id ?? '';
        const from = step.played.map(p => A.sources(el, p, p.by === seat));
        from.forEach(f => f.forEach((_, id) => hidden.current.add(id)));
        show(next, !!step.gather);
        if (from.length) { await A.painted(); for (const f of from) { await A.flyIn(el, f); f.forEach((_, id) => hidden.current.delete(id)); } }
        hidden.current.clear();
        if (step.gather) { await A.wait(700); await A.gather(el, step.gather, step.gather === seat); setShowLast(false); }
        const name = (id: string) => { const s = next.seats.find(x => x.id === id), u = s?.user ?? s?.credit; return u === me ? 'Toi' : (u && useStore.getState().room?.members.find(m => m.id === u)?.name) || s?.bot || '?'; };
        if (step.take) { setAnnounce(TV.takeAnnounce(name(step.take.seat), step.take.bid as Exclude<TA.Bid, 'pass'>)); await A.wait(2000); setAnnounce(''); }
        for (const h of step.handfuls) { setAnnounce(TV.handfulAnnounce(name(h.seat), h.level, h.cards as TA.TCard[], next.art ?? {})); await A.wait(2400); setAnnounce(''); }
        const ca = prev.coinche, cb = next.coinche;
        if (ca && cb && ca.deal === cb.deal && ca.startedAt === cb.startedAt) {   // the Coinche: the coinche, the contract, the belote, the deal's end
          if (!ca.coincheBy && cb.coincheBy) { setAnnounce(CV.coincheAnnounce(name(cb.coincheBy), false)); await A.wait(1800); setAnnounce(''); }
          if (ca.contract?.mult !== 4 && cb.contract?.mult === 4) { const s = cb.speeches.at(-1)!.by; setAnnounce(CV.coincheAnnounce(name(s), true)); await A.wait(1800); setAnnounce(''); }
          if (ca.phase === 'bid' && cb.phase === 'play' && cb.contract) { setAnnounce(CV.contractAnnounce(name(cb.contract.by), cb.contract)); await A.wait(2200); setAnnounce(''); }
          if (cb.belote.said > ca.belote.said && cb.belote.by) { setAnnounce(CV.beloteAnnounce(name(cb.belote.by), cb.belote.said)); await A.wait(1400); setAnnounce(''); }
          if (!ca.result && cb.result) { await A.wait(500); setAnnounce(CV.dealAnnounce(cb.result.made, cb.result.contract)); await A.wait(1800); setAnnounce(''); }
        }
        if (cb?.result) setCountFor(cb.deal);   // its last trick gathered: the count in the foreground
        if (step.chelem) { setAnnounce(TV.chelemAnnounce(name(step.chelem))); await A.wait(2000); setAnnounce(''); }
        if (step.call) {
          const mine = step.call.taker !== seat && !!next.tarot?.hands[seat]?.some(x => x.id === step.call!.card.id);
          setAnnounce(TV.callAnnounce(name(step.call.taker), step.call.card as TA.TCard, next.art ?? {}, mine)); await A.wait(2800); setAnnounce('');
        }
      }
    } finally { busy.current = false; }
  }
  /** Hold'em: the step's flights (cards from the deck, chips to the felt, to the pot, to the winners), then what is
   *  announced (an all-in, a player out, the winner, the blinds up). */
  async function holdemStep(el: HTMLElement, prev: CardsView, next: CardsView) {
    const a = prev.game === 'holdem' ? prev.holdem : null, b = next.holdem!, seat = next.seats.find(x => x.user === me)?.id ?? '';
    const name = (id: string) => { const s = next.seats.find(x => x.id === id), u = s?.user ?? s?.credit; return u === me ? 'Toi' : (u && useStore.getState().room?.members.find(m => m.id === u)?.name) || s?.bot || '?'; };
    const reveal = async () => {   // the hand's end in the foreground: each pot, its winner's cards + the board, the hand's name
      for (const aw of b.result?.awards ?? []) { setAnnounce(HV.handAnnounce(b as unknown as HE.Holdem, aw, name, seat, b.result!.awards.length)); await A.wait(HA.T.read); }
      setAnnounce('');
    };
    const p = HA.plan(el, a, b, seat, () => setPay(false), reveal);
    hideSel.current = new Set(p?.hide ?? []);
    setPay(!!p && !!a && a.hand === b.hand && a.street !== 'showdown' && b.street === 'showdown' && !!b.result);
    show(next);
    const same = !!a && a.startedAt === b.startedAt;
    if (same) for (const [s, l] of Object.entries(b.last)) if (l.act === 'allin' && a!.last[s]?.act !== 'allin') {   // an all-in: said a moment, the table goes on
      const html = HV.allinAnnounce(name(s), b.bets[s] || l.amount);
      setAnnounce(html); setTimeout(() => setAnnounce(x => (x === html ? '' : x)), 1300);
    }
    if (same && b.hand !== a!.hand && b.levelUp) { setAnnounce(HV.levelAnnounce(b.sb, b.bb)); await A.wait(1800); setAnnounce(''); }
    if (p) await p.run(el, sel => { hideSel.current.delete(sel); el.querySelectorAll<HTMLElement>(sel).forEach(x => { x.style.visibility = ''; }); });
    hideSel.current.clear(); setPay(false);
    if (!same) return;
    for (const s of b.out.filter(x => !a!.out.includes(x))) { setAnnounce(HV.outAnnounce(name(s), b.places[s] ?? 0, s === seat)); await A.wait(2000); setAnnounce(''); }
    if (b.over && !a!.over) { const w = Object.keys(b.places).find(x => b.places[x] === 1); if (w) { setAnnounce(HV.winAnnounce(name(w), w === seat)); await A.wait(2400); setAnnounce(''); } }
  }
  useLayoutEffect(() => {   // Hold'em: the pieces on their way stay hidden at their place until they land
    for (const sel of hideSel.current) box.current?.querySelectorAll<HTMLElement>(sel).forEach(x => x.style.setProperty('visibility', 'hidden'));
  });
  useLayoutEffect(() => {   // the cards on their way stay hidden at their place until they land
    for (const id of hidden.current) box.current?.querySelector<HTMLElement>(`.on-table[data-card="${CSS.escape(id)}"]`)?.style.setProperty('visibility', 'hidden');
  });
  useLayoutEffect(() => {   // the exact fan for the hand's width, after each redraw
    const hand = box.current?.querySelector<HTMLElement>('[data-hand]'), cards = hand ? [...hand.querySelectorAll<HTMLElement>('.in-hand')] : [];
    if (!hand || !cards.length) return;
    const { r, step } = fan(cards.length, box.current), n = cards.length;
    hand.style.setProperty('--r', `${r}px`);
    cards.forEach((el, i) => el.style.setProperty('--a', `${((i - (n - 1) / 2) * step).toFixed(4)}rad`));
  });
  useEffect(() => {   // the clock of the game
    const start = (coinche ?? holdem ?? tarot ?? t)?.startedAt;
    const tick = () => {
      const el = box.current?.querySelector('[data-card-clock]'); if (el && start) el.textContent = fmtClock(Date.now() - start);
      box.current?.querySelectorAll<HTMLElement>('[data-countdown]').forEach(x => { x.textContent = String(Math.max(0, Math.ceil((Number(x.dataset.countdown) - Date.now() - useStore.getState().clockSkew) / 1000))); });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [t, tarot, holdem, coinche]);

  const ack = (r: { ok: boolean; error?: string }) => setNote(r.ok ? '' : r.error ?? '');
  const onAction = async (a: string, el: HTMLElement) => {
    if (a.startsWith('holdem-') && holdem) {
      const stack = holdem.stacks[mySeat] ?? 0;
      const sum = (vs: number[]) => vs.reduce((x, y) => x + y, 0), v = Number(el.dataset.v);
      if (a === 'holdem-chip') { setPending(p => (sum(p) + v <= stack ? [...p, v] : p)); return; }   // a chip clicked: on my bet
      if (a === 'holdem-pend') { setPending(HE.chipsOf(Math.min(stack, v)).flatMap(([c, n]) => Array<number>(n).fill(c))); return; }
      if (a === 'holdem-clear') { setPending([]); return; }
      const move = a === 'holdem-bet' ? HV.pendingMove(holdem, mySeat, sum(pending)).move : a === 'holdem-fold' ? { act: 'fold' as const } : a === 'holdem-check' ? { act: 'check' as const }
        : a === 'holdem-call' ? { act: 'call' as const } : { act: 'allin' as const };
      if (move) ack(await request('holdem:act', move));
      return;
    }
    if (a === 'card-pick' && coinche) {   // a card: chosen, then clicked again to play it
      const card = (coinche.hands[mySeat] ?? []).find(x => x.id === el.dataset.card);
      if (!card || coinche.phase !== 'play' || coinche.turn !== mySeat || !CO.legal(coinche, mySeat).some(x => x.id === card.id)) return;
      if (sel.has(card.id)) { ack(await request('cards:play', { cards: [card.id] })); return; }
      setSel(new Set([card.id]));
      return;
    }
    if (a === 'co-value') { setCoBid(b => ({ ...b, value: Number(el.dataset.v) })); return; }
    if (a === 'co-suit') { setCoBid(b => ({ ...b, suit: el.dataset.v as 'S' })); return; }
    if (a === 'co-bid' && coBid.value && coBid.suit) { ack(await request('coinche:say', { kind: 'bid', value: coBid.value, suit: coBid.suit })); return; }
    if (a === 'co-next') { ack(await request('coinche:next')); return; }
    if (a === 'co-pass' || a === 'co-coinche' || a === 'co-surcoinche') { ack(await request('coinche:say', { kind: a === 'co-pass' ? 'pass' : a === 'co-coinche' ? 'coinche' : 'surcoinche' })); return; }
    if (a === 'card-pick' && tarot) {
      const hand = tarot.hands[mySeat] ?? [], card = hand.find(x => x.id === el.dataset.card) as TA.TCard | undefined;
      if (!card) return;
      const full = tarot as unknown as TA.Tarot, next = new Set(sel);
      if (tarot.phase === 'dog' && tarot.taker === mySeat) {
        if (next.has(card.id)) next.delete(card.id); else if (TA.canDiscard(full, card) && next.size < TA.ecartSize(full)) next.add(card.id);
        setSel(next);
      } else if (tarot.phase === 'play' && tarot.turn === mySeat && TA.legal(full, mySeat).some(x => x.id === card.id)) {
        if (next.has(card.id)) { ack(await request('cards:play', { cards: [card.id] })); return; }   // clicked again: played
        setSel(new Set([card.id]));
      }
    } else if (a === 'tarot-bid') ack(await request('tarot:bid', { bid: el.dataset.v }));
    else if (a === 'tarot-call') ack(await request('tarot:call', { card: el.dataset.v }));
    else if (a === 'tarot-handful') ack(await request('tarot:handful', { level: Number(el.dataset.v) as 1 | 2 | 3 }));
    else if (a === 'tarot-chelem') ack(await request('tarot:chelem'));
    else if (a === 'tarot-ecart') ack(await request('tarot:discard', { cards: [...sel] }));
    else if (a === 'card-pick' && t) {
      const hand = t.hands[mySeat] ?? [], card = hand.find(x => x.id === el.dataset.card);
      if (!card) return;
      const next = new Set(sel);
      if (next.has(card.id)) next.delete(card.id);
      else { if ([...next].some(x => hand.find(y => y.id === x)?.r !== card.r)) next.clear(); next.add(card.id); }
      setSel(next);
    } else if (a === 'cards-play') ack(await request('cards:play', { cards: [...sel] }));
    else if (a === 'cards-pass') ack(await request('cards:pass'));
    else if (a === 'cards-deal') ack(await request('cards:deal'));
    else if (a === 'table-leave') ack(await request('table:leave'));
    else if (a === 'table-join') { const r = await request('table:join'); if (r.ok && r.value === 'full') { setFull(true); setTimeout(() => setFull(false), 2600); } else ack(r); }
    else if (a === 'join-game') ack(await request('disk:join'));
    else if (a === 'kick') ack(await request('kick:ask'));
    else if (a === 'cards-rules') setRules(true);
    else if (a === 'rules-close') setRules(false);
  };
  return <div className="cards-stage" ref={box}
    onMouseOver={e => { const w = (e.target as Element).closest<HTMLElement>('[data-won]')?.dataset.won ?? null; if (w !== wonView) setWonView(w); }}
    onMouseLeave={() => setWonView(null)}>
    <LiveHtml className="cards-holder" html={html} onAction={(a, el) => void onAction(a, el)} />
    {note && <p className="alert cards-note" role="alert">{note}</p>}
    {announce && <div className="announce-layer"><LiveHtml className="announce" html={announce} /></div>}
    {rules && <LiveHtml html={want === 'coinche' ? CV.coincheRulesHtml() : want === 'holdem' ? HV.holdemRulesHtml() : c.game === 'tarot' ? TV.tarotRulesHtml(c.art ?? {}) : K.rulesHtml()} onAction={(a, el) => void onAction(a, el)} />}
  </div>;
}
