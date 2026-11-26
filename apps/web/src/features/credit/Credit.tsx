// The social credit (openspec: chat-activity, Crédit social): a hieroglyph by step (PNG masks in src/hieroglyphs,
// coloured by the theme), a change said in the chat, the /credit-social window (− / value / +, never oneself).
import { useState } from 'react';
import { amountOf, creditWord, fmtCredit, MAX_CHANGE, tierOf } from '@slopesque/engines';
import type { MemberView } from '@slopesque/shared';
import h1301d from './hieroglyphs/1301d.png';
import h13013 from './hieroglyphs/13013.png';
import h1300f from './hieroglyphs/1300f.png';
import h13012 from './hieroglyphs/13012.png';
import h13020 from './hieroglyphs/13020.png';
import h13024 from './hieroglyphs/13024.png';
import h1304f from './hieroglyphs/1304f.png';
import h1302d from './hieroglyphs/1302d.png';
import { request } from '../../app/net';
import { Avatar, Icon, useEscape, Who } from '../../design';

const SRC: Record<string, string> = { '1301d': h1301d, '13013': h13013, '1300f': h1300f, '13012': h13012, '13020': h13020, '13024': h13024, '1304f': h1304f, '1302d': h1302d };

export function Glyph({ delta }: { delta: number }) {
  const t = tierOf(delta);
  return <span className={`hiero ${delta < 0 ? 'is-take' : 'is-give'}`} style={{ '--src': `url('${SRC[t.code]}')` } as React.CSSProperties}
    role="img" aria-label={`${String.fromCodePoint(parseInt(t.code, 16))} ${t.name}`} title={t.name} data-glyph={t.code} />;
}

export const CreditBadge = ({ v }: { v: number }) => <span className={`credit-badge ${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}`} title="Crédit social (/credit-social pour le changer)">{fmtCredit(v)}</span>;

/** A change in the chat: who, the hieroglyph and the amount, to whom; then the same in words. */
export function CreditCard({ data, members, me }: { data: { by: string; to: string; delta: number }; members: Map<string, MemberView>; me: string }) {
  const name = (id: string) => (id === me ? 'Toi' : members.get(id)?.name ?? '?');
  const who = (id: string) => { const m = members.get(id); return m ? <Who name={name(id)} hue={m.hue} /> : <b>?</b>; };
  const n = Math.abs(data.delta);
  return <><div className={`credit-card ${data.delta < 0 ? 'is-take' : 'is-give'}`}>
    <span className="credit-who">{who(data.by)}</span>
    <span className="credit-act"><Glyph delta={data.delta} /><b className="credit-delta">{fmtCredit(data.delta)}</b></span>
    <span className="credit-who">{who(data.to)}</span></div>
    <p className="credit-line">{name(data.by)} {data.delta < 0 ? 'retire' : 'accorde'} {creditWord(n)} à {name(data.to)} · {tierOf(data.delta).name}</p></>;
}

/** The /credit-social window: the players and their credit; one chosen (not me); − or + the amount typed. */
export function CreditModal({ members, me, initial = null, onClose }: { members: MemberView[]; me: string; initial?: string | null; onClose: () => void }) {
  const [to, setTo] = useState<string | null>(initial), [amount, setAmount] = useState('10'), [error, setError] = useState('');
  useEscape(onClose);
  const n = amountOf(amount), target = members.find(p => p.id === to), ready = !!target && n !== null;
  const apply = async (sign: 1 | -1) => { if (!ready) return; const r = await request('credit:give', { to, delta: sign * n! }); if (r.ok) onClose(); else setError(r.error); };
  const btn = (sign: 1 | -1) => <button type="button" className={`btn credit-apply ${sign < 0 ? 'is-take' : 'is-give'}`} disabled={!ready} onClick={() => void apply(sign)} data-v={sign}
    title={ready ? `${sign < 0 ? 'Retirer' : 'Accorder'} ${n} à ${target!.name}` : 'Choisis un joueur et une valeur'}>{sign < 0 ? '−' : '+'}{n !== null && <Glyph delta={sign * n} />}</button>;
  return <><div className="modal-backdrop" onClick={onClose} />
    <div className="modal credit-modal" role="dialog" aria-modal="true" aria-label="Crédit social">
      <div className="rules-head"><h2>Crédit social</h2><button className="icon-btn sm" type="button" onClick={onClose} title="Fermer" aria-label="Fermer"><Icon name="close" /></button></div>
      <p className="note">Une valeur à part, sans effet sur les jeux, visible dans l'activité Chat. Chaque changement est dit dans le chat. On ne peut pas s'en donner soi-même.</p>
      <ul className="credit-list">{members.map(p => { const mine = p.id === me; return <li key={p.id}>
        <button type="button" className={`credit-row ${p.id === to ? 'on' : ''}`} disabled={mine} title={mine ? 'Impossible de se donner du crédit' : undefined} aria-pressed={p.id === to}
          onClick={() => { setTo(p.id); setError(''); }}><Avatar name={p.name} hue={p.hue} photo={p.photo} />
          <span className="credit-name">{mine ? 'Toi' : p.name}{mine && <> <i>(toi)</i></>}</span><CreditBadge v={p.credit} /></button></li>; })}</ul>
      <div className="credit-change">{btn(-1)}
        <label className="credit-amount"><input name="creditAmount" inputMode="numeric" value={amount} maxLength={4} autoComplete="off" aria-label="Valeur" onChange={e => { setAmount(e.target.value); setError(''); }} /></label>
        {btn(1)}</div>
      {error ? <p className="alert" role="alert">{error}</p> : !target ? <p className="note">Choisis un joueur dans la liste.</p>
        : n === null ? <p className="alert" role="alert">Un nombre entier de 1 à {MAX_CHANGE}.</p>
        : <p className="note">{target.name} : {fmtCredit(target.credit)}, puis {fmtCredit(target.credit - n)} avec −, ou {fmtCredit(target.credit + n)} avec +.</p>}
    </div></>;
}
