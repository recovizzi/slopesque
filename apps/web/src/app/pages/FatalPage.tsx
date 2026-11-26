// The server refused my code (unknown, replaced), too many tries, or this version of the extension: its page instead
// of the room, and the way out.
import { connect } from '../net';
import { useStore } from '../store';
import { EXT_VERSION } from '../version';
import { Button, Card, LinkButton, Note } from '../../design';
import type { CodeMode } from '../../features/account/model';

const RELEASES = 'https://github.com/recovizzi/slopesque/releases/latest';

export function FatalPage({ onCode }: { onCode: (m: CodeMode) => void }) {
  const fatal = useStore(s => s.fatal),
    versions = useStore(s => s.versions);
  if (fatal === 'protocol' || fatal === 'outdated')
    // blocking: this extension is older than the server accepts
    return (
      <Card tone="offline" className="outdated" title="Mets l'extension à jour">
        <p>
          Cette version de l'extension ({EXT_VERSION}) n'est plus prise en charge par le serveur
          {versions ? ` : il demande la ${versions.minExtension} ou plus récente` : ''}.
        </p>
        <LinkButton size="big" href={versions?.download ?? RELEASES} external>
          Télécharger la dernière version
        </LinkButton>
        <Note>
          Puis recharge l'extension (↻ dans la page des extensions du navigateur). Ton compte et tes salons sont gardés
          sur le serveur.
        </Note>
      </Card>
    );
  if (fatal === 'limited')
    return (
      <Card tone="offline" title="Trop d'essais">
        <p>Le serveur a reçu trop de codes inconnus depuis ta connexion. Réessaie dans une minute.</p>
        <Button size="big" icon="reset" onClick={() => connect()}>
          Réessayer
        </Button>
      </Card>
    );
  const code = fatal === 'code';
  return (
    <Card tone="unknown" title={code ? 'Code invalide' : 'Ce code a été remplacé'}>
      <p>
        {code
          ? "Ce code utilisateur n'est pas valable."
          : 'Ton code a été renouvelé sur un autre appareil (ou par un admin) : tape le nouveau (Profil → Compte sur ton autre appareil).'}
      </p>
      <Button size="big" onClick={() => onCode('resume')}>
        J'ai le nouveau code
      </Button>
      <Button variant="ghost" onClick={() => onCode('new')}>
        Repartir de zéro
      </Button>
    </Card>
  );
}
