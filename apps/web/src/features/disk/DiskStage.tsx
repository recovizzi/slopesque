// The Demi-disque on the stage (openspec: semicircle-disk, round-flow, amphitheatre-mode): the topic, the answer time,
// the board (the half disk, or the Amphithéâtre's seats), the actions of my role, the results. The server decides,
// the panel only shows and sends intents; what the board shows to me is round-model.ts.
import { useEffect, useState } from 'react';
import { hueColor, TOLERANCE } from '@slopesque/engines';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Dot, Note, Timer, useNow } from '../../design';
import { AmphiBoard } from './AmphiBoard';
import { DiskActions, type Send } from './DiskActions';
import { DiskBoard } from './DiskBoard';
import { amphiMarks, canPick, diskRays, modeOf, roleOf, seatLost, type Painter } from './round-model';

export function DiskStage() {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id,
    skew = useStore(s => s.clockSkew);
  const d = room.disk;
  const members = new Map(room.members.map(m => [m.id, m]));
  const host = room.hostId ? members.get(room.hostId) : undefined;
  const role = roleOf(room.hostId, me, !!members.get(me)?.playing);
  const mode = modeOf(d);
  const [pick, setPick] = useState<number | null>(null),
    [note, setNote] = useState('');
  useEffect(() => {
    // Amphithéâtre: someone validated the seat I had picked first
    if (seatLost(d, me, pick)) {
      setPick(null);
      setNote("Ce siège vient d'être pris.");
    }
  }, [d.guesses]);
  useEffect(() => {
    setPick(null);
    setNote('');
  }, [d.phase, d.round]);

  // the answer time, from the server's deadline (my clock corrected)
  const now = useNow(200, d.phase === 'guessing');
  const left = d.deadline ? Math.max(0, d.deadline - (now + skew)) : 0,
    total = d.rules.roundSeconds * 1000;

  const send: Send = async (name, body = {}) => {
    const r = await request(name, body);
    setNote(r.ok ? '' : r.error);
    return r.ok;
  };
  const painter: Painter = {
    color: id => hueColor(members.get(id)?.hue ?? 222),
    name: id => (id === me ? 'Toi' : (members.get(id)?.name ?? '?')),
    hostColor: host ? hueColor(host.hue) : '#888',
    hostName: host?.name ?? '?',
  };
  const can = canPick(d, role, me);
  const marks = mode === 'amphi' ? amphiMarks(d, role, me, pick, painter) : { column: null, seats: [] };
  return (
    <div className="stage-grid">
      <div className="stage-head">
        <div>
          <h1 className="topic">{d.rules.topic}</h1>
          <p className="sub">
            Tour {d.round} · hôte{' '}
            {host ? (
              <>
                <Dot color={hueColor(host.hue)} />
                {host.name}
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
        {d.phase === 'guessing' && (
          <Timer ratio={left / total} urgent={left < 5000}>
            {Math.ceil(left / 1000)} s
          </Timer>
        )}
      </div>
      <div className="disk-area">
        <div className="disk-box">
          <div data-disk>
            <DiskBoard
              rays={mode === 'ray' ? diskRays(d, role, me, pick, painter) : []}
              tolerance={TOLERANCE}
              interactive={mode === 'ray' && can}
              hidden={mode !== 'ray'}
              onPick={setPick}
            />
            <AmphiBoard
              pick={mode === 'amphi' && can ? (role === 'host' ? 'column' : 'seat') : null}
              column={marks.column}
              marks={marks.seats}
              hidden={mode !== 'amphi'}
              onPick={setPick}
            />
          </div>
          <div className="ends">
            <span>{d.rules.left}</span>
            <span>{d.rules.right}</span>
          </div>
        </div>
      </div>
      <div className="stage-actions">
        <DiskActions d={d} role={role} me={me} mode={mode} pick={pick} host={host} members={room.members} send={send} />
        {note && <Note tone="alert">{note}</Note>}
      </div>
    </div>
  );
}
