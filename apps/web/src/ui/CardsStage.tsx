// The card table (openspec: card-games): the Trou du cul of the maquette (lib/cards.ts) drawn through LiveHtml; the
// server deals, checks every play, makes the robots play, and only ever sends me my own hand.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hueColor } from '@slopesque/engines';
import type { CardsView, MemberView } from '@slopesque/shared';
import * as K from '../lib/cards';
import { request } from '../net';
import { useStore } from '../store';
import { LiveHtml } from './LiveHtml';

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
  const c: CardsView = room.cards, t = c.tdc;
  const members = new Map(room.members.map(m => [m.id, m]));
  const [sel, setSel] = useState<Set<string>>(new Set()), [rules, setRules] = useState(false), [full, setFull] = useState(false), [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const mySeat = c.seats.find(s => s.user === me)?.id ?? '';
  useEffect(() => { setSel(new Set()); }, [t?.round, t?.turn]);

  const who = (id: string) => {
    const s = c.seats.find(x => x.id === id), uid = s ? s.user ?? s.credit : null, m: MemberView | undefined = uid ? members.get(uid) : undefined;
    return { name: uid === me ? 'Toi' : m?.name ?? s?.bot ?? '?', color: m ? hueColor(m.hue) : '#8a8f98', bot: !s?.user, photo: s?.user ? m?.photo ?? null : null };
  };
  const free = c.seats.filter(s => !s.user), mine = free.find(s => s.credit === me);
  const late = c.late ? { seat: c.late.seat, secs: c.late.secs, vote: room.chat.messages.some(m => m.kind === 'vote' && !(m.data?.vote as { result?: string } | undefined)?.result) } : null;
  const html = t ? K.tableHtml({ t: t as unknown as K.TableCtx['t'], me: mySeat, playing: !!mySeat, host: room.hostId === me, selected: sel, fan: fan(t.hands[mySeat]?.length ?? 0, box.current),
    who, elapsed: '', late: late && late.seat !== mySeat ? late : null,
    seats: { free: free.length, total: c.seats.length, mine: !!mine, takes: free[0] ? who(free[0].id).name : '', full,
      paid: id => { const u = c.paid[id]; const m = u ? members.get(u) : undefined; return u ? { name: u === me ? 'Toi' : m?.name ?? '?', color: m ? hueColor(m.hue) : '#8a8f98', bot: false } : { ...who(id), bot: true }; } } })
    : `<div class="cards-game"><header class="cg-head"><b class="cg-title">Trou du cul</b><span class="cg-info">${room.hostId === me ? 'Distribue quand les joueurs ont cliqué « Participer » : des robots prennent les places libres (3 au moins).' : "L'hôte distribue les cartes…"}</span></header>
      <div class="cg-table"><div class="cg-pile">${room.hostId === me ? '<button class="btn big" type="button" data-action="cards-deal">Distribuer</button>' : ''}</div></div>
      <div class="cg-me">${room.members.find(m => m.id === me)?.playing || room.hostId === me ? '' : '<div class="cg-watch"><button class="btn" type="button" data-action="join-game">Participer</button></div>'}</div></div>`;

  useLayoutEffect(() => {   // the exact fan for the hand's width, after each redraw
    const hand = box.current?.querySelector<HTMLElement>('[data-hand]'), cards = hand ? [...hand.querySelectorAll<HTMLElement>('.in-hand')] : [];
    if (!hand || !cards.length) return;
    const { r, step } = fan(cards.length, box.current), n = cards.length;
    hand.style.setProperty('--r', `${r}px`);
    cards.forEach((el, i) => el.style.setProperty('--a', `${((i - (n - 1) / 2) * step).toFixed(4)}rad`));
  });
  useEffect(() => {   // the clock of the game
    const id = setInterval(() => { const el = box.current?.querySelector('[data-card-clock]'); if (el && t) el.textContent = fmtClock(Date.now() - t.startedAt); }, 1000);
    return () => clearInterval(id);
  }, [t]);

  const ack = (r: { ok: boolean; error?: string }) => setNote(r.ok ? '' : r.error ?? '');
  const onAction = async (a: string, el: HTMLElement) => {
    if (a === 'card-pick' && t) {
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
  return <div className="cards-stage" ref={box}>
    <LiveHtml className="cards-holder" html={html} onAction={(a, el) => void onAction(a, el)} />
    {note && <p className="alert cards-note" role="alert">{note}</p>}
    {rules && <LiveHtml html={K.rulesHtml()} onAction={(a, el) => void onAction(a, el)} />}
  </div>;
}
