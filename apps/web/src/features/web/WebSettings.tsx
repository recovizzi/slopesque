// Partie (the host), Low Tide: the address typed is checked (the page must declare « Low Tide »), then saved for the
// room. The other players read it in app/settings/GameInfo.tsx.
import { useState } from 'react';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Field, Note, TextInput } from '../../design';
import * as I from './integrations';

export function WebSettings() {
  const current = I.urlOf(useStore(s => s.room)!.web);
  const [draft, setDraft] = useState(current),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const verify = async () => {
    const check = I.verify(draft, 'Low Tide'); // first, in the click: the permission to read the site
    setBusy(true);
    setNote(null);
    const v = await check;
    if (v.ok) {
      const r = await request('web:set', { integration: 'lowtide', url: v.url });
      if (!r.ok) {
        setBusy(false);
        return setNote({ ok: false, text: r.error });
      }
    }
    setBusy(false);
    setNote({ ok: v.ok, text: I.verdictText(v, 'Low Tide', draft) });
  };
  return (
    <>
      <Note>{I.INTEGRATIONS.lowtide.help}</Note>
      <Field label="Adresse de Low Tide">
        <TextInput
          name="webUrl"
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            setNote(null);
          }}
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
        />
      </Field>
      <Button disabled={busy} onClick={() => void verify()}>
        {busy ? 'Vérification…' : 'Vérifier et enregistrer'}
      </Button>
      {note && <Note tone={note.ok ? 'ok' : 'alert'}>{note.text}</Note>}
      <Note>
        La page doit se déclarer « Low Tide » (son manifeste ou son titre) : une autre page est refusée. L'extension
        demande d'abord la permission de lire ce site.
      </Note>
      <dl className="info">
        <dt>Adresse actuelle</dt>
        <dd className="web-current">{current}</dd>
      </dl>
    </>
  );
}
