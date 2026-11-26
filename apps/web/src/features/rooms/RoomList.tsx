// Extension → Salons: my rooms (saved with my account), the current one marked; join one, add a key, create one;
// tick some to rename one or remove them from my list (RoomModal.tsx asks first).
import { useState } from 'react';
import { join } from '../../app/net';
import { useStore } from '../../app/store';
import { Badge, Button, cls, Note } from '../../design';
import { freshKey, roomName } from './model';
import { RoomModal, type RoomModalState } from './RoomModal';

export function RoomList() {
  const rooms = useStore(s => s.account?.rooms ?? []);
  const current = useStore(s => s.device.roomKey),
    status = useStore(s => s.roomStatus);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<RoomModalState | null>(null);
  const n = selected.size;
  const toggle = (k: string, on: boolean) => {
    const s = new Set(selected);
    if (on) s.add(k);
    else s.delete(k);
    setSelected(s);
  };
  const open = (kind: RoomModalState['kind'], m: Partial<RoomModalState> = {}) =>
    setModal({ kind, key: '', name: '', keys: [], ...m });
  return (
    <div className="rooms">
      <div className="rooms-head">
        <span>Salons</span>
        <span className="row">
          <Button variant="ghost" size="sm" onClick={() => open('add')}>
            + Ajouter
          </Button>
          <Button variant="ghost" size="sm" onClick={() => open('create', { key: freshKey(rooms) })}>
            Créer
          </Button>
        </span>
      </div>
      {rooms.length ? (
        <ul className="room-list">
          {rooms.map(r => (
            <li key={r.key} className={cls('room-row', r.key === current && 'is-current')}>
              <input
                type="checkbox"
                checked={selected.has(r.key)}
                onChange={e => toggle(r.key, e.target.checked)}
                aria-label={`Sélectionner ${roomName(r)}`}
              />
              <div className="room-main">
                <b title={roomName(r)}>{roomName(r)}</b>
                <code>{r.key}</code>
              </div>
              {r.key === current ? (
                <>
                  <Badge>Actuel</Badge>
                  {status !== 'ok' && (
                    <Button size="sm" onClick={() => void join(r.key)}>
                      Réessayer
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {r.pending && <Badge tone="wait">En attente</Badge>}
                  <Button size="sm" onClick={() => void join(r.key)}>
                    Rejoindre
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Note>Aucun salon : ajoute une clé, ou crée un salon.</Note>
      )}
      {n ? (
        <div className="room-actions">
          <span>
            {n} sélectionné{n > 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={n !== 1}
            title={n === 1 ? undefined : 'Un seul salon à la fois'}
            onClick={() => {
              const r = rooms.find(x => selected.has(x.key))!;
              open('rename', { key: r.key, name: r.name });
            }}
          >
            Renommer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="danger-text"
            onClick={() => open('delete', { keys: [...selected] })}
          >
            Retirer
          </Button>
        </div>
      ) : (
        <Note>Coche des salons pour en renommer un ou les retirer de ta liste.</Note>
      )}
      {modal && (
        <RoomModal
          m={modal}
          onClose={() => {
            setModal(null);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
