// The first launch (openspec: player-account): the code drawn for me, before any room; the server's address; then
// « Continuer avec ce code », or a code I already have, or one I choose.
import { connect } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Card, Icon } from '../../design';
import { ServerField } from '../rooms/ServerField';
import { CodeBox } from './CodeBox';

export function Welcome({ code, onChange }: { code: string; onChange: (mode: 'resume' | 'new') => void }) {
  const setDevice = useStore(s => s.setDevice);
  return (
    <Card className="welcome" title="Bienvenue sur Slopesque">
      <p>
        Voici ton <b>code utilisateur</b>. Il remplace compte et mot de passe : il relie ton pseudo, ta couleur, tes
        photos et tes résultats.
      </p>
      <CodeBox code={code} />
      <ServerField />
      <ul className="welcome-points">
        <li>
          <Icon name="key" />
          <span>
            <b>Note-le</b> : sur un autre appareil, ce code te rend ton compte.
          </span>
        </li>
        <li>
          <Icon name="lock" />
          <span>
            <b>Garde-le pour toi</b> : qui le connaît prend ton compte.
          </span>
        </li>
        <li>
          <Icon name="reset" />
          <span>Tu pourras le changer à tout moment : Profil → Compte.</span>
        </li>
      </ul>
      <Button
        size="big"
        onClick={() => {
          setDevice({ code });
          connect();
        }}
      >
        Continuer avec ce code
      </Button>
      <div className="row welcome-other">
        <Button variant="ghost" onClick={() => onChange('resume')}>
          J'ai déjà un code
        </Button>
        <Button variant="ghost" onClick={() => onChange('new')}>
          Choisir mon code
        </Button>
      </div>
    </Card>
  );
}
