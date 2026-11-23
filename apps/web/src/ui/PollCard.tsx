// A poll continued in the chat (openspec: poll-activity, Sondage continué dans le chat): the activity changed while it
// was open, it goes on here — its question, its time left, who answered; answered here (a choice, a text, a point of
// the gradient, with the Sondage's own views: lib/poll.ts); closed, its results in the same message.
import { useEffect, useState } from 'react';
import { hueColor } from '@slopesque/engines';
import type { ChatPollView, MemberView, PollAnswer } from '@slopesque/shared';
import * as P from '../lib/poll';
import { request } from '../net';
import { useStore } from '../store';
import { LiveHtml } from './LiveHtml';
import { Icon } from './common';

const fmtLeft = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };

export function PollCard({ id, cp, members, me }: { id: number; cp: ChatPollView; members: Map<string, MemberView>; me: string }) {
  const room = useStore(s => s.room)!, skew = useStore(s => s.clockSkew);
  const [now, setNow] = useState(Date.now()), [pick, setPick] = useState<PollAnswer | null>(null), [free, setFree] = useState(''), [note, setNote] = useState('');
  useEffect(() => { if (cp.closed) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [cp.closed]);
  const custom = room.emoji.map(e => ({ name: e.name, url: e.url, by: e.by ?? '' }));
  const host = cp.host ? members.get(cp.host) : undefined, answered = cp.answered.includes(me), n = cp.closed && cp.answers ? Object.keys(cp.answers).length : cp.answered.length;
  const name = (x: string) => (x === me ? 'Toi' : members.get(x)?.name ?? '?'), color = (x: string) => hueColor(members.get(x)?.hue ?? 0);
  const html = cp.closed && cp.outcome ? P.resultsHtml({ ...cp.poll, answers: cp.answers ?? {} } as P.Poll, cp.outcome, { name, color }, cp.secret, custom)
    : answered ? '<p class="chat-poll-done">Réponse envoyée ✓ — les résultats s\'afficheront ici.</p>'
    : P.answerHtml({ ...cp.poll, answers: {} } as P.Poll, { pick, free, can: true, color: hueColor(members.get(me)?.hue ?? 222), custom });
  const send = async () => {
    const answer = cp.poll.kind === 'free' ? free.trim() : pick;
    if (answer === null || answer === '') return;
    const r = await request('poll:chat-answer', { id, answer });
    setNote(r.ok ? '' : r.error);
  };
  const ready = cp.poll.kind === 'free' ? !!free.trim() : pick !== null;
  const onGradient = (e: React.MouseEvent) => {   // a point of the gradient
    const svg = (e.target as Element).closest('[data-gradient]');
    if (!(svg instanceof SVGSVGElement) || cp.closed || answered) return;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()), at = P.fromSvg(cp.poll.choices.length, p.x, p.y);
    if (at) setPick(at);
  };
  return <li className={`msg vote chat-poll ${cp.closed ? 'is-over' : 'is-open'}`} data-msg={id}><div className="vote-card">
    <div className="vote-head"><Icon name="vote" /><span className="vote-q"><b>Sondage {cp.round}</b> · {cp.poll.question}<small> — {P.POLL_KINDS[cp.poll.kind].name}{host ? `, de ${host.id === me ? 'toi' : host.name}` : ''}</small></span>
      {!cp.closed && <span className="vote-left" title="Temps restant">{fmtLeft(cp.deadline - (now + skew))}</span>}</div>
    <div className="chat-poll-body" onClick={onGradient}
      onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).matches('[data-poll="free"]')) { e.preventDefault(); void send(); } }}>
      <LiveHtml className="poll-box" html={html} onAction={(a, el) => { if (a === 'poll-choose') setPick(Number(el.dataset.i)); }}
        onInput={el => { if (el.dataset.poll === 'free') setFree(el.value); }} /></div>
    <p className="vote-count">{cp.closed ? `Terminé · ${n} réponse${n > 1 ? 's' : ''}${cp.secret ? ' · résultats secrets' : ''}` : `${n} réponse${n > 1 ? 's' : ''} · continue dans le chat depuis un changement d'activité`}</p>
    {!cp.closed && <div className="vote-actions">
      {!answered && <button type="button" className="btn" disabled={!ready} onClick={() => void send()}>Valider ma réponse</button>}
      {(me === cp.host || me === room.hostId) && <button type="button" className="btn ghost" onClick={async () => { const r = await request('poll:chat-end', { id }); setNote(r.ok ? '' : r.error); }}>Terminer le sondage</button>}</div>}
    {note && <p className="note">{note}</p>}
  </div></li>;
}
