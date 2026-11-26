// The Demi-disque on the stage (openspec: semicircle-disk, round-flow, amphitheatre-mode): the topic, the answer time,
// the disk (or the Amphithéâtre's seats), the actions of my role, the results. The SVGs are lib/disk.ts and
// lib/amphi.ts (persistent, updated by effects); the server decides, the panel only shows and sends intents.
import { useEffect, useRef, useState } from 'react';
import { COLS, hueColor, TOLERANCE } from '@slopesque/engines';
import { scoreKey, type DiskView, type MemberView } from '@slopesque/shared';
import { Amphi, type ColumnMark, type SeatMark } from './amphi';
import { Disk, type Ray } from './disk';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Icon, Who } from '../../design';
import { PresenceIcon } from '../chat/Chat';

export function DiskStage() {
  const room = useStore(s => s.room)!, account = useStore(s => s.account)!, skew = useStore(s => s.clockSkew);
  const d: DiskView = room.disk, me = account.id;
  const members = new Map(room.members.map(m => [m.id, m]));
  const host = room.hostId ? members.get(room.hostId) : undefined;
  const myself = members.get(me);
  const role = room.hostId === me ? 'host' : myself?.playing ? 'candidate' : 'spectator';
  const [pick, setPick] = useState<number | null>(null), [word, setWord] = useState(''), [note, setNote] = useState('');
  const boxRef = useRef<HTMLDivElement>(null), disk = useRef<Disk | null>(null), amphi = useRef<Amphi | null>(null);
  const mode = d.phase === 'guessing' || d.phase === 'reveal' ? d.mode : d.rules.mode;
  const pickRef = useRef(setPick);
  useEffect(() => {   // Amphithéâtre: someone validated the seat I had picked first
    if (d.phase === 'guessing' && mode === 'amphi' && pick !== null && !(me in d.guesses) && Object.values(d.guesses).includes(pick)) { setPick(null); setNote('Ce siège vient d\'être pris.'); }
  }, [d.guesses]);

  useEffect(() => {   // the SVGs, made once
    const box = boxRef.current!;
    disk.current = new Disk(box, { tolerance: TOLERANCE, onPick: v => pickRef.current(v) });
    amphi.current = new Amphi(box, { onPick: v => pickRef.current(v) });
    return () => { disk.current?.svg.remove(); amphi.current?.svg.remove(); };
  }, []);
  useEffect(() => { setPick(null); setNote(''); }, [d.phase, d.round]);

  const canPick = (d.phase === 'writing' || d.phase === 'lobby') && role === 'host' || d.phase === 'guessing' && role === 'candidate' && !(me in d.guesses);
  useEffect(() => {
    const D = disk.current!, A = amphi.current!;
    D.svg.toggleAttribute('hidden', mode !== 'ray');
    A.svg.toggleAttribute('hidden', mode !== 'amphi');
    D.setInteractive(mode === 'ray' && canPick);
    A.setInteractive(mode === 'amphi' && canPick ? (role === 'host' ? 'column' : 'seat') : null);
    const color = (id: string) => hueColor(members.get(id)?.hue ?? 222), hostColor = host ? hueColor(host.hue) : '#888';
    const name = (id: string) => (id === me ? 'Toi' : members.get(id)?.name ?? '?');
    if (mode === 'ray') {
      const rays: Ray[] = [];
      if (d.phase !== 'guessing' && d.phase !== 'reveal' && role === 'host' && pick !== null) rays.push({ id: 'target', value: pick, color: hostColor, kind: 'target' });
      if (d.target !== null && (d.phase === 'guessing' || d.phase === 'reveal')) rays.push({ id: 'target', value: d.target, color: hostColor, kind: 'target', label: `${host?.name ?? '?'} (hôte)` });
      for (const [id, v] of Object.entries(d.guesses)) rays.push({ id, value: v, color: color(id), kind: id === me ? 'mine' : 'player', label: name(id) });
      if (d.phase === 'guessing' && role === 'candidate' && !(me in d.guesses) && pick !== null) rays.push({ id: me, value: pick, color: color(me), kind: 'mine', label: 'Toi (non validé)' });
      D.setRays(rays);
    } else {
      let column: ColumnMark | null = null;
      if (d.phase !== 'guessing' && d.phase !== 'reveal' && role === 'host' && pick !== null) column = { col: pick, color: hostColor, style: 'fill' };
      else if (d.target !== null) column = { col: d.target, color: hostColor, style: 'band' };
      const seats: SeatMark[] = Object.entries(d.guesses).map(([id, s]) => ({ seat: s, color: color(id), kind: id === me ? 'mine' : 'player', label: name(id) }));
      if (d.phase === 'guessing' && role === 'candidate' && !(me in d.guesses) && pick !== null) seats.push({ seat: pick, color: color(me), kind: 'pending', label: 'Toi (non validé)' });
      A.setMarks(column, seats);
    }
  });

  // the answer time, from the server's deadline (my clock corrected)
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (d.phase !== 'guessing') return; const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, [d.phase]);
  const left = d.deadline ? Math.max(0, d.deadline - (now + skew)) : 0, total = d.rules.roundSeconds * 1000;

  const send = async <N extends 'disk:start' | 'disk:guess' | 'disk:join' | 'disk:next'>(name: N, body: object = {}) => {
    const r = await request(name, body);
    if (!r.ok) setNote(r.error); else setNote('');
    return r.ok;
  };
  const thing = mode === 'amphi' ? 'siège' : 'rayon';
  const join = <button className="btn big" type="button" onClick={() => void send('disk:join')}>Participer</button>;
  const chips = () => <ul className="chips">{room.members.filter(p => p.playing && p.id !== room.hostId).map(p => {
    const done = p.id in d.guesses;
    return <li key={p.id} className={`chip ${done ? 'done' : ''}`} style={{ '--c': hueColor(p.hue) } as React.CSSProperties}><span className="dot" style={{ '--c': hueColor(p.hue) } as React.CSSProperties} />{p.name}{done ? ' ✓' : ''}</li>;
  })}</ul>;

  let actions: React.ReactNode;
  if (d.phase === 'lobby' || d.phase === 'writing') {
    actions = role === 'host'
      ? <form className="actions" onSubmit={async e => { e.preventDefault(); if (pick === null || !word.trim()) return; if (await send('disk:start', { word: word.trim(), target: pick })) setWord(''); }}>
        <div className="word-row"><input className="word-input" name="word" placeholder="Ton mot" maxLength={40} autoComplete="off" value={word} onChange={e => setWord(e.target.value)} />
          <button className="btn" disabled={!word.trim() || pick === null}>Lancer le tour</button></div>
        <p className="hint">{mode === 'amphi' ? 'Écris un mot, puis clique sur une colonne de sièges pour placer ta réponse.' : 'Écris un mot, puis clique dans le demi-disque pour placer ton rayon.'}</p></form>
      : <div className="actions"><p className="hint">{host ? <><Who name={host.name} hue={host.hue} /> choisit un mot…</> : 'En attente d\'un hôte…'}</p>{role === 'spectator' && join}</div>;
  } else if (d.phase === 'guessing') {
    const wordEl = <div className="word">« {d.word} »</div>;
    actions = role === 'candidate' ? <div className="actions">{wordEl}{me in d.guesses
      ? <p className="hint">{mode === 'amphi' ? 'Siège validé' : 'Rayon validé'}. En attente des autres…</p>
      : <><button className="btn big" type="button" disabled={pick === null} onClick={() => void send('disk:guess', { value: pick })}>Valider mon {thing}</button>
        <p className="hint">{mode === 'amphi' ? 'Clique sur un siège libre : où places-tu ce mot ?' : 'Clique dans le demi-disque : où places-tu ce mot ?'}</p></>}{chips()}</div>
      : <div className="actions">{wordEl}<p className="hint">Les candidats choisissent leur {thing}…</p>{chips()}{role === 'spectator' && join}</div>;
  } else {
    const gap = (x: number) => (mode === 'amphi' ? (x === 0 ? 'dans la colonne' : `à ${x} colonne${x > 1 ? 's' : ''}`) : `à ${Math.round(x * 1.8)}°`);
    const rows = Object.entries(d.results).sort((a, b) => b[1].points - a[1].points);
    actions = <div className="actions"><div className="word">« {d.word} »</div><ul className="results">
      {rows.length ? rows.map(([id, r]) => { const p = members.get(id); return <li key={id} className="result" style={{ '--c': hueColor(p?.hue ?? 0) } as React.CSSProperties}>
        <span className="dot" style={{ '--c': hueColor(p?.hue ?? 0) } as React.CSSProperties} /><span>{id === me ? 'Toi' : p?.name ?? '?'}</span><small>{gap(r.distance)}</small>
        {r.perfect && <span className="perfect">PERFECT</span>}<b>+{r.points}</b></li>; }) : <li className="hint">Personne n'a validé.</li>}
      {host && <li className="result result-host" style={{ '--c': hueColor(host.hue) } as React.CSSProperties}><span className="dot" style={{ '--c': hueColor(host.hue) } as React.CSSProperties} />
        <span>{host.name} <span className="crown"><Icon name="crown" /></span></span><small>moyenne des candidats</small><b>+{d.hostPoints ?? 0}</b></li>}</ul>
      {role === 'host' ? <button className="btn big" type="button" onClick={() => void send('disk:next')}>Tour suivant</button>
        : <p className="hint">{host?.name ?? 'L\'hôte'} prépare le tour suivant…</p>}</div>;
  }
  return <div className="stage-grid">
    <div className="stage-head">
      <div><h1 className="topic">{d.rules.topic}</h1><p className="sub">Tour {d.round} · hôte {host ? <><span className="dot" style={{ '--c': hueColor(host.hue) } as React.CSSProperties} />{host.name}</> : '—'}</p></div>
      {d.phase === 'guessing' && <div className={`timer ${left < 5000 ? 'urgent' : ''}`}><div className="timer-fill" style={{ '--p': left / total } as React.CSSProperties} />
        <span className="timer-text">{Math.ceil(left / 1000)} s</span></div>}
    </div>
    <div className="disk-area"><div className="disk-box"><div ref={boxRef} data-disk />
      <div className="ends"><span>{d.rules.left}</span><span>{d.rules.right}</span></div></div></div>
    <div className="stage-actions">{actions}{note && <p className="alert" role="alert">{note}</p>}</div>
  </div>;
}

/** Partie (host): the topic and ends, the voting mode, the answer time, reset; read-only for the others. */
export function DiskSettings() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const d = room.disk, r = { ...d.rules, ...d.pending }, isHost = room.hostId === me;
  const [f, setF] = useState({ topic: r.topic, left: r.left, right: r.right });
  const [note, setNote] = useState('');
  const save = async (changes: object) => { const x = await request('disk:rules', changes); setNote(!x.ok ? x.error : x.value === 'pending' ? 'Appliqué à la fin du placement en cours.' : ''); };
  if (!isHost) return <><p className="note">Seul l'hôte change les réglages.</p>
    <dl className="game-info"><dt>Sujet</dt><dd>{r.topic}</dd><dt>Extrémités</dt><dd>{r.left} ↔ {r.right}</dd><dt>Mode</dt><dd>{r.mode === 'amphi' ? 'Amphithéâtre' : 'Rayon libre'}</dd><dt>Temps de réponse</dt><dd>{r.roundSeconds} s</dd></dl></>;
  return <>
    <form onSubmit={e => { e.preventDefault(); void save(f); }}>
      <label className="field"><span>Sujet</span><input name="topic" value={f.topic} maxLength={60} onChange={e => setF({ ...f, topic: e.target.value })} /></label>
      <div className="row"><label className="field"><span>Extrémité gauche</span><input name="left" value={f.left} maxLength={40} onChange={e => setF({ ...f, left: e.target.value })} /></label>
        <label className="field"><span>Extrémité droite</span><input name="right" value={f.right} maxLength={40} onChange={e => setF({ ...f, right: e.target.value })} /></label></div>
      <button className="btn">Enregistrer</button></form>
    <label className="field"><span>Mode de scrutin</span><select value={r.mode} onChange={e => void save({ mode: e.target.value })}>
      <option value="ray">Rayon libre</option><option value="amphi">Amphithéâtre</option></select></label>
    <p className="note">{r.mode === 'amphi' ? `L'hôte choisit une colonne de sièges (${COLS}), chaque candidat un siège libre ; perfect dans la colonne, sinon des points selon l'écart.` : 'Chacun place un rayon où il veut ; points selon l\'angle qui le sépare de celui de l\'hôte.'}</p>
    <label className="field"><span>Temps de réponse</span><select value={r.roundSeconds} onChange={e => void save({ roundSeconds: Number(e.target.value) })}>
      {[15, 30, 60].map(v => <option key={v} value={v}>{v} secondes</option>)}</select></label>
    {note && <p className="note pending">{note}</p>}
  </>;
}

/** The ranking (left drawer, Demi-disque): the podium, then everyone with his score. */
export function Ranking({ onGiveHost }: { onGiveHost: (m: MemberView) => void }) {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const key = scoreKey(room.activity) ?? 'disk', pts = (p: MemberView) => p.scores[key] ?? 0;   // this game's ranking
  const ranked = [...room.members].sort((a, b) => pts(b) - pts(a));
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean) as MemberView[];
  return <><div className="podium">{podium.map(p => { const rank = ranked.indexOf(p) + 1; return <div key={p.id} className={`step step-${rank}`}>
    <span className="avatar sm" style={{ '--c': hueColor(p.hue) } as React.CSSProperties}>{p.photo ? <img src={p.photo} alt="" /> : p.name.slice(0, 1)}</span>
    <span className="step-name">{p.name}</span><span className="step-score">{pts(p)}</span><div className="step-block" style={{ '--c': hueColor(p.hue) } as React.CSSProperties}>{rank}</div></div>; })}</div>
    <ol className="ranking">{ranked.map((p, i) => <li key={p.id} className={`rank-row ${p.id === me ? 'is-me' : ''}`}>
      <span className="rank-n">{i + 1}</span><span className="dot" style={{ '--c': hueColor(p.hue) } as React.CSSProperties} />
      <span className="rank-name">{p.name}<PresenceIcon m={p} host={p.id === room.hostId} />{p.id === room.hostId && <> <span className="crown" title="Hôte"><Icon name="crown" /></span></>}{!p.playing && p.id !== room.hostId && <> <i>(spectateur)</i></>}</span>
      <span className="rank-score">{pts(p)}</span>
      {room.hostId === me && p.id !== me && <button className="icon-btn sm" type="button" onClick={() => onGiveHost(p)} title={`Donner le rôle d'hôte à ${p.name}`} aria-label="Donner le rôle d'hôte"><Icon name="crown" /></button>}</li>)}</ol></>;
}

