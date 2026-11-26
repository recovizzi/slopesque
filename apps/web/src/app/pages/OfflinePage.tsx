// No answer from the server before any account: its address to check (or change), and « Réessayer ».
import { connect } from '../net';
import { useStore } from '../store';
import { Button, Card } from '../../design';
import { ServerField } from '../../features/rooms/ServerField';

export function OfflinePage() {
  const server = useStore(s => s.device.server);
  return (
    <Card tone="offline" title="Serveur injoignable">
      <p>Aucune réponse de {server}. Vérifie l'adresse du serveur, ou ta connexion.</p>
      <ServerField onSaved={() => connect()} />
      <Button size="big" icon="reset" onClick={() => connect()}>
        Réessayer
      </Button>
    </Card>
  );
}
