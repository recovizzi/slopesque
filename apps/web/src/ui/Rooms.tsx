// Rooms (openspec: game-session): my list (saved with my account), the dialogs (add, create, rename, remove), the
// page of a room that can't be entered (pending, unknown, server down).
import { useState } from 'react';
import { newKey, normalizeKey } from '@slopesque/engines';
import type { SavedRoom } from '@slopesque/shared';
import { join, request } from '../net';
import { useStore, type RoomStatus } from '../store';
import { copyText, Icon, useEscape } from './common';

export const roomName = (r: SavedRoom) => r.name.trim() || r.key;

export async function saveRooms(rooms: SavedRoom[]) {
  const st = useStore.getState();
  if (st.account) st.set({ account: { ...st.account, rooms } });
  await request('rooms:save', { rooms });
}

export function KeyBadge({ k, big }: { k: string; big?: boolean }) {
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const copy = async () => { setCopied((await copyText(k)) ? 'ok' : 'fail'); setTimeout(() => setCopied(''), 1600); };
  return <button className={`key-badge ${big ? 'big' : ''} ${copied ? `is-${copied}` : ''}`} type="button" onClick={copy}
    title="Clé du salon : cliquer pour la copier" aria-label={`Copier la clé du salon ${k}`}><Icon name="key" /><span>{copied === 'ok' ? 'Copiée ✓' : copied === 'fail' ? 'Copie impossible' : k}</span></button>;
}

type ModalKind = 'add' | 'create' | 'rename' | 'delete';
interface Modal { kind: ModalKind; key: string; name: string; keys: string[] }

/** Profil… → Extension: my rooms, the current one marked; join, add, create, select to rename or remove. */
export function RoomList() {
  const rooms = useStore(s => s.account?.rooms ?? []);
  const current = useStore(s => s.device.roomKey), status = useStore(s => s.roomStatus);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal | null>(null);
  const n = selected.size;
  const toggle = (k: string, on: boolean) => { const s = new Set(selected); if (on) s.add(k); else s.delete(k); setSelected(s); };
  return <div className="rooms">
    <div className="rooms-head"><span>Salons</span><span className="row">
      <button className="btn ghost sm" type="button" onClick={() => setModal({ kind: 'add', key: '', name: '', keys: [] })}>+ Ajouter</button>
      <button className="btn ghost sm" type="button" onClick={() => { let k = newKey(); while (rooms.some(r => r.key === k)) k = newKey(); setModal({ kind: 'create', key: k, name: '', keys: [] }); }}>Créer</button></span></div>
    {rooms.length ? <ul className="room-list">{rooms.map(r => <li key={r.key} className={`room-row ${r.key === current ? 'is-current' : ''}`}>
      <input type="checkbox" checked={selected.has(r.key)} onChange={e => toggle(r.key, e.target.checked)} aria-label={`Sélectionner ${roomName(r)}`} />
      <div className="room-main"><b title={roomName(r)}>{roomName(r)}</b><code>{r.key}</code></div>
      {r.key === current ? <><span className="tag">Actuel</span>{status !== 'ok' && <button className="btn sm" type="button" onClick={() => void join(r.key)}>Réessayer</button>}</>
        : <>{r.pending && <span className="tag wait">En attente</span>}<button className="btn sm" type="button" onClick={() => void join(r.key)}>Rejoindre</button></>}
    </li>)}</ul> : <p className="note">Aucun salon : ajoute une clé, ou crée un salon.</p>}
    {n ? <div className="room-actions"><span>{n} sélectionné{n > 1 ? 's' : ''}</span>
      <button className="btn ghost sm" type="button" disabled={n !== 1} title={n === 1 ? undefined : 'Un seul salon à la fois'}
        onClick={() => { const r = rooms.find(x => selected.has(x.key))!; setModal({ kind: 'rename', key: r.key, name: r.name, keys: [] }); }}>Renommer</button>
      <button className="btn ghost sm danger-text" type="button" onClick={() => setModal({ kind: 'delete', key: '', name: '', keys: [...selected] })}>Retirer</button></div>
      : <p className="note">Coche des salons pour en renommer un ou les retirer de ta liste.</p>}
    {modal && <RoomModal m={modal} onClose={() => { setModal(null); setSelected(new Set()); }} />}
  </div>;
}

function RoomModal({ m: start, onClose }: { m: Modal; onClose: () => void }) {
  useEscape(onClose);
  const rooms = useStore(s => s.account?.rooms ?? []), server = useStore(s => s.device.server);
  const [m, setM] = useState(start);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameField = (ph: string) => <label className="field"><span>Nom (facultatif)</span>
    <input name="roomName" value={m.name} onChange={e => setM({ ...m, name: e.target.value })} maxLength={40} placeholder={ph} autoComplete="off" autoFocus={m.kind !== 'add'} /></label>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (m.kind === 'add') {
      const key = normalizeKey(m.key), known = key ? rooms.find(r => r.key === key) : undefined;
      if (!key) return setError('Une clé a la forme XXXX-XXXX : lettres et chiffres, sans I, L, O, 0 ni 1.');
      if (known) return setError(`Déjà dans ta liste : ${roomName(known)}.`);
      setBusy(true);
      const r = await request('room:check', { key });
      setBusy(false);
      if (!r.ok) return setError(`Serveur injoignable : aucune réponse de ${server}. Vérifie l'adresse du serveur (Extension).`);
      if (r.value === 'unknown') return setError(`Salon inconnu : le serveur ne connaît aucun salon avec la clé ${key}. Vérifie-la, ou demande la bonne à un membre du salon.`);
      await saveRooms([...rooms, { key, name: m.name.trim(), pending: false }]);
    } else if (m.kind === 'create') {
      await saveRooms([...rooms, { key: m.key, name: m.name.trim(), pending: true }]);
      void join(m.key);
    } else if (m.kind === 'rename') {
      await saveRooms(rooms.map(r => (r.key === m.key ? { ...r, name: m.name.trim() } : r)));
    } else {
      await saveRooms(rooms.filter(r => !m.keys.includes(r.key)));
    }
    onClose();
  }
  const buttons = (ok: string, danger = false) => <div className="modal-buttons"><button className="btn ghost" type="button" onClick={onClose}>Annuler</button>
    <button className={`btn ${danger ? 'danger-fill' : ''}`} disabled={busy}>{busy ? 'Vérification…' : ok}</button></div>;
  const err = error && <p className="alert" role="alert">{error}</p>;
  let title: string, body: React.ReactNode;
  if (m.kind === 'add') {
    title = 'Ajouter un salon';
    body = <><label className="field"><span>Clé du salon</span><input name="roomKey" value={m.key} onChange={e => setM({ ...m, key: e.target.value })} maxLength={9} placeholder="XXXX-XXXX" autoComplete="off" spellCheck={false} className="mono" autoFocus /></label>
      {nameField(normalizeKey(m.key) ?? 'La clé, si tu ne mets rien')}{err}{buttons('Ajouter')}</>;
  } else if (m.kind === 'create') {
    title = 'Créer un salon';
    body = <><div className="field"><span>Clé du nouveau salon</span><KeyBadge k={m.key} big /></div>{nameField(m.key)}
      <p className="note">Un salon est créé par un admin : après « Créer », envoie-lui cette clé. En attendant, le salon reste en attente dans ta liste.</p>{err}{buttons('Créer')}</>;
  } else if (m.kind === 'rename') {
    title = 'Renommer le salon';
    body = <><p className="note">Clé : <code>{m.key}</code>. Le nom n'est que pour toi.</p>{nameField(m.key)}{err}{buttons('Enregistrer')}</>;
  } else {
    const list = m.keys.map(k => rooms.find(r => r.key === k)).filter(Boolean) as SavedRoom[];
    title = list.length > 1 ? `Retirer ${list.length} salons de ta liste ?` : 'Retirer ce salon de ta liste ?';
    body = <><ul className="modal-list">{list.map(r => <li key={r.key}><b>{roomName(r)}</b> <code>{r.key}</code></li>)}</ul>
      <p className="note">Ils ne sont pas supprimés du serveur : tu pourras les rajouter avec leur clé.</p>{buttons('Retirer', true)}</>;
  }
  return <><div className="modal-backdrop" onClick={onClose} />
    <form className="modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}><h2>{title}</h2>{body}</form></>;
}

/** The page of a room that can't be entered, instead of the room. */
export function RoomPage({ status, onList }: { status: Exclude<RoomStatus, 'ok'>; onList: () => void }) {
  const key = useStore(s => s.device.roomKey), server = useStore(s => s.device.server);
  const saved = useStore(s => s.account?.rooms.find(r => r.key === key));
  const [note, setNote] = useState('');
  if (status === 'loading') return <div className="room-card"><p className="note">Connexion au salon {saved ? roomName(saved) : key}…</p></div>;
  if (status === 'none') return <div className="room-card"><h1>Aucun salon</h1><p>Ajoute la clé d'un salon (demande-la à un membre), ou crée un salon : un admin le créera avec sa clé.</p>
    <button className="btn big" type="button" onClick={onList}>Choisir un salon</button></div>;
  const text = {
    pending: ['Salon en attente de création', 'Ce salon n\'existe pas encore sur le serveur. Contacte un admin pour qu\'il le crée avec cette clé :'],
    unknown: ['Salon inconnu', 'Le serveur ne connaît aucun salon avec cette clé. Vérifie-la, ou demande la bonne à un membre du salon :'],
    offline: ['Serveur injoignable', `Aucune réponse de ${server}. Vérifie l'adresse du serveur dans Paramètres → Extension, ou ta connexion.`],
  }[status];
  const retry = async () => {
    await join(key, true);
    const now = useStore.getState().roomStatus;
    setNote(now === status ? (status === 'pending' ? 'Toujours pas créé : un admin doit encore créer ce salon avec sa clé.' : 'Toujours la même réponse.') : '');
    if (now === 'ok' && saved?.pending) void saveRooms((useStore.getState().account?.rooms ?? []).map(r => (r.key === key ? { ...r, pending: false } : r)));
  };
  return <div className={`room-card ${status}`}><h1>{text[0]}</h1><p className="room-name">{saved ? roomName(saved) : key}</p><p>{text[1]}</p>
    {status !== 'offline' && <KeyBadge k={key} big />}
    <button className="btn big" type="button" onClick={retry}><Icon name="reset" />Réessayer</button>
    {note && <p className="note room-note">{note}</p>}
    <button className="btn ghost" type="button" onClick={onList}>Choisir un autre salon</button></div>;
}
