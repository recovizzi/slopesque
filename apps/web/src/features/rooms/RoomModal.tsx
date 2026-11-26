// The windows of my list of rooms: add a key (checked by the server first), create a room (a new key, pending until
// an admin creates it), rename one (the name is mine only), remove some from my list (not from the server).
import { useState, type FormEvent, type ReactNode } from 'react';
import { normalizeKey } from '@slopesque/engines';
import type { SavedRoom } from '@slopesque/shared';
import { join, request } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Field, Modal, ModalButtons, Note, TextInput } from '../../design';
import { KeyBadge } from './KeyBadge';
import { keyToAdd, roomName } from './model';
import { saveRooms } from './save';

export interface RoomModalState {
  kind: 'add' | 'create' | 'rename' | 'delete';
  key: string;
  name: string;
  keys: string[];
}

const TITLES = { add: 'Ajouter un salon', create: 'Créer un salon', rename: 'Renommer le salon' };

export function RoomModal({ m: start, onClose }: { m: RoomModalState; onClose: () => void }) {
  const rooms = useStore(s => s.account?.rooms ?? []),
    server = useStore(s => s.device.server);
  const [m, setM] = useState(start);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (m.kind === 'add') {
      const k = keyToAdd(m.key, rooms);
      if ('error' in k) return setError(k.error);
      setBusy(true);
      const r = await request('room:check', { key: k.key });
      setBusy(false);
      if (!r.ok)
        return setError(`Serveur injoignable : aucune réponse de ${server}. Vérifie l'adresse du serveur (Extension).`);
      if (r.value === 'unknown')
        return setError(
          `Salon inconnu : le serveur ne connaît aucun salon avec la clé ${k.key}. Vérifie-la, ou demande la bonne à un membre du salon.`,
        );
      await saveRooms([...rooms, { key: k.key, name: m.name.trim(), pending: false }]);
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

  const nameField = (placeholder: string) => (
    <Field label="Nom (facultatif)">
      <TextInput
        name="roomName"
        value={m.name}
        onChange={e => setM({ ...m, name: e.target.value })}
        maxLength={40}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={m.kind !== 'add'}
      />
    </Field>
  );
  const buttons = (ok: string, danger = false) => (
    <ModalButtons>
      <Button variant="ghost" onClick={onClose}>
        Annuler
      </Button>
      <Button type="submit" variant={danger ? 'danger-fill' : 'primary'} disabled={busy}>
        {busy ? 'Vérification…' : ok}
      </Button>
    </ModalButtons>
  );
  const err = error && <Note tone="alert">{error}</Note>;

  let title: string, body: ReactNode;
  if (m.kind === 'delete') {
    const list = m.keys.map(k => rooms.find(r => r.key === k)).filter(Boolean) as SavedRoom[];
    title = list.length > 1 ? `Retirer ${list.length} salons de ta liste ?` : 'Retirer ce salon de ta liste ?';
    body = (
      <>
        <ul className="modal-list">
          {list.map(r => (
            <li key={r.key}>
              <b>{roomName(r)}</b> <code>{r.key}</code>
            </li>
          ))}
        </ul>
        <Note>Ils ne sont pas supprimés du serveur : tu pourras les rajouter avec leur clé.</Note>
        {buttons('Retirer', true)}
      </>
    );
  } else {
    title = TITLES[m.kind];
    body =
      m.kind === 'add' ? (
        <>
          <Field label="Clé du salon">
            <TextInput
              mono
              name="roomKey"
              value={m.key}
              onChange={e => setM({ ...m, key: e.target.value })}
              maxLength={9}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </Field>
          {nameField(normalizeKey(m.key) ?? 'La clé, si tu ne mets rien')}
          {err}
          {buttons('Ajouter')}
        </>
      ) : m.kind === 'create' ? (
        <>
          <Field as="div" label="Clé du nouveau salon">
            <KeyBadge k={m.key} big />
          </Field>
          {nameField(m.key)}
          <Note>
            Un salon est créé par un admin : après « Créer », envoie-lui cette clé. En attendant, le salon reste en
            attente dans ta liste.
          </Note>
          {err}
          {buttons('Créer')}
        </>
      ) : (
        <>
          <Note>
            Clé : <code>{m.key}</code>. Le nom n'est que pour toi.
          </Note>
          {nameField(m.key)}
          {err}
          {buttons('Enregistrer')}
        </>
      );
  }
  return (
    <Modal as="form" title={title} onClose={onClose} onSubmit={submit}>
      {body}
    </Modal>
  );
}
