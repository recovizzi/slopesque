// Partie: the activity first (the host changes it, the others read it: GameInfo.tsx), then its settings — each
// activity's own — and the reset of its ranking.
import { READY_ACTIVITIES, SCORE_NAMES, scoreKey, type ActivityChoice } from '@slopesque/shared';
import { request } from '../net';
import { useStore } from '../store';
import { CardsSettings } from './CardsSettings';
import { GameInfo } from './GameInfo';
import { ACT_HELP, ACT_NAMES, SETTINGS_TITLES } from './texts';
import { Button, Field, Note, Select } from '../../design';
import { DiskSettings } from '../../features/disk/DiskSettings';
import { PollSettings } from '../../features/poll/PollWheel';
import { WebSettings } from '../../features/web/WebSettings';

/** The settings of the activity, for the host. */
function ActivitySettings({ act }: { act: string }) {
  if (act === 'disk') return <DiskSettings />;
  if (act === 'poll') return <PollSettings />;
  if (act === 'lowtide') return <WebSettings />;
  if (act === 'cards') return <CardsSettings />;
  if (act === 'wheel')
    return (
      <Note>
        Les propositions et leurs poids se règlent dans la zone de jeu : tout le monde voit la roue se construire.
      </Note>
    );
  return (
    <Note>
      Rien à régler : le chat prend toute la place, la liste des joueurs est à gauche. Les scores ne bougent pas.
    </Note>
  );
}

export function GameTab() {
  const room = useStore(s => s.room),
    me = useStore(s => s.account)?.id,
    set = useStore(s => s.set);
  if (!room) return <Note>Entre dans un salon pour voir sa partie.</Note>;
  if (room.hostId !== me) return <GameInfo />;
  const act = room.activity.activity,
    key = scoreKey(room.activity);
  const ack = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) set({ note: r.error ?? '' });
  };
  const choose = async (a: ActivityChoice['activity']) =>
    ack(await request('activity:choose', { choice: { activity: a } }));
  return (
    <>
      <Field label="Activité">
        <Select
          value={act}
          onChange={v => void choose(v as ActivityChoice['activity'])}
          options={Object.entries(ACT_NAMES).map(([k, n]) => {
            const ready = READY_ACTIVITIES.includes(k as ActivityChoice['activity']);
            return { value: k, label: `${n}${ready ? '' : ' (bientôt)'}`, disabled: !ready };
          })}
        />
      </Field>
      <Note>{ACT_HELP[act]}</Note>
      <hr className="sep" />
      <h3 className="section">{SETTINGS_TITLES[act]}</h3>
      <ActivitySettings act={act} />
      {(act === 'disk' || act === 'poll' || act === 'cards') && (
        <Note>Les changements faits pendant un tour en cours s'appliquent à sa fin.</Note>
      )}
      {key && (
        <>
          <hr />
          <Button variant="danger" icon="reset" onClick={async () => ack(await request('game:reset'))}>
            Réinitialiser la partie
          </Button>
          <Note>
            Remet le classement {SCORE_NAMES[key]} à zéro (les autres jeux gardent le leur). Le palmarès est toujours
            gardé.
          </Note>
        </>
      )}
    </>
  );
}
