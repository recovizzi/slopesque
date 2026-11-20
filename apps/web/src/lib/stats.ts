// The « Palmarès »: every result of every player who ever played in the room, kept apart from the scores (a reset
// of the scores doesn't touch it), to compare players over time: games played, won, win rate, and what makes sense
// for each game (perfects, présidences, prises…), over a period, sorted by the measure chosen.
// See openspec/changes/define-game-concept/specs/leaderboard/spec.md.
import { esc } from './html';
import type { Tdc } from '@slopesque/engines';
type Role = Tdc.Role;

export type StatGame = 'disk' | 'tdc' | 'tarot' | 'holdem';
/** One player's result in one round / deal (the room keeps them; the name and colour as they were). */
export interface StatEvent {
  at: number; game: StatGame; id: string; name: string; color: string; won: boolean;
  pts?: number;          // disk: points of the round; tarot: the mark
  perfect?: boolean;     // disk
  role?: Role;           // tdc
  taker?: boolean;       // tarot: took
  partner?: boolean;     // tarot at 5: was called
  place?: number;        // holdem: the place in the game…
  of?: number;           // … of so many seats
}

export const GAMES: Record<StatGame | 'all', { name: string; unit: string; win: string }> = {
  all: { name: 'Tous les jeux', unit: 'parties', win: 'victoires' },
  disk: { name: 'Demi-disque', unit: 'tours', win: 'tours gagnés (meilleur score du tour)' },
  tdc: { name: 'Trou du cul', unit: 'manches', win: 'présidences' },
  tarot: { name: 'Tarot', unit: 'donnes', win: 'donnes gagnées (dans le camp gagnant)' },
  holdem: { name: 'Texas Hold\'em', unit: 'parties', win: 'parties gagnées (1re place)' },
};

export interface Row {
  id: string; name: string; color: string;
  played: number; won: number; rate: number;
  perfects: number; avg: number;               // disk
  trous: number;                               // tdc
  takes: number; takesWon: number; takeRate: number; best: number;   // tarot
  avgPlace: number; podiums: number;           // holdem: the average place, the games in the first half
  games: number;                               // all: how many games played
  last: number;
}

/** The measures to sort by, for a game; `rate: true` needs MIN_PLAYED to mean something. */
export const SORTS: Record<StatGame | 'all', { key: keyof Row; label: string; rate?: boolean; asc?: boolean }[]> = {
  all: [{ key: 'won', label: 'Victoires' }, { key: 'rate', label: '% de victoires', rate: true }, { key: 'played', label: 'Parties jouées' }],
  disk: [{ key: 'won', label: 'Tours gagnés' }, { key: 'rate', label: '% de tours gagnés', rate: true }, { key: 'perfects', label: 'Perfects' }, { key: 'avg', label: 'Points moyens par tour', rate: true }, { key: 'played', label: 'Tours joués' }],
  tdc: [{ key: 'won', label: 'Présidences' }, { key: 'rate', label: '% de présidences', rate: true }, { key: 'trous', label: 'Le moins souvent Trou du cul', rate: true, asc: true }, { key: 'played', label: 'Manches jouées' }],
  tarot: [{ key: 'won', label: 'Donnes gagnées' }, { key: 'rate', label: '% de donnes gagnées', rate: true }, { key: 'takes', label: 'Prises' }, { key: 'takeRate', label: '% de prises réussies', rate: true }, { key: 'best', label: 'Meilleure marque' }, { key: 'played', label: 'Donnes jouées' }],
  holdem: [{ key: 'won', label: 'Parties gagnées' }, { key: 'rate', label: '% de parties gagnées', rate: true }, { key: 'avgPlace', label: 'Place moyenne', rate: true, asc: true }, { key: 'podiums', label: 'Dans la première moitié' }, { key: 'played', label: 'Parties jouées' }],
};
export const MIN_PLAYED = 5;
export const PERIODS = { all: 'Depuis toujours', 30: '30 derniers jours', 7: '7 derniers jours' } as const;
export type Period = keyof typeof PERIODS;

export interface Filter { game: StatGame | 'all'; sort: string; period: Period }

/** One row per player who played this game in the period (players gone from the room too). */
export function rows(events: StatEvent[], f: Filter, now = Date.now()): Row[] {
  const since = f.period === 'all' ? 0 : now - Number(f.period) * 86_400_000;
  const map = new Map<string, Row & { gameSet: Set<StatGame>; ptsSum: number; ptsN: number; placeSum: number; placeN: number }>();
  for (const e of events) {
    if (e.at < since || (f.game !== 'all' && e.game !== f.game)) continue;
    let r = map.get(e.id);
    if (!r) {
      r = { id: e.id, name: e.name, color: e.color, played: 0, won: 0, rate: 0, perfects: 0, avg: 0, trous: 0, takes: 0, takesWon: 0, takeRate: 0, best: -Infinity, avgPlace: 0, podiums: 0, games: 0, last: 0, gameSet: new Set(), ptsSum: 0, ptsN: 0, placeSum: 0, placeN: 0 };
      map.set(e.id, r);
    }
    if (e.at >= r.last) { r.last = e.at; r.name = e.name; r.color = e.color; }   // the latest name and colour
    r.played++; if (e.won) r.won++;
    r.gameSet.add(e.game);
    if (e.perfect) r.perfects++;
    if (e.role === 'tdc') r.trous++;
    if (e.taker) { r.takes++; if (e.won) r.takesWon++; }
    if (e.place) { r.placeSum += e.place; r.placeN++; if (e.place <= Math.ceil((e.of ?? 2) / 2)) r.podiums++; }
    if (e.pts !== undefined) { r.ptsSum += e.pts; r.ptsN++; if (e.game === 'tarot') r.best = Math.max(r.best, e.pts); }
  }
  return [...map.values()].map(({ gameSet, ptsSum, ptsN, placeSum, placeN, ...r }) => ({
    ...r, avgPlace: placeN ? placeSum / placeN : 0, rate: r.played ? r.won / r.played : 0, avg: ptsN ? ptsSum / ptsN : 0, takeRate: r.takes ? r.takesWon / r.takes : 0,
    trous: r.played ? r.trous / r.played : 0, best: r.best === -Infinity ? 0 : r.best, games: gameSet.size,
  }));
}

/** Sorted by the measure; for a rate, the players with fewer than MIN_PLAYED games come after, not ranked. */
export function ranked(list: Row[], f: Filter) {
  const s = SORTS[f.game].find(x => x.key === f.sort) ?? SORTS[f.game][0];
  const enough = (r: Row) => !s.rate || (s.key === 'takeRate' ? r.takes >= 3 : r.played >= MIN_PLAYED);
  const by = (a: Row, b: Row) => ((s.asc ? 1 : -1) * ((a[s.key] as number) - (b[s.key] as number))) || b.played - a.played || a.name.localeCompare(b.name);
  return { sort: s, ranked: list.filter(enough).sort(by), unranked: list.filter(r => !enough(r)).sort((a, b) => b.played - a.played) };
}

const pct = (v: number) => `${Math.round(v * 100)} %`;
const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));
const ago = (t: number, now: number) => { const d = Math.floor((now - t) / 86_400_000); return d <= 0 ? 'aujourd\'hui' : d === 1 ? 'hier' : `il y a ${d} j`; };

/** The main value of a row for the measure, and its context in small. */
function cells(r: Row, f: Filter, key: keyof Row): { main: string; sub: string[] } {
  const main = key === 'rate' || key === 'takeRate' ? pct(r[key] as number) : key === 'trous' ? pct(r.trous) : key === 'avg' || key === 'avgPlace' ? num(Math.round((r[key] as number) * 10) / 10) : key === 'best' ? (r.best > 0 ? `+${r.best}` : String(r.best)) : String(r[key]);
  const unit = GAMES[f.game].unit;
  const sub = [`${r.won} / ${r.played} ${unit}`, pct(r.rate)];
  if (f.game === 'all') sub.push(`${r.games} jeu${r.games > 1 ? 'x' : ''}`);
  if (f.game === 'disk') sub.push(`${r.perfects} perfect${r.perfects > 1 ? 's' : ''}`, `moy. ${num(Math.round(r.avg * 10) / 10)}`);
  if (f.game === 'tdc') sub.push(`Trou du cul ${pct(r.trous)}`);
  if (f.game === 'holdem') sub.push(`place moyenne ${num(Math.round(r.avgPlace * 10) / 10)}`);
  if (f.game === 'tarot') sub.push(`${r.takes} prise${r.takes > 1 ? 's' : ''}${r.takes ? ` (${pct(r.takeRate)})` : ''}`, `meilleure ${r.best > 0 ? '+' : ''}${r.best}`);
  return { main, sub };
}

export interface View { events: StatEvent[]; filter: Filter; me: string; present: Set<string>; now?: number }

/** The Palmarès tab: the filters (game, measure suited to the game, period), then the players. */
export function palmaresHtml(v: View) {
  const { filter: f } = v, now = v.now ?? Date.now();
  const { sort, ranked: list, unranked } = ranked(rows(v.events, f, now), f);
  const opt = (val: string, label: string, cur: string) => `<option value="${val}" ${val === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const row = (r: Row, i: number | null) => {
    const c = cells(r, f, sort.key);
    return `<li class="pal-row ${r.id === v.me ? 'is-me' : ''}" style="--c:${r.color}">
      <span class="rank-n">${i === null ? '–' : i + 1}</span><span class="dot" style="--c:${r.color}"></span>
      <span class="pal-who"><b>${esc(r.name)}</b>${v.present.has(r.id) ? '' : ' <i>(parti)</i>'}<small>${c.sub.map(esc).join(' · ')} · ${ago(r.last, now)}</small></span>
      <span class="pal-main">${esc(c.main)}</span></li>`;
  };
  return `<div class="palmares">
    <div class="pal-filters">
      <label class="field"><span>Jeu</span><select data-pal="game">${(Object.keys(GAMES) as (StatGame | 'all')[]).map(k => opt(k, GAMES[k].name, f.game)).join('')}</select></label>
      <div class="row"><label class="field"><span>Classer par</span><select data-pal="sort">${SORTS[f.game].map(s => opt(s.key, s.label, sort.key)).join('')}</select></label>
      <label class="field"><span>Période</span><select data-pal="period">${(Object.keys(PERIODS) as Period[]).map(k => opt(String(k), PERIODS[k], String(f.period))).join('')}</select></label></div>
    </div>
    ${list.length || unranked.length ? `<ol class="pal-list">${list.map((r, i) => row(r, i)).join('')}</ol>
      ${unranked.length ? `<p class="note pal-sep">Moins de ${sort.key === 'takeRate' ? '3 prises' : `${MIN_PLAYED} ${GAMES[f.game].unit}`} : pas encore classés sur ce taux</p><ol class="pal-list">${unranked.map(r => row(r, null)).join('')}</ol>` : ''}`
      : `<p class="note">Personne n'a encore joué ${f.game === 'all' ? '' : `au ${GAMES[f.game].name} `}sur cette période.</p>`}
    <p class="note pal-foot">${esc(GAMES[f.game].name)} : on compte les ${esc(GAMES[f.game].win)}. Le palmarès garde tout, même après une réinitialisation des scores, et les joueurs partis.</p>
  </div>`;
}
