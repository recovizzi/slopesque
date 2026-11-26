// The Roulette on the stage (openspec: roulette-activity): the host builds a wheel of propositions, each with an
// optional weight; everyone watches it being built. On the draw, the server draws an angle and the needle stops on
// it: the sector under the needle wins. The panel shows and sends intents.
import { useEffect, useState } from 'react';
import { Wheel as Rules } from '@slopesque/engines';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Note } from '../../design';
import { winnerText, type WheelItem } from './model';
import { Wheel } from './Wheel';
import { WheelEditor } from './WheelEditor';
import { WheelLegend } from './WheelLegend';

export function WheelStage() {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id,
    skew = useStore(s => s.clockSkew);
  const wv = room.wheel,
    hosting = room.hostId === me,
    host = room.members.find(m => m.id === room.hostId);
  const writing = wv.phase === 'writing',
    building = hosting && writing; // my edits are shown before the server sends them back
  const [items, setItems] = useState(wv.items);
  useEffect(() => {
    if (!building) setItems(wv.items);
  }, [wv.items, building]);
  const [note, setNote] = useState('');

  const change = (next: WheelItem[]) => {
    setItems(next);
    void request('wheel:set', { items: next });
  };
  const spin = async () => {
    const r = await request('wheel:spin');
    setNote(r.ok ? '' : r.error);
  };
  const drawn = !writing && wv.spin ? wv.spin : null,
    winner = wv.phase === 'result' && wv.spin ? wv.spin.winner : null;
  const hostName = host?.name ?? "L'hôte";

  let actions;
  if (writing)
    actions = building ? (
      <div className="actions">
        <Button size="big" disabled={!!Rules.problem(items)} onClick={() => void spin()}>
          Lancer la roue
        </Button>
        <p className="hint">Les autres joueurs voient la roue se construire.</p>
      </div>
    ) : (
      <div className="actions">
        <p className="hint">{`${hostName} construit la roue…`}</p>
      </div>
    );
  else if (wv.phase === 'spinning')
    actions = (
      <div className="actions">
        <p className="hint spinning">La roue tourne…</p>
      </div>
    );
  else {
    const w = winnerText(wv.spin!);
    actions = (
      <div className="actions">
        <div className="word" data-winner>{`« ${w.label} »`}</div>
        <p className="hint">{`${w.share} % de chances · aiguille arrêtée à ${w.angle}°`}</p>
        {hosting ? (
          <div className="row">
            <Button size="big" onClick={() => void spin()}>
              Relancer
            </Button>
            <Button variant="ghost" size="big" onClick={() => void request('wheel:edit')}>
              Modifier la roue
            </Button>
          </div>
        ) : (
          <p className="hint">{`${hostName} prépare le prochain tirage…`}</p>
        )}
      </div>
    );
  }

  return (
    <div className="stage-grid">
      <div className="stage-head">
        <div>
          <h1 className="topic">Roulette</h1>
          <p className="sub">{`Tirage ${wv.round} · hôte ${host?.name ?? '—'}`}</p>
        </div>
      </div>
      <div className="disk-area">
        <div className="wheel-box">
          <div className="wheel-holder">
            <Wheel items={building ? items : (drawn?.items ?? wv.items)} winner={winner} spin={drawn} skew={skew} />
          </div>
          <div className="wheel-side">
            {building ? (
              <WheelEditor items={items} onChange={change} />
            ) : (
              <WheelLegend items={drawn?.items ?? wv.items} winner={winner} />
            )}
          </div>
        </div>
      </div>
      <div className="stage-actions">
        {actions}
        {note && <Note tone="alert">{note}</Note>}
      </div>
    </div>
  );
}
