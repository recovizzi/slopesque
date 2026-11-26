// The Sondage's settings (Profil → Partie): the answer time and secret results, set by the host, read only for the
// others.
import { POLL_DURATIONS } from '@slopesque/shared';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Checkbox, Field, Note, Select } from '../../design';
import { fmtDuration } from './model';

const DURATIONS = POLL_DURATIONS.map(v => ({ value: v, label: fmtDuration(v) }));

export function PollSettings() {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const pv = room.poll,
    host = room.hostId === me;
  return (
    <>
      <Field label="Temps de réponse">
        <Select
          value={pv.seconds}
          disabled={!host}
          options={DURATIONS}
          onChange={v => void request('poll:settings', { seconds: Number(v) })}
        />
      </Field>
      <Note>
        Le sondage se ferme à la fin du temps, quand tous les candidats ont répondu, ou quand l'hôte le termine.
      </Note>
      <Checkbox
        label="Résultats secrets"
        checked={pv.secret}
        disabled={!host}
        onChange={secret => void request('poll:settings', { secret })}
      />
      <Note>{pv.secret ? 'Personne ne voit qui a répondu quoi.' : "Survoler un résultat montre qui l'a donné."}</Note>
    </>
  );
}
