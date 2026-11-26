// The Palmarès (openspec: leaderboard): every result kept with the room, by game, measure and period; asked to the
// server when shown and after each round. The filters, then one row per player (the measure in big, its context in
// small); the counting is model.ts.
import { useEffect, useState, type CSSProperties } from 'react';
import { hueColor } from '@slopesque/engines';
import { cardGameOf, type PalmaresEvent } from '@slopesque/shared';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { cls, Dot, Field, Note, Select } from '../../design';
import * as S from './model';

export function Palmares() {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const act = room.activity.activity;
  // the game being played
  const game: S.StatGame | 'all' = act === 'disk' ? 'disk' : act === 'cards' ? cardGameOf(room.activity) : 'all';
  const [events, setEvents] = useState<PalmaresEvent[]>([]);
  const [filter, setFilter] = useState<S.Filter>({ game, sort: S.SORTS[game][0]!.key as string, period: 'all' });
  const { tdc, tarot, holdem, coinche } = room.cards; // a round or a deal over: asked again
  const ends = [tdc?.round, tdc?.turn === null, tarot?.deal, tarot?.phase === 'done', holdem?.over, coinche?.deal];
  const tick = [room.disk.round, room.disk.phase, ...ends, coinche?.phase === 'done'].join(':');
  useEffect(() => {
    void request('palmares:get').then(r => {
      if (r.ok) setEvents(r.value);
    });
  }, [tick]);

  const f = filter,
    now = Date.now(),
    present = new Set(room.members.map(m => m.id));
  const stats = events.map(e => ({ ...e, color: hueColor(e.hue) })) as unknown as S.StatEvent[];
  const { sort, ranked, unranked } = S.ranked(S.rows(stats, f, now), f);
  const row = (r: S.Row, i: number | null) => {
    const cell = S.cells(r, f, sort.key);
    return (
      <li key={r.id} className={cls('pal-row', r.id === me && 'is-me')} style={{ '--c': r.color } as CSSProperties}>
        <span className="rank-n">{i === null ? '–' : i + 1}</span>
        <Dot color={r.color} />
        <span className="pal-who">
          <b>{r.name}</b>
          {!present.has(r.id) && <i> (parti)</i>}
          <small>
            {cell.sub.join(' · ')} · {S.ago(r.last, now)}
          </small>
        </span>
        <span className="pal-main">{cell.main}</span>
      </li>
    );
  };
  return (
    <div className="palmares">
      <Filters filter={f} sort={sort.key} onChange={setFilter} />
      {ranked.length || unranked.length ? (
        <>
          <ol className="pal-list">{ranked.map((r, i) => row(r, i))}</ol>
          {unranked.length > 0 && (
            <>
              <Note className="pal-sep">
                Moins de {sort.key === 'takeRate' ? '3 prises' : `${S.MIN_PLAYED} ${S.GAMES[f.game].unit}`} : pas encore
                classés sur ce taux
              </Note>
              <ol className="pal-list">{unranked.map(r => row(r, null))}</ol>
            </>
          )}
        </>
      ) : (
        <Note>Personne n'a encore joué {f.game === 'all' ? '' : `au ${S.GAMES[f.game].name} `}sur cette période.</Note>
      )}
      <Note className="pal-foot">
        {S.GAMES[f.game].name} : on compte les {S.GAMES[f.game].win}. Le palmarès garde tout, même après une
        réinitialisation des scores, et les joueurs partis.
      </Note>
    </div>
  );
}

/** The game, the measure suited to it, the period. */
function Filters({ filter, sort, onChange }: { filter: S.Filter; sort: string; onChange: (f: S.Filter) => void }) {
  return (
    <div className="pal-filters">
      <Field label="Jeu">
        <Select
          data-pal="game"
          value={filter.game}
          onChange={v => {
            const game = v as S.Filter['game'];
            onChange({ ...filter, game, sort: S.SORTS[game][0]!.key as string });
          }}
          options={(Object.keys(S.GAMES) as (S.StatGame | 'all')[]).map(k => ({ value: k, label: S.GAMES[k].name }))}
        />
      </Field>
      <div className="row">
        <Field label="Classer par">
          <Select
            data-pal="sort"
            value={sort}
            onChange={v => onChange({ ...filter, sort: v })}
            options={S.SORTS[filter.game].map(s => ({ value: s.key, label: s.label }))}
          />
        </Field>
        <Field label="Période">
          <Select
            data-pal="period"
            value={String(filter.period)}
            onChange={v => onChange({ ...filter, period: (v === 'all' ? v : Number(v)) as S.Period })}
            options={(Object.keys(S.PERIODS) as S.Period[]).map(k => ({ value: String(k), label: S.PERIODS[k] }))}
          />
        </Field>
      </div>
    </div>
  );
}
