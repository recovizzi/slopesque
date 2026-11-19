// A vote in the chat (openspec: chat-activity, Votes dans le chat): what is proposed, the time left, the count, Oui
// (green) / Non (red) for the players connected at its start; over: its result.
import { useEffect, useState } from 'react';
import { needed, type Vote } from '@slopesque/engines';
import type { MemberView } from '@slopesque/shared';
import { request } from '../net';
import { useStore } from '../store';
import { Icon, Who } from './common';

const fmtLeft = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function VoteCard({ id, v, members, me }: { id: number; v: Vote; members: Map<string, MemberView>; me: string }) {
  const skew = useStore(s => s.clockSkew), set = useStore(s => s.set);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (v.result) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [v.result]);
  const need = needed(v), n = v.yes.length + v.no.length, mine = v.yes.includes(me) ? 'yes' : v.no.includes(me) ? 'no' : null;
  const by = members.get(v.by);
  const cast = async (yes: boolean) => { const r = await request('vote:cast', { id, yes }); if (!r.ok) set({ note: r.error }); };
  const result = v.result === 'yes' ? <p className="vote-result ok">Accepté</p> : v.result === 'no' ? <p className="vote-result ko">Refusé</p>
    : v.result === 'quorum' ? <p className="vote-result ko">Pas assez de votes : {n} sur {need}</p> : v.result === 'cancelled' ? <p className="vote-result ko">Annulé (le serveur a redémarré)</p> : null;
  return <li className={`msg vote ${v.result ? `is-over is-${v.result}` : 'is-open'}`} data-msg={id}><div className="vote-card">
    <div className="vote-head"><Icon name="vote" /><span className="vote-q">{by ? <Who name={v.by === me ? 'Toi' : by.name} hue={by.hue} /> : '?'} {v.label}</span>
      {!v.result && <span className="vote-left" title="Temps restant">{fmtLeft(v.ends - (now + skew))}</span>}</div>
    <div className="vote-bar" aria-hidden="true"><span className="vb-yes" style={{ '--n': v.yes.length / Math.max(1, v.voters.length) } as React.CSSProperties} />
      <span className="vb-no" style={{ '--n': v.no.length / Math.max(1, v.voters.length) } as React.CSSProperties} /></div>
    <p className="vote-count">Oui {v.yes.length} · Non {v.no.length} · il faut {need} vote{need > 1 ? 's' : ''} pour que ça compte ({v.voters.length} connecté{v.voters.length > 1 ? 's' : ''})</p>
    {v.result ? result : v.voters.includes(me) ? <div className="vote-actions">
      <button type="button" className={`btn vote-yes ${mine === 'yes' ? 'on' : ''}`} aria-pressed={mine === 'yes'} onClick={() => void cast(true)}>Oui</button>
      <button type="button" className={`btn vote-no ${mine === 'no' ? 'on' : ''}`} aria-pressed={mine === 'no'} onClick={() => void cast(false)}>Non</button></div>
      : <p className="note">{v.target === me ? 'Ce vote te concerne : tu ne votes pas.' : 'Absent à son lancement : tu ne votes pas.'}</p>}
  </div></li>;
}
