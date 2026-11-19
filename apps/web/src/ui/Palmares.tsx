// The Palmarès (openspec: leaderboard): every result kept with the room, by game, measure and period (the maquette's
// lib/stats.ts view); asked to the server when shown and after each round.
import { useEffect, useState } from 'react';
import { hueColor } from '@slopesque/engines';
import type { PalmaresEvent } from '@slopesque/shared';
import * as S from '../lib/stats';
import { request } from '../net';
import { useStore } from '../store';
import { LiveHtml } from './LiveHtml';

export function Palmares() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const act = room.activity.activity;
  const game: S.StatGame | 'all' = act === 'disk' ? 'disk' : act === 'cards' ? 'tdc' : 'all';
  const [events, setEvents] = useState<PalmaresEvent[]>([]);
  const [filter, setFilter] = useState<S.Filter>({ game, sort: S.SORTS[game][0]!.key as string, period: 'all' });
  const tick = `${room.disk.round}:${room.disk.phase}:${room.cards.tdc?.round}:${room.cards.tdc?.turn === null}`;
  useEffect(() => { void request('palmares:get').then(r => { if (r.ok) setEvents(r.value); }); }, [tick]);
  const html = S.palmaresHtml({ events: events.map(e => ({ ...e, color: hueColor(e.hue) })) as unknown as S.StatEvent[], filter, me, present: new Set(room.members.map(m => m.id)) });
  return <LiveHtml html={html} onInput={el => {
    const k = (el as HTMLElement).dataset.pal as keyof S.Filter | undefined;
    if (!k) return;
    const next = { ...filter, [k]: k === 'period' && el.value !== 'all' ? Number(el.value) : el.value } as S.Filter;
    if (k === 'game') next.sort = S.SORTS[next.game][0]!.key as string;
    setFilter(next);
  }} />;
}
