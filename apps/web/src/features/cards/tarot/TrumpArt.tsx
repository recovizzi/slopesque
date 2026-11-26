// The Tarot's trumps dressed with the room's pictures (openspec: card-games, Habillage des atouts; the maquette's
// app.ts artSettings / trumpFiles): 22 slots (the Excuse, then 1 to 21), a picture each if the host wants; several
// imported at once go by the number in their name (atout-7.png → 7, « excuse » → the Excuse), else to the free slots.
import { useRef, useState } from 'react';
import * as TV from './tarot-view';
import { request, upload } from '../../../app/net';
import { useStore } from '../../../app/store';
import { Icon } from '../../../design';

const SLOTS = Array.from({ length: 22 }, (_, i) => (i + 1) % 22);   // 1 … 21, then the Excuse (0)
const nameOf = (n: number) => (n ? `l'atout ${n}` : 'l\'Excuse');

export function TrumpArt({ edit }: { edit: boolean }) {
  const art = useStore(s => s.room?.cards.art) ?? {};
  const file = useRef<HTMLInputElement>(null), target = useRef<number | 'all'>('all');
  const [busy, setBusy] = useState(''), [note, setNote] = useState('');
  const pick = (to: number | 'all') => { target.current = to; file.current!.multiple = to === 'all'; file.current!.click(); };

  async function put(files: File[]) {
    const to = target.current, taken = new Set(Object.keys(art).map(Number));
    const free = () => SLOTS.find(n => !taken.has(n)) ?? 1;
    setNote('');
    for (const [i, f] of files.entries()) {
      setBusy(`Image ${i + 1} sur ${files.length}…`);
      const m = /excuse/i.test(f.name) ? 0 : Number(/(\d{1,2})/.exec(f.name)?.[1] ?? NaN);
      const n = to !== 'all' ? to : m >= 0 && m <= 21 ? m : free();
      const up = await upload('trump', f);
      if (!up.ok) { setNote(`${f.name} : ${up.error}`); continue; }
      const r = await request('tarot:art', { card: n, mediaId: up.value.id });
      if (!r.ok) { setNote(r.error); break; }
      taken.add(n);
    }
    setBusy('');
  }

  const slots = <div className="trump-grid">{SLOTS.map(n => <div key={n} className="trump-slot">
    {edit ? <button type="button" onClick={() => pick(n)} title={`Image pour ${nameOf(n)}`} dangerouslySetInnerHTML={{ __html: TV.trumpSvg(n, art[String(n)], 'small') }} />
      : <span className="trump-view" title={nameOf(n)} dangerouslySetInnerHTML={{ __html: TV.trumpSvg(n, art[String(n)], 'small') }} />}
    {edit && art[String(n)] && <button type="button" className="art-del" onClick={() => void request('tarot:art', { card: n, mediaId: null })} title="Revenir à l'habillage par défaut" aria-label="Retirer l'image"><Icon name="close" /></button>}
  </div>)}</div>;
  if (!edit) return <div className="field"><span>Habillage des atouts</span>{slots}
    <p className="note">{Object.keys(art).length ? `${Object.keys(art).length} atout${Object.keys(art).length > 1 ? 's' : ''} habillé${Object.keys(art).length > 1 ? 's' : ''} par l'hôte.` : 'L\'habillage par défaut, en emoji.'}</p></div>;
  return <div className="field"><span>Habillage des atouts</span>{slots}
    <div className="row art-actions"><button className="btn ghost sm" type="button" disabled={!!busy} onClick={() => pick('all')}>Importer des images…</button>
      <button className="btn ghost sm" type="button" disabled={!Object.keys(art).length || !!busy} onClick={() => void request('tarot:art-reset')}>Habillage par défaut</button></div>
    {busy && <p className="note">{busy}</p>}{note && <p className="alert" role="alert">{note}</p>}
    <p className="note">Une image par atout, pour tout le salon (facultatif ; sinon l'habillage par défaut, en emoji). Le numéro reste dans un coin blanc. Plusieurs fichiers : d'après le numéro dans leur nom (atout-7.png), sinon dans l'ordre.</p>
    <input ref={file} type="file" accept="image/*" hidden onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) void put(fs); }} /></div>;
}
