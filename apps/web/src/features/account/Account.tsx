// The user code (openspec: player-account): the first launch, Profil → Compte, the window to change it (renew my code,
// take back an account, start again), with the strength of a code chosen by hand and a confirmation.
import { useState } from 'react';
import { canonicalCode, codeStrength, CODE_MIN_LEN, newCode, tidyCode, type Strength } from '@slopesque/engines';
import { checkCode, connect, request } from '../../app/net';
import { useStore } from '../../app/store';
import { Icon } from '../../design';
import { copyText } from '../../lib/clipboard';
import { ServerField } from '../rooms/ServerField';

export const SAMPLE_HINT = 'Tape le code affiché sur ton autre appareil (Profil → Compte). Majuscules, minuscules et tirets ne comptent pas.';

const copy = copyText;

export function CodeBox({ code, hidden, onToggle }: { code: string; hidden?: boolean; onToggle?: () => void }) {
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const show = hidden === undefined || !hidden;
  return <div className="code-box"><code className={`code-text ${show ? '' : 'is-hidden'}`}>{show ? code : code.replace(/[A-Z0-9]/g, '•')}</code>
    {onToggle && <button className="icon-btn sm" type="button" onClick={onToggle} title={show ? 'Masquer' : 'Afficher'} aria-label={show ? 'Masquer le code' : 'Afficher le code'} aria-pressed={show}><Icon name={show ? 'eyeOff' : 'eye'} /></button>}
    <button className="btn ghost sm" type="button" onClick={async () => { setCopied((await copy(code)) ? 'ok' : 'fail'); setTimeout(() => setCopied(''), 1600); }}>
      {copied === 'ok' ? 'Copié ✓' : copied === 'fail' ? 'Copie impossible' : 'Copier'}</button></div>;
}

/** The first launch: the code drawn for me, before any room. */
export function Welcome({ code, onChange }: { code: string; onChange: (mode: 'resume' | 'new') => void }) {
  const setDevice = useStore(s => s.setDevice);
  return <div className="room-card welcome"><h1>Bienvenue sur Slopesque</h1>
    <p>Voici ton <b>code utilisateur</b>. Il remplace compte et mot de passe : il relie ton pseudo, ta couleur, tes photos et tes résultats.</p>
    <CodeBox code={code} />
    <ServerField />
    <ul className="welcome-points">
      <li><Icon name="key" /><span><b>Note-le</b> : sur un autre appareil, ce code te rend ton compte.</span></li>
      <li><Icon name="lock" /><span><b>Garde-le pour toi</b> : qui le connaît prend ton compte.</span></li>
      <li><Icon name="reset" /><span>Tu pourras le changer à tout moment : Profil → Compte.</span></li></ul>
    <button className="btn big" type="button" onClick={() => { setDevice({ code }); connect(); }}>Continuer avec ce code</button>
    <div className="row welcome-other"><button className="btn ghost" type="button" onClick={() => onChange('resume')}>J'ai déjà un code</button>
      <button className="btn ghost" type="button" onClick={() => onChange('new')}>Choisir mon code</button></div></div>;
}

/** Profil → Compte. */
export function AccountSection({ onChange }: { onChange: () => void }) {
  const code = useStore(s => s.device.code);
  const [shown, setShown] = useState(false);
  return <section className="account"><h3>Compte</h3>
    <div className="field"><span>Code utilisateur</span><CodeBox code={code} hidden={!shown} onToggle={() => setShown(!shown)} />
      <p className="note">Ton identité, sans mot de passe : tape-le sur un autre appareil pour y retrouver ton compte. Ne le donne à personne.</p></div>
    <button className="btn danger-fill code-change-btn" type="button" onClick={onChange}><Icon name="key" />Changer de code utilisateur</button>
    <p className="note danger-note">Pour renouveler ton code en gardant ton compte (l'ancien code ne marchera plus), reprendre un compte existant (son code) ou repartir de zéro avec un compte vide.</p></section>;
}

const Meter = ({ s }: { s: Strength }) => <>
  <div className={`code-meter lv-${s.level}`} aria-hidden="true"><span /><span /><span /></div>
  <p className={`${s.level < 2 ? 'alert' : 'note'} code-reason`} role={s.level < 2 ? 'alert' : undefined}>{s.reason}</p></>;

export type CodeMode = 'renew' | 'resume' | 'new';

/** The window to change my code. `first`: from the first launch (no account to leave yet). */
export function CodeModal({ first, start, onClose, onDone }: { first: boolean; start: CodeMode | null; onClose: () => void; onDone: () => void }) {
  const { device, setDevice, account, set } = useStore();
  const [mode, setMode] = useState<CodeMode | null>(start);
  // the first launch keeps the code drawn on the welcome page; after a replaced code (fatal), a new one is drawn
  const [code, setCode] = useState(start === 'new' && first && !useStore.getState().fatal ? device.code || newCode() : start && start !== 'resume' ? newCode() : '');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [noted, setNoted] = useState(false);
  const current = device.code;
  const choose = (m: CodeMode | null) => { setMode(m); setStep('edit'); setError(''); setNoted(false); setCode(m === 'new' || m === 'renew' ? newCode() : ''); };

  const title = mode === 'renew' ? 'Renouveler mon code' : mode === 'resume' ? 'Reprendre un compte existant' : mode === 'new' ? (first ? 'Choisir mon code' : 'Repartir de zéro') : 'Changer de code utilisateur';
  const backTo = step === 'confirm' ? () => { setStep('edit'); setNoted(false); } : mode && !first ? () => choose(null) : onClose;
  const back = <button className="btn ghost" type="button" onClick={backTo}>{backTo === onClose ? 'Annuler' : 'Retour'}</button>;
  const s = codeStrength(code);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!mode || busy) return;
    if (step === 'confirm') {
      if (!first && !noted) return;
      const chosen = tidyCode(code);
      if (mode === 'renew') {
        setBusy(true);
        const r = await request('account:renew', { code: chosen });
        setBusy(false);
        if (!r.ok) { setError(r.error); setStep('edit'); return; }
        setDevice({ code: chosen });
        onDone();
        return;
      }
      setDevice({ code: chosen });
      if (mode === 'new' && !first) set({ room: null, roomStatus: 'none' });
      connect();   // the server finds (or makes) the account of this code
      onDone();
      return;
    }
    setError('');
    if (!first && canonicalCode(code) === canonicalCode(current)) { setError('C\'est déjà ton code.'); return; }
    if (mode !== 'resume' && s.level < 2) return;
    if (mode === 'resume' && canonicalCode(code).length < CODE_MIN_LEN) return;
    setBusy(true);
    const r = await checkCode(device.server, code, mode === 'resume');
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    const left = r.value.triesLeft ? ` Encore ${r.value.triesLeft} essai${r.value.triesLeft > 1 ? 's' : ''} avant 5 min d'attente.` : r.value.retryIn ? ` Prochain essai dans ${Math.round(r.value.retryIn / 60000)} min.` : '';
    if (r.value.retired) setError(mode === 'resume' ? `Ce code a été remplacé : tape le nouveau (Profil → Compte sur ton autre appareil).${left}` : 'Ce code est déjà pris : choisis-en un autre.');
    else if (mode === 'resume' && !r.value.exists) setError(`Aucun compte avec ce code sur ce serveur. Recopie-le depuis ton autre appareil (Profil → Compte).${left}`);
    else if (mode !== 'resume' && r.value.exists) setError('Ce code est déjà pris : choisis-en un autre, ou « Reprendre un compte existant » si c\'est le tien.');
    else { setFound(r.value.name); setStep('confirm'); }
  }

  let body: React.ReactNode;
  if (mode === null) {
    body = <><p className="note">Ton code ouvre ton compte : garde ton compte avec un nouveau code, ou passe à un autre compte.</p>
      <div className="code-choices">
        <button className="choice" type="button" onClick={() => choose('renew')}><b>Renouveler mon code</b><small>Même compte, nouveau code : tout est gardé. L'ancien code ne marchera plus, nulle part.</small></button>
        <button className="choice" type="button" onClick={() => choose('resume')}><b>Reprendre un compte existant</b><small>Tu as déjà un code (sur un autre appareil) : tu retrouves ce compte.</small></button>
        <button className="choice" type="button" onClick={() => choose('new')}><b>Repartir de zéro</b><small>Un nouveau code, un compte vide : pseudo, couleur, photos et résultats repartent de rien.</small></button></div>
      <div className="modal-buttons">{back}</div></>;
  } else if (step === 'edit') {
    const ok = mode === 'resume' ? canonicalCode(code).length >= CODE_MIN_LEN : s.level >= 2;
    body = <>
      <label className="field"><span>{mode === 'resume' ? 'Code du compte à reprendre' : 'Ton nouveau code'}</span>
        <input name="codeInput" className="mono" value={code} onChange={e => { setCode(e.target.value); setError(''); }} maxLength={48} autoComplete="off" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX" autoFocus /></label>
      {mode === 'resume' ? <p className="note">{SAMPLE_HINT}</p> : <>
        <Meter s={s} />
        <button className="btn ghost sm" type="button" onClick={() => { setCode(newCode()); setError(''); }}><Icon name="reset" />Tirer un code au hasard</button>
        <p className="note">{mode === 'renew' ? 'Ton compte reste le même ; seul le code qui l\'ouvre change. ' : ''}Garde le code tiré au hasard, ou écris le tien : {CODE_MIN_LEN} lettres ou chiffres au moins, sans suite ni mot connu. Un code simple se devine, et qui le devine prend ton compte.</p></>}
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="modal-buttons">{back}<button className="btn" disabled={!ok || busy}>{busy ? 'Vérification…' : 'Continuer'}</button></div></>;
  } else {
    const renew = mode === 'renew';
    const what = renew ? <><p>Ton compte garde tout : pseudo, couleur, photos, crédit social et palmarès. Seul son code change.</p>
        <p><b>L'ancien code ne marchera plus</b>, sur aucun appareil : tape le nouveau sur tes autres appareils. Note-le :</p></>
      : mode === 'resume' ? <p>Tu reprends le compte <b>{found || 'sans pseudo'}</b> : son pseudo, sa couleur, ses photos et ses résultats remplacent les tiens sur cet appareil.</p>
      : first ? <p>Ton compte sera créé avec le code <code>{tidyCode(code)}</code>. <b>Note-le</b> : sur un autre appareil, il te rend ton compte.</p>
      : <p>Tu crées un <b>compte vide</b> avec le code <code>{tidyCode(code)}</code> : pseudo, couleur, photos, crédit social et palmarès repartent de zéro.</p>;
    const leave = first ? null : renew ? <><div className="code-box is-old"><code className="code-text">{tidyCode(code)}</code></div>
        <label className="check"><input type="checkbox" name="codeNoted" checked={noted} onChange={e => setNoted(e.target.checked)} /> J'ai noté mon nouveau code</label></>
      : <><p>Tu quittes ton compte actuel{account ? ` (${account.name})` : ''}. <b>Note son code</b> si tu veux y revenir un jour : il ne sera plus affiché.</p>
        <div className="code-box is-old"><code className="code-text">{current}</code></div>
        <label className="check"><input type="checkbox" name="codeNoted" checked={noted} onChange={e => setNoted(e.target.checked)} /> J'ai noté mon code actuel</label></>;
    body = <><div className="code-warn"><Icon name="info" /><div>{what}{leave}</div></div>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="modal-buttons">{back}<button className="btn danger-fill" disabled={(!first && !noted) || busy}
        title={!first && !noted ? `Coche d'abord « J'ai noté mon ${renew ? 'nouveau code' : 'code actuel'} »` : undefined}>
        {renew ? 'Renouveler mon code' : mode === 'resume' ? 'Reprendre ce compte' : 'Créer ce compte'}</button></div></>;
  }
  return <><div className="modal-backdrop" onClick={onClose} />
    <form className="modal code-modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={next}><h2>{title}</h2>{body}</form></>;
}
