// Under the Sondage, the actions of my role in each phase: the host publishes, ends, then starts the next poll; a
// candidate validates an answer; a spectator may join while it is open. Who answered already, while it is open.
import { hueColor } from '@slopesque/engines';
import type { MemberView, PollView } from '@slopesque/shared';
import { request } from '../../app/net';
import { Button, Chip, Who } from '../../design';
import { fmtDuration } from './model';

export type Role = 'host' | 'candidate' | 'spectator';

export interface PollActionsProps {
  pv: PollView;
  role: Role;
  host: MemberView | undefined;
  /** The candidates (playing, not the host). */
  players: MemberView[];
  canPublish: boolean;
  canValidate: boolean;
  onPublish: () => void;
  onValidate: () => void;
  onNext: () => void;
}

export function PollActions({ pv, role, host, players, canPublish, canValidate, ...on }: PollActionsProps) {
  const join = (
    <Button size="big" onClick={() => void request('disk:join')}>
      Participer
    </Button>
  );
  const chips = (
    <ul className="chips">
      {players.map(p => (
        <Chip key={p.id} color={hueColor(p.hue)} done={pv.answered.includes(p.id)}>
          {p.name}
        </Chip>
      ))}
    </ul>
  );

  if (pv.phase === 'writing')
    return role === 'host' ? (
      <div className="actions">
        <Button size="big" disabled={!canPublish} onClick={on.onPublish}>
          Publier le sondage
        </Button>
        <p className="hint">{`Ouvert ${fmtDuration(pv.seconds)}, ou jusqu'à ce que tous les candidats aient répondu.`}</p>
      </div>
    ) : (
      <div className="actions">
        <p className="hint">
          {host ? (
            <>
              <Who name={host.name} hue={host.hue} /> prépare un sondage…
            </>
          ) : (
            "En attente de l'hôte…"
          )}
        </p>
        {role === 'spectator' && join}
      </div>
    );

  if (pv.phase === 'open')
    return role === 'spectator' ? (
      <div className="actions">
        {join}
        <p className="hint">Rejoins pour répondre : il est encore temps.</p>
        {chips}
      </div>
    ) : (
      <div className="actions">
        <div className="row">
          {pv.mine === null && (
            <Button size="big" disabled={!canValidate} onClick={on.onValidate}>
              Valider ma réponse
            </Button>
          )}
          {role === 'host' && (
            <Button variant="ghost" size="big" onClick={() => void request('poll:end')}>
              Terminer le sondage
            </Button>
          )}
        </div>
        <p className="hint">
          {pv.mine !== null
            ? `Réponse envoyée.${role === 'host' ? '' : ' En attente des autres…'}`
            : role === 'host'
              ? 'Tu peux répondre aussi : ta réponse départage une égalité pour la première place.'
              : 'Choisis ta réponse, puis valide.'}
        </p>
        {chips}
      </div>
    );

  return (
    <div className="actions">
      {role === 'host' ? (
        <Button size="big" onClick={on.onNext}>
          Nouveau sondage
        </Button>
      ) : (
        <p className="hint">{`${host?.name ?? "L'hôte"} prépare le prochain sondage…`}</p>
      )}
    </div>
  );
}
