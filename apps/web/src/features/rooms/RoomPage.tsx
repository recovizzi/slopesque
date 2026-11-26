// The page of a room that can't be entered, instead of the room: connecting, no room chosen, pending (an admin must
// create it), unknown key, server down. « Réessayer » asks again and says when nothing changed.
import { useState } from 'react';
import type { RoomStatus } from '../../app/store';
import { join } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Card, Note } from '../../design';
import { KeyBadge } from './KeyBadge';
import { blockedText, retryNote, roomName } from './model';
import { saveRooms } from './save';

export function RoomPage({ status, onList }: { status: Exclude<RoomStatus, 'ok'>; onList: () => void }) {
  const key = useStore(s => s.device.roomKey),
    server = useStore(s => s.device.server);
  const saved = useStore(s => s.account?.rooms.find(r => r.key === key));
  const [note, setNote] = useState('');
  if (status === 'loading')
    return (
      <Card>
        <Note>Connexion au salon {saved ? roomName(saved) : key}…</Note>
      </Card>
    );
  if (status === 'none')
    return (
      <Card title="Aucun salon">
        <p>Ajoute la clé d'un salon (demande-la à un membre), ou crée un salon : un admin le créera avec sa clé.</p>
        <Button size="big" onClick={onList}>
          Choisir un salon
        </Button>
      </Card>
    );
  const [title, text] = blockedText(status, server);
  const retry = async () => {
    await join(key, true);
    const now = useStore.getState().roomStatus;
    setNote(retryNote(status, now));
    if (now === 'ok' && saved?.pending)
      void saveRooms(
        (useStore.getState().account?.rooms ?? []).map(r => (r.key === key ? { ...r, pending: false } : r)),
      );
  };
  return (
    <Card tone={status} title={title}>
      <p className="room-name">{saved ? roomName(saved) : key}</p>
      <p>{text}</p>
      {status !== 'offline' && <KeyBadge k={key} big />}
      <Button size="big" icon="reset" onClick={retry}>
        Réessayer
      </Button>
      {note && <Note className="room-note">{note}</Note>}
      <Button variant="ghost" onClick={onList}>
        Choisir un autre salon
      </Button>
    </Card>
  );
}
