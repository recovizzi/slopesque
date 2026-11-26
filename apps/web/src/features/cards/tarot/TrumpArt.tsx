// The Tarot's trumps dressed with the room's pictures (openspec: card-games, Habillage des atouts; the maquette's
// app.ts artSettings / trumpFiles): 22 slots (the Excuse, then 1 to 21), a picture each if the host wants; several
// imported at once go by the number in their name (atout-7.png → 7, « excuse » → the Excuse), else to the free slots.
import { useRef, useState } from 'react';
import { request, upload } from '../../../app/net';
import { useStore } from '../../../app/store';
import { Button, Field, Icon, Note } from '../../../design';
import { TrumpCard } from './TarotCard';

const SLOTS = Array.from({ length: 22 }, (_, i) => (i + 1) % 22); // 1 … 21, then the Excuse (0)
const nameOf = (n: number) => (n ? `l'atout ${n}` : "l'Excuse");
const NO_ART: Record<string, string> = {};

export function TrumpArt({ edit }: { edit: boolean }) {
  const art = useStore(s => s.room?.cards.art) ?? NO_ART;
  const file = useRef<HTMLInputElement>(null),
    target = useRef<number | 'all'>('all');
  const [busy, setBusy] = useState(''),
    [note, setNote] = useState('');
  const dressed = Object.keys(art).length;
  const pick = (to: number | 'all') => {
    target.current = to;
    file.current!.multiple = to === 'all';
    file.current!.click();
  };

  async function put(files: File[]) {
    const to = target.current,
      taken = new Set(Object.keys(art).map(Number));
    const free = () => SLOTS.find(n => !taken.has(n)) ?? 1;
    setNote('');
    for (const [i, f] of files.entries()) {
      setBusy(`Image ${i + 1} sur ${files.length}…`);
      const m = /excuse/i.test(f.name) ? 0 : Number(/(\d{1,2})/.exec(f.name)?.[1] ?? NaN);
      const n = to !== 'all' ? to : m >= 0 && m <= 21 ? m : free();
      const up = await upload('trump', f);
      if (!up.ok) {
        setNote(`${f.name} : ${up.error}`);
        continue;
      }
      const r = await request('tarot:art', { card: n, mediaId: up.value.id });
      if (!r.ok) {
        setNote(r.error);
        break;
      }
      taken.add(n);
    }
    setBusy('');
  }

  const slots = (
    <div className="trump-grid">
      {SLOTS.map(n => (
        <div key={n} className="trump-slot">
          {edit ? (
            <button type="button" onClick={() => pick(n)} title={`Image pour ${nameOf(n)}`}>
              <TrumpCard n={n} art={art[String(n)]} className="small" />
            </button>
          ) : (
            <span className="trump-view" title={nameOf(n)}>
              <TrumpCard n={n} art={art[String(n)]} className="small" />
            </span>
          )}
          {edit && art[String(n)] && (
            <button
              type="button"
              className="art-del"
              onClick={() => void request('tarot:art', { card: n, mediaId: null })}
              title="Revenir à l'habillage par défaut"
              aria-label="Retirer l'image"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
  if (!edit)
    return (
      <Field as="div" label="Habillage des atouts">
        {slots}
        <Note>
          {dressed
            ? `${dressed} atout${dressed > 1 ? 's' : ''} habillé${dressed > 1 ? 's' : ''} par l'hôte.`
            : "L'habillage par défaut, en emoji."}
        </Note>
      </Field>
    );
  return (
    <Field as="div" label="Habillage des atouts">
      {slots}
      <div className="row art-actions">
        <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => pick('all')}>
          Importer des images…
        </Button>
        <Button variant="ghost" size="sm" disabled={!dressed || !!busy} onClick={() => void request('tarot:art-reset')}>
          Habillage par défaut
        </Button>
      </div>
      {busy && <Note>{busy}</Note>}
      {note && <Note tone="alert">{note}</Note>}
      <Note>
        Une image par atout, pour tout le salon (facultatif ; sinon l'habillage par défaut, en emoji). Le numéro reste
        dans un coin blanc. Plusieurs fichiers : d'après le numéro dans leur nom (atout-7.png), sinon dans l'ordre.
      </Note>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const fs = [...(e.target.files ?? [])];
          e.target.value = '';
          if (fs.length) void put(fs);
        }}
      />
    </Field>
  );
}
