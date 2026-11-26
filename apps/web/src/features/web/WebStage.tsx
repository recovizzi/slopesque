// An integration in the game area (openspec: web-integration): Low Tide framed as it is, its address checked by the
// host (the page declares « Low Tide »), a page that doesn't answer replaced by an explanation (« Réessayer »).
import { useEffect, useState } from 'react';
import * as I from './integrations';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Icon } from '../../design';

const urlOf = (web: Record<string, string>) => web.lowtide ?? I.INTEGRATIONS.lowtide.url;

export function WebStage({ onSettings }: { onSettings: () => void }) {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id;
  const url = urlOf(room.web), host = room.hostId === me, hostName = room.members.find(m => m.id === room.hostId)?.name ?? 'L\'hôte';
  const [state, setState] = useState<'checking' | 'ok' | 'down'>('checking'), [n, setN] = useState(0), [reload, setReload] = useState(0);
  useEffect(() => { setState('checking'); void I.probe(url).then(ok => setState(ok ? 'ok' : 'down')); }, [url, n]);
  const h = new URL(url).host;
  return <div className="web-stage">
    <div className="web-bar"><b>Low Tide</b><span className="web-host" title={url}>{h}</span>
      {h.endsWith('ngrok-free.app') && <span className="note">ngrok : clique « Visit Site » la première fois</span>}
      <span className="spacer" /><button className="icon-btn sm" type="button" onClick={() => setReload(reload + 1)} title="Recharger la page" aria-label="Recharger"><Icon name="reset" /></button>
      <a className="btn ghost sm" href={url} target="_blank" rel="noopener noreferrer">Ouvrir dans un onglet</a></div>
    {state === 'ok' ? <iframe key={reload} className="web-frame" src={url} title="Low Tide" referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals" allow="fullscreen; autoplay; gamepad; clipboard-write" />
      : <div className="web-state">{state === 'checking' ? <div className="room-card"><p className="note">Connexion à Low Tide…</p></div>
        : <div className="room-card offline web-down-card"><h1>Low Tide ne répond pas</h1>
          <p>Aucune réponse de <code>{url}</code>. Le jeu est peut-être arrêté, ou son adresse a changé.</p>
          <p>{host ? 'Revois l\'adresse de Low Tide dans Paramètres → Partie : la nouvelle sera vérifiée avant d\'être enregistrée.' : `${hostName} (l'hôte) doit revoir l'adresse de Low Tide. En attendant, le reste du salon fonctionne.`}</p>
          {host && <button className="btn big" type="button" onClick={onSettings}>Revoir l'adresse</button>}
          <button className={`btn ${host ? 'ghost' : 'big'}`} type="button" onClick={() => setN(n + 1)}><Icon name="reset" />Réessayer</button></div>}</div>}
  </div>;
}

/** Partie (host): the address typed is checked (the page must declare « Low Tide »), then saved for the room. */
export function WebSettings() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)!.id, current = urlOf(room.web);
  const [draft, setDraft] = useState(current), [busy, setBusy] = useState(false), [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  if (room.hostId !== me) return <><p className="note">{I.INTEGRATIONS.lowtide.help}</p><dl className="info"><dt>Adresse actuelle</dt><dd className="web-current">{current}</dd></dl></>;
  const verify = async () => {
    const check = I.verify(draft, 'Low Tide');   // first, in the click: the permission to read the site
    setBusy(true); setNote(null);
    const v = await check;
    if (v.ok) { const r = await request('web:set', { integration: 'lowtide', url: v.url }); if (!r.ok) { setBusy(false); setNote({ ok: false, text: r.error }); return; } }
    setBusy(false);
    setNote({ ok: v.ok, text: I.verdictText(v, 'Low Tide', draft) });
  };
  return <>
    <p className="note">{I.INTEGRATIONS.lowtide.help}</p>
    <label className="field"><span>Adresse de Low Tide</span><input name="webUrl" value={draft} onChange={e => { setDraft(e.target.value); setNote(null); }} spellCheck={false} autoComplete="off" inputMode="url" /></label>
    <button className="btn" type="button" disabled={busy} onClick={() => void verify()}>{busy ? 'Vérification…' : 'Vérifier et enregistrer'}</button>
    {note && <p className={note.ok ? 'note ok-note' : 'alert'} role="status">{note.text}</p>}
    <p className="note">La page doit se déclarer « Low Tide » (son manifeste ou son titre) : une autre page est refusée. L'extension demande d'abord la permission de lire ce site.</p>
    <dl className="info"><dt>Adresse actuelle</dt><dd className="web-current">{current}</dd></dl></>;
}
