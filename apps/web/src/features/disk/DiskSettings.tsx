// Partie (the host): the Demi-disque's topic and ends, its voting mode, its answer time. A change made during a round
// waits for its end (the server says so: « pending »). The other players read them in app/settings/GameInfo.tsx.
import { useState } from 'react';
import { COLS, ROUND_SECONDS } from '@slopesque/engines';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Field, Note, Select, TextInput } from '../../design';

export function DiskSettings() {
  const d = useStore(s => s.room)!.disk,
    r = { ...d.rules, ...d.pending };
  const [form, setForm] = useState({ topic: r.topic, left: r.left, right: r.right });
  const [note, setNote] = useState('');
  const save = async (changes: object) => {
    const x = await request('disk:rules', changes);
    setNote(!x.ok ? x.error : x.value === 'pending' ? 'Appliqué à la fin du placement en cours.' : '');
  };
  const text = (k: keyof typeof form, max: number) => ({
    name: k,
    value: form[k],
    maxLength: max,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  });
  return (
    <>
      <form
        onSubmit={e => {
          e.preventDefault();
          void save(form);
        }}
      >
        <Field label="Sujet">
          <TextInput {...text('topic', 60)} />
        </Field>
        <div className="row">
          <Field label="Extrémité gauche">
            <TextInput {...text('left', 40)} />
          </Field>
          <Field label="Extrémité droite">
            <TextInput {...text('right', 40)} />
          </Field>
        </div>
        <Button type="submit">Enregistrer</Button>
      </form>
      <Field label="Mode de scrutin">
        <Select
          value={r.mode}
          onChange={mode => void save({ mode })}
          options={[
            { value: 'ray', label: 'Rayon libre' },
            { value: 'amphi', label: 'Amphithéâtre' },
          ]}
        />
      </Field>
      <Note>
        {r.mode === 'amphi'
          ? `L'hôte choisit une colonne de sièges (${COLS}), chaque candidat un siège libre ; perfect dans la colonne, sinon des points selon l'écart.`
          : "Chacun place un rayon où il veut ; points selon l'angle qui le sépare de celui de l'hôte."}
      </Note>
      <Field label="Temps de réponse">
        <Select
          value={r.roundSeconds}
          onChange={v => void save({ roundSeconds: Number(v) })}
          options={ROUND_SECONDS.map(v => ({ value: v, label: `${v} secondes` }))}
        />
      </Field>
      {note && <Note tone="pending">{note}</Note>}
    </>
  );
}
