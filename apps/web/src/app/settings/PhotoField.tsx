// Profil: my photo in this room (or my letter), a small ✕ to remove it, a button to choose one (cut square by the
// server; the old one deleted).
import { useRef, useState } from 'react';
import { request, upload } from '../net';
import { useStore } from '../store';
import { Avatar, Button, Field, Icon } from '../../design';

export function PhotoField() {
  const account = useStore(s => s.account),
    room = useStore(s => s.room);
  const [note, setNote] = useState(''),
    [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const me = room?.members.find(m => m.id === account?.id);
  if (!me) return null;
  const choose = async (f: File) => {
    setBusy(true);
    const up = await upload('photo', f);
    const r = up.ok ? await request('photo:set', { mediaId: up.value.id }) : up;
    setBusy(false);
    setNote(r.ok ? '' : r.error);
  };
  return (
    <Field
      as="div"
      label={
        <>
          Photo de profil <small>dans ce salon</small>
        </>
      }
      help={
        note ? (
          <b>{note}</b>
        ) : (
          "Propre à ce salon : chaque salon a la sienne. Coupée en carré, au milieu de l'image ; l'ancienne est supprimée."
        )
      }
    >
      <div className="photo-row">
        <span className="photo-wrap">
          <Avatar name={me.name} hue={me.hue} photo={me.photo} size="lg" />
          {me.photo && (
            <button
              className="photo-del"
              type="button"
              onClick={() => void request('photo:set', { mediaId: null })}
              title="Retirer la photo : ta lettre sur ta couleur revient"
              aria-label="Retirer la photo"
            >
              <Icon name="close" />
            </button>
          )}
        </span>
        <Button variant="ghost" size="sm" icon="camera" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? 'Envoi…' : me.photo ? 'Changer de photo' : 'Ajouter une photo'}
        </Button>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void choose(f);
        }}
      />
    </Field>
  );
}
