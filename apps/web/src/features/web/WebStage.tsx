// An integration in the game area (openspec: web-integration): Low Tide framed as it is, after a check that its page
// answers; a page that doesn't answer is replaced by an explanation (« Réessayer », the host's « Revoir l'adresse »).
import { useEffect, useState } from 'react';
import { useStore } from '../../app/store';
import { Button, Card, IconButton, LinkButton, Note } from '../../design';
import * as I from './integrations';

export function WebStage({ onSettings }: { onSettings: () => void }) {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const url = I.urlOf(room.web),
    host = room.hostId === me,
    hostName = room.members.find(m => m.id === room.hostId)?.name ?? "L'hôte";
  const [state, setState] = useState<'checking' | 'ok' | 'down'>('checking'),
    [tries, setTries] = useState(0),
    [reload, setReload] = useState(0);
  useEffect(() => {
    setState('checking');
    void I.probe(url).then(ok => setState(ok ? 'ok' : 'down'));
  }, [url, tries]);
  const h = new URL(url).host;
  return (
    <div className="web-stage">
      <div className="web-bar">
        <b>Low Tide</b>
        <span className="web-host" title={url}>
          {h}
        </span>
        {h.endsWith('ngrok-free.app') && <Note as="span">ngrok : clique « Visit Site » la première fois</Note>}
        <span className="spacer" />
        <IconButton
          icon="reset"
          size="sm"
          label="Recharger"
          title="Recharger la page"
          onClick={() => setReload(reload + 1)}
        />
        <LinkButton variant="ghost" size="sm" href={url} external>
          Ouvrir dans un onglet
        </LinkButton>
      </div>
      {state === 'ok' ? (
        <iframe
          key={reload}
          className="web-frame"
          src={url}
          title="Low Tide"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals"
          allow="fullscreen; autoplay; gamepad; clipboard-write"
        />
      ) : (
        <div className="web-state">
          {state === 'checking' ? (
            <Card>
              <Note>Connexion à Low Tide…</Note>
            </Card>
          ) : (
            <Card tone="offline" className="web-down-card" title="Low Tide ne répond pas">
              <p>
                Aucune réponse de <code>{url}</code>. Le jeu est peut-être arrêté, ou son adresse a changé.
              </p>
              <p>
                {host
                  ? "Revois l'adresse de Low Tide dans Paramètres → Partie : la nouvelle sera vérifiée avant d'être enregistrée."
                  : `${hostName} (l'hôte) doit revoir l'adresse de Low Tide. En attendant, le reste du salon fonctionne.`}
              </p>
              {host && (
                <Button size="big" onClick={onSettings}>
                  Revoir l'adresse
                </Button>
              )}
              <Button
                variant={host ? 'ghost' : 'primary'}
                size={host ? 'md' : 'big'}
                icon="reset"
                onClick={() => setTries(tries + 1)}
              >
                Réessayer
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
