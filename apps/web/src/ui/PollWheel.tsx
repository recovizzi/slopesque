// The Sondage and the Roulette on the stage (openspec: poll-activity, roulette-activity). The views are the
// maquette's (lib/poll.ts, lib/wheel.ts) drawn through LiveHtml; the server keeps the poll's answers (hidden while
// open) and draws the wheel's angle.
import { useEffect, useRef, useState } from 'react';
import { hueColor } from '@slopesque/engines';
import { POLL_DURATIONS, type PollAnswer, type PollView, type WheelView } from '@slopesque/shared';
import * as P from '../lib/poll';
import * as W from '../lib/wheel';
import { request, upload } from '../net';
import { useStore } from '../store';
import { LiveHtml } from './LiveHtml';
import { Who } from './common';

const fmtDuration = (s: number) => (s < 3600 ? `${s / 60} min` : `${s / 3600} h`);
const fmtLeft = (ms: number) => { const s = Math.ceil(ms / 1000); if (s < 60) return `${s} s`; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m}:${String(s % 60).padStart(2, '0')}`; };
type Pic = { kind: 'image' | 'sticker'; src: string; w: number; h: number; mediaId?: string; stickerId?: string };

function useRole() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const member = room.members.find(m => m.id === me);
  return { room, me, role: room.hostId === me ? 'host' : member?.playing ? 'candidate' : 'spectator', host: room.members.find(m => m.id === room.hostId) };
}

function Head({ title, sub, deadline, total }: { title: string; sub: React.ReactNode; deadline: number | null; total: number }) {
  const skew = useStore(s => s.clockSkew);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!deadline) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [deadline]);
  const left = deadline ? Math.max(0, deadline - (now + skew)) : 0;
  return <div className="stage-head"><div><h1 className="topic">{title}</h1><p className="sub">{sub}</p></div>
    {deadline && <div className={`timer ${left < 10_000 ? 'urgent' : ''}`}><div className="timer-fill" style={{ '--p': left / total } as React.CSSProperties} /><span className="timer-text">{fmtLeft(left)}</span></div>}</div>;
}

export function PollStage() {
  const { room, me, role, host } = useRole();
  const pv: PollView = room.poll;
  const custom = room.emoji.map(e => ({ name: e.name, url: e.url, by: e.by ?? '' }));
  const [draft, setDraft] = useState<P.PollDraft & { pics: (Pic | null)[] }>(P.emptyDraft() as P.PollDraft & { pics: (Pic | null)[] });
  const [menu, setMenu] = useState<number | null>(null), [stickersFor, setStickersFor] = useState<number | null>(null), [note, setNote] = useState('');
  const [pick, setPick] = useState<PollAnswer | null>(null), [free, setFree] = useState('');
  const fileFor = useRef<number | null>(null), file = useRef<HTMLInputElement>(null);
  useEffect(() => { setPick(null); setFree(''); }, [pv.phase, pv.round]);
  const err = async (r: { ok: boolean; error?: string }) => setNote(r.ok ? '' : r.error ?? '');

  let view = '';
  if (pv.phase === 'writing') view = role === 'host' ? P.composeHtml(draft, { menu, stickers: stickersFor, library: room.stickers, note }) : '<p class="poll-wait">Le sondage arrive…</p>';
  else if (pv.poll && pv.phase === 'open') view = P.answerHtml({ ...pv.poll, answers: {} } as P.Poll, { mine: pv.mine ?? undefined, pick, free, can: role !== 'spectator' && pv.mine === null, color: hueColor(room.members.find(m => m.id === me)?.hue ?? 222), custom });
  else if (pv.poll && pv.outcome) {
    const name = (id: string) => (id === me ? 'Toi' : room.members.find(m => m.id === id)?.name ?? '?'), color = (id: string) => hueColor(room.members.find(m => m.id === id)?.hue ?? 0);
    view = P.resultsHtml({ ...pv.poll, answers: pv.answers ?? {} } as P.Poll, pv.outcome, { name, color }, pv.secret, custom);
  }

  const onAction = async (a: string, el: HTMLElement, e: React.MouseEvent) => {
    const i = Number(el.dataset.i);
    const d = { ...draft, choices: [...draft.choices], pics: [...draft.pics] };
    if (a === 'poll-kind') { d.kind = el.dataset.v as P.PollKind; setDraft(d); }
    else if (a === 'poll-add' && d.choices.length < P.MAX_CHOICES) { d.choices.push(''); d.pics.push(null); setDraft(d); }
    else if (a === 'poll-remove') { d.choices.splice(i, 1); d.pics.splice(i, 1); setDraft(d); setMenu(null); setStickersFor(null); }
    else if (a === 'choice-plus') { setMenu(menu === i ? null : i); setStickersFor(null); setNote(''); }
    else if (a === 'choice-file') { setMenu(null); fileFor.current = i; file.current?.click(); }
    else if (a === 'choice-sticker') { setMenu(null); setStickersFor(i); }
    else if (a === 'choice-sticker-close') setStickersFor(null);
    else if (a === 'choice-sticker-pick') { const st = room.stickers.find(s => s.id === el.dataset.id); if (st) { d.pics[i] = { kind: 'sticker', src: st.src, w: st.w, h: st.h, stickerId: st.id }; setDraft(d); } setStickersFor(null); }
    else if (a === 'choice-pic-remove') { d.pics[i] = null; setDraft(d); }
    else if (a === 'choice-gif' || a === 'choice-emoji') { setMenu(null); setNote('Pour l\'instant, une image ou un sticker par choix.'); }
    else if (a === 'poll-choose') setPick(i);
    void e;
  };
  const onInput = (el: HTMLInputElement) => {
    if (el.dataset.poll === 'question') setDraft({ ...draft, question: el.value });
    else if (el.dataset.poll === 'choice') { const c = [...draft.choices]; c[Number(el.dataset.i)] = el.value; setDraft({ ...draft, choices: c }); }
    else if (el.dataset.poll === 'free') setFree(el.value);
  };
  const onGradient = (e: React.MouseEvent) => {
    const svg = (e.target as Element).closest('[data-gradient]');
    if (!(svg instanceof SVGSVGElement) || !pv.poll || pv.phase !== 'open' || pv.mine !== null || role === 'spectator') return;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const at = P.fromSvg(pv.poll.choices.length, p.x, p.y);
    if (at) setPick(at);
  };
  const validate = async () => {
    const answer = pv.poll?.kind === 'free' ? free.trim() : pick;
    if (answer === null || answer === '') return;
    await err(await request('poll:answer', { answer }));
  };
  const publish = async () => await err(await request('poll:publish', { kind: draft.kind, question: draft.question, choices: draft.kind === 'free' ? [] : draft.choices,
    pics: draft.kind === 'choices' ? (draft.pics as (Pic | null)[]).map(p => (p ? { mediaId: p.mediaId, stickerId: p.stickerId } : null)) : [] }));
  const ready = pv.poll?.kind === 'free' ? !!free.trim() : pick !== null;
  const chips = <ul className="chips">{room.members.filter(p => p.playing && p.id !== room.hostId).map(p => { const done = pv.answered.includes(p.id);
    return <li key={p.id} className={`chip ${done ? 'done' : ''}`} style={{ '--c': hueColor(p.hue) } as React.CSSProperties}><span className="dot" style={{ '--c': hueColor(p.hue) } as React.CSSProperties} />{p.name}{done ? ' ✓' : ''}</li>; })}</ul>;
  const join = <button className="btn big" type="button" onClick={() => void request('disk:join')}>Participer</button>;
  let actions: React.ReactNode;
  if (pv.phase === 'writing') actions = role === 'host'
    ? <div className="actions"><button className="btn big" type="button" disabled={!P.ready(draft)} onClick={() => void publish()}>Publier le sondage</button>
      <p className="hint">Ouvert {fmtDuration(pv.seconds)}, ou jusqu'à ce que tous les candidats aient répondu.</p></div>
    : <div className="actions"><p className="hint">{host ? <><Who name={host.name} hue={host.hue} /> prépare un sondage…</> : 'En attente de l\'hôte…'}</p>{role === 'spectator' && join}</div>;
  else if (pv.phase === 'open') actions = role === 'spectator' ? <div className="actions">{join}<p className="hint">Rejoins pour répondre : il est encore temps.</p>{chips}</div>
    : <div className="actions"><div className="row">{pv.mine === null && <button className="btn big" type="button" disabled={!ready} onClick={() => void validate()}>Valider ma réponse</button>}
      {role === 'host' && <button className="btn ghost big" type="button" onClick={() => void request('poll:end')}>Terminer le sondage</button>}</div>
      <p className="hint">{pv.mine !== null ? `Réponse envoyée.${role === 'host' ? '' : ' En attente des autres…'}` : role === 'host' ? 'Tu peux répondre aussi : ta réponse départage une égalité pour la première place.' : 'Choisis ta réponse, puis valide.'}</p>{chips}</div>;
  else actions = <div className="actions">{role === 'host' ? <button className="btn big" type="button" onClick={() => { setDraft(P.emptyDraft(draft.kind) as typeof draft); void request('poll:next'); }}>Nouveau sondage</button>
    : <p className="hint">{host?.name ?? 'L\'hôte'} prépare le prochain sondage…</p>}</div>;

  const open = !!pv.poll && pv.phase !== 'writing';
  return <div className="stage-grid">
    <Head title={open ? pv.poll!.question : 'Sondage'} sub={<>Sondage {pv.round}{open ? ` · ${P.POLL_KINDS[pv.poll!.kind].name}` : ''} · hôte {host?.name ?? '—'}</>} deadline={pv.phase === 'open' ? pv.deadline : null} total={pv.seconds * 1000} />
    <div className="disk-area" onClick={onGradient}><LiveHtml className="poll-box" html={view} onAction={onAction} onInput={onInput} /></div>
    <div className="stage-actions">{actions}{note && pv.phase !== 'writing' && <p className="alert" role="alert">{note}</p>}</div>
    <input ref={file} type="file" accept="image/*" hidden onChange={async e => {
      const f = e.target.files?.[0], i = fileFor.current; e.target.value = '';
      if (!f || i === null) return;
      const r = await upload('poll', f);
      if (!r.ok) { setNote(r.error); return; }
      setDraft(d => { const pics = [...d.pics]; pics[i] = { kind: 'image', src: r.value.url, w: r.value.w, h: r.value.h, mediaId: r.value.id }; return { ...d, pics }; });
    }} />
  </div>;
}

export function PollSettings() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id, pv = room.poll, host = room.hostId === me;
  return <>
    <label className="field"><span>Temps de réponse</span><select value={pv.seconds} disabled={!host} onChange={e => void request('poll:settings', { seconds: Number(e.target.value) })}>
      {POLL_DURATIONS.map(v => <option key={v} value={v}>{fmtDuration(v)}</option>)}</select></label>
    <p className="note">Le sondage se ferme à la fin du temps, quand tous les candidats ont répondu, ou quand l'hôte le termine.</p>
    <label className="check"><input type="checkbox" checked={pv.secret} disabled={!host} onChange={e => void request('poll:settings', { secret: e.target.checked })} /><span>Résultats secrets</span></label>
    <p className="note">Coché : les résultats ne disent pas qui a répondu quoi.</p></>;
}

export function WheelStage() {
  const { room, role, host } = useRole();
  const wv: WheelView = room.wheel;
  const holder = useRef<HTMLDivElement>(null), wheel = useRef<W.Wheel | null>(null);
  const [items, setItems] = useState(wv.items);
  useEffect(() => { if (role !== 'host' || wv.phase !== 'writing') setItems(wv.items); }, [wv.items, wv.phase, role]);
  useEffect(() => { wheel.current = new W.Wheel(holder.current!); return () => { holder.current?.replaceChildren(); }; }, []);
  const shown = role === 'host' && wv.phase === 'writing' ? items : wv.spin && wv.phase !== 'writing' ? wv.spin.items : wv.items;
  useEffect(() => {
    wheel.current?.setItems(shown, wv.phase === 'result' && wv.spin ? wv.spin.winner : null);
    wheel.current?.setSpin(wv.phase === 'writing' ? null : (wv.spin as W.Spin | null));
  });
  const [note, setNote] = useState('');
  const change = (next: W.WheelItem[]) => { setItems(next); void request('wheel:set', { items: next }); };
  const side = wv.phase === 'writing' ? (role === 'host' ? W.editorHtml(items) : W.legendHtml(wv.items)) : W.legendHtml(wv.spin?.items ?? wv.items, wv.phase === 'result' ? wv.spin?.winner ?? null : null);
  const spin = async () => { const r = await request('wheel:spin'); setNote(r.ok ? '' : r.error); };
  let actions: React.ReactNode;
  if (wv.phase === 'writing') actions = role === 'host' ? <div className="actions"><button className="btn big" type="button" disabled={!!W.problem(items)} onClick={() => void spin()}>Lancer la roue</button>
    <p className="hint">Les autres joueurs voient la roue se construire.</p></div> : <div className="actions"><p className="hint">{host?.name ?? 'L\'hôte'} construit la roue…</p></div>;
  else if (wv.phase === 'spinning') actions = <div className="actions"><p className="hint spinning">La roue tourne…</p></div>;
  else { const w = W.winnerText(wv.spin as W.Spin); actions = <div className="actions"><div className="word" data-winner>« {w.label} »</div><p className="hint">{w.share} % de chances · aiguille arrêtée à {w.angle}°</p>
    {role === 'host' ? <div className="row"><button className="btn big" type="button" onClick={() => void spin()}>Relancer</button><button className="btn ghost big" type="button" onClick={() => void request('wheel:edit')}>Modifier la roue</button></div>
      : <p className="hint">{host?.name ?? 'L\'hôte'} prépare le prochain tirage…</p>}</div>; }
  return <div className="stage-grid">
    <Head title="Roulette" sub={<>hôte {host?.name ?? '—'}</>} deadline={null} total={1} />
    <div className="disk-area"><div className="wheel-box"><div className="wheel-holder" ref={holder} />
      <LiveHtml className="wheel-side" html={side} onAction={(a, el) => {
        const i = Number(el.dataset.i);
        if (a === 'wheel-add' && items.length < W.MAX_ITEMS) change([...items, { label: '', weight: '' }]);
        else if (a === 'wheel-remove') change(items.filter((_, k) => k !== i));
      }} onInput={el => { const i = Number(el.dataset.i), k = el.dataset.wh as 'label' | 'weight'; if (k) change(items.map((it, x) => (x === i ? { ...it, [k]: el.value } : it))); }} /></div></div>
    <div className="stage-actions">{actions}{note && <p className="alert" role="alert">{note}</p>}</div>
  </div>;
}
