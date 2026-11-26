// The server's address, where a player needs it before anything else (the first launch, a server that doesn't answer):
// typed, checked (GET /api/health), kept on the device. The Extension tab has the same field.
import { useState } from 'react';
import { useStore } from '../../app/store';
import { Button, Field, TextInput } from '../../design';
import { DEFAULT_SERVER } from '../../lib/device';

export async function ping(server: string) {
  try {
    const r = await fetch(`${server.replace(/\/+$/, '')}/api/health`, { signal: AbortSignal.timeout(4000) });
    return r.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export function ServerField({ onSaved }: { onSaved?: () => void }) {
  const device = useStore(s => s.device),
    setDevice = useStore(s => s.setDevice);
  const [v, setV] = useState(device.server || DEFAULT_SERVER),
    [state, setState] = useState<'' | 'checking' | 'ok' | 'down'>('');
  const save = async () => {
    const server = v.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/.test(server)) return setState('down');
    setDevice({ server });
    setState('checking');
    const r = await ping(server);
    setState(r);
    if (r === 'ok') onSaved?.();
  };
  return (
    <Field
      as="div"
      className="server-field"
      label="Serveur"
      error={state === 'down' && `Aucune réponse de ${v.trim()} : vérifie l'adresse (et le port).`}
      help={
        state === 'ok'
          ? 'Serveur joignable ✓'
          : "L'adresse du serveur de ton groupe (demande-la à celui qui l'héberge)."
      }
    >
      <form
        className="row"
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <TextInput
          name="server"
          value={v}
          onChange={e => {
            setV(e.target.value);
            setState('');
          }}
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
          placeholder="http://localhost:23100"
        />
        <Button type="submit" variant="ghost" size="sm" disabled={state === 'checking'}>
          {state === 'checking' ? 'Vérification…' : 'Vérifier'}
        </Button>
      </form>
    </Field>
  );
}
