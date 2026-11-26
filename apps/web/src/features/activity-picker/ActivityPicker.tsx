// The /activity window (openspec: chat-activity, Commandes du chat): every kind of activity with a small picture, then
// (where there is one) its exact format. The host launches it at once; another player proposes it to a vote. An
// activity the V1 can't play yet is shown greyed (« bientôt »).
import type { ActivityChoice } from '@slopesque/shared';
import { Button, cls, Icon, Modal, Note } from '../../design';
import { ActivityArt } from './ActivityArt';
import { howText, kindOf, kindOff, KINDS, ready, type Kind } from './kinds';

export interface ActivityPickerProps {
  /** The kind whose formats are shown, or null: every kind. */
  kind: string | null;
  current: string;
  host: boolean;
  /** A vote is already running in the chat. */
  busy: boolean;
  onKind: (k: string | null) => void;
  onPick: (c: ActivityChoice) => void;
  onClose: () => void;
}

export function ActivityPicker({ kind, current, host, busy, onKind, onPick, onClose }: ActivityPickerProps) {
  const k = KINDS.find(x => x.id === kind);
  return (
    <Modal title="Changer d'activité" className="act-picker" closeButton onClose={onClose}>
      <Note className={cls('act-how', !host && busy && 'is-busy')}>
        {!host && <Icon name="vote" />}
        {howText(host, busy)}
      </Note>
      {k?.formats ? (
        <Formats k={k} locked={!host && busy} onBack={() => onKind(null)} onPick={onPick} />
      ) : (
        <ul className="act-grid">
          {KINDS.map(x => {
            const off = kindOff(x),
              on = kindOf(current) === x.id;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  className={cls('act-tile', on && 'is-current')}
                  disabled={(!host && busy) || (!!x.choice && off)}
                  onClick={() => (x.formats ? onKind(x.id) : onPick(x.choice!))}
                >
                  <ActivityArt kind={x.id} />
                  <b>{x.name}</b>
                  <small>{off ? 'Bientôt dans la V1' : x.help}</small>
                  {on && <span className="act-now">en cours</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** A kind's formats (the Demi-disque's modes, the card games…), and the way back to every kind. */
function Formats({
  k,
  locked,
  onBack,
  onPick,
}: {
  k: Kind;
  locked: boolean;
  onBack: () => void;
  onPick: (c: ActivityChoice) => void;
}) {
  return (
    <>
      <Button variant="ghost" size="sm" className="act-back" onClick={onBack}>
        ← Toutes les activités
      </Button>
      <div className="act-kind-head">
        <ActivityArt kind={k.id} />
        <div>
          <b>{k.name}</b>
          <small>
            {k.id === 'cards' ? 'Choisis le jeu ; le nombre de joueurs se règle dans Partie' : 'Choisis le format'}
          </small>
        </div>
      </div>
      <ul className="act-formats">
        {k.formats!.map(f => {
          const off = f.soon || !ready(f.choice);
          return (
            <li key={f.label}>
              <button type="button" className="act-format" disabled={off || locked} onClick={() => onPick(f.choice)}>
                <b>{f.label}</b>
                <small>{off && !f.soon ? 'Bientôt dans la V1' : f.help}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
