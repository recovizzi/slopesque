// The card table (openspec: card-games) instead of the game area: the game the host chose — before its first deal the
// seats (PreDeal), then the Trou du cul (tdc/) or the Tarot (tarot/); the Texas Hold'em and the Coinche are still HTML
// strings (LegacyTable, until task 3.3) — drawn from the server's views one after the other with their animations
// (useCardsQueue), the announcements over the table, a refused move's reason under it, the rules. The server deals,
// checks every move, makes the robots play, and only ever sends me my own hand.
import { useMemo, useRef, useState } from 'react';
import { cardGameOf } from '@slopesque/shared';
import { Coinche as CO, Holdem as HE, Tarot as TA, Tdc as T } from '@slopesque/engines';
import { request } from '../../app/net';
import { useStore } from '../../app/store';
import { Note, useEscape } from '../../design';
import { LegacyRules, LegacyTable } from './LegacyTable';
import { paidWho, seatWho, type TableActions } from './model';
import { PreDeal } from './PreDeal';
import { TrumpArtContext } from './tarot/TarotCard';
import { TarotRules } from './tarot/TarotRules';
import { TarotTable } from './tarot/TarotTable';
import { TdcRules } from './tdc/TdcRules';
import { TdcTable } from './tdc/TdcTable';
import { useCardsQueue } from './useCardsQueue';

export function CardsStage() {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const box = useRef<HTMLDivElement>(null),
    { c, showLast, announce, countFor, pay, fresh } = useCardsQueue(box, me);
  const [rules, setRules] = useState(false),
    [full, setFull] = useState(false),
    [note, setNote] = useState(''),
    [wonView, setWonView] = useState<string | null>(null);
  const want = cardGameOf(room.activity); // the game the host chose (the table may still hold the other)
  const t = c.game === 'tdc' && want === 'tdc' ? (c.tdc as unknown as T.Tdc | null) : null,
    tarot = c.game === 'tarot' && want === 'tarot' ? (c.tarot as unknown as TA.Tarot | null) : null,
    holdem = c.game === 'holdem' && want === 'holdem' ? (c.holdem as unknown as HE.Holdem | null) : null,
    coinche = c.game === 'coinche' && want === 'coinche' ? (c.coinche as unknown as CO.Coinche | null) : null;
  const legacyRules = want === 'holdem' || want === 'coinche';
  useEscape(() => setRules(false), rules && legacyRules); // the components' rules are design's Modal: it closes itself

  const members = useMemo(() => new Map(room.members.map(m => [m.id, m])), [room.members]);
  const who = useMemo(() => seatWho(c.seats, members, me), [c.seats, members, me]);
  const mySeat = c.seats.find(s => s.user === me)?.id ?? '',
    host = room.hostId === me;
  const voting = room.chat.messages.some(
    m => m.kind === 'vote' && !(m.data?.vote as { result?: string } | undefined)?.result,
  );
  const late = c.late && c.late.seat !== mySeat ? { seat: c.late.seat, secs: c.late.secs, vote: voting } : null;
  const artKey = JSON.stringify(c.art ?? {}),
    art = useMemo(() => JSON.parse(artKey) as Record<string, string>, [artKey]); // the same object while unchanged

  const act = useMemo<TableActions>(() => {
    const ack = (r: { ok: boolean; error?: string }) => setNote(r.ok ? '' : (r.error ?? ''));
    return {
      send: (name, body) => void request(name, body ?? {}).then(ack),
      join: () =>
        void request('table:join').then(r => {
          if (r.ok && r.value === 'full') {
            setFull(true);
            setTimeout(() => setFull(false), 2600);
          } else ack(r);
        }),
      kick: () => void request('kick:ask').then(ack),
      rules: () => setRules(true),
    };
  }, []);

  const free = c.seats.filter(s => !s.user);
  const table = t ? (
    <TdcTable
      t={t}
      me={mySeat}
      host={host}
      who={who}
      paid={paidWho(c.paid, members, me, who)}
      late={late}
      seats={{
        free: free.length,
        total: c.seats.length,
        mine: free.some(s => s.credit === me),
        takes: free[0] ? who(free[0].id).name : '',
        full,
      }}
      act={act}
    />
  ) : tarot ? (
    <TarotTable
      t={tarot}
      me={mySeat}
      host={host}
      who={who}
      showLast={showLast}
      wonView={wonView}
      showTricks={c.showTricks}
      act={act}
    />
  ) : holdem || coinche ? (
    <LegacyTable
      {...{ c, holdem, coinche, me, mySeat, host, who, late, full, showLast, wonView, countFor, fresh, pay, act, box }}
    />
  ) : (
    <PreDeal game={want} c={c} seated={!!mySeat} host={host} who={who} full={full} act={act} />
  );
  const closeRules = () => setRules(false);
  return (
    <div
      className="cards-stage"
      ref={box}
      onMouseOver={e => {
        const w = (e.target as Element).closest<HTMLElement>('[data-won]')?.dataset.won ?? null;
        if (w !== wonView) setWonView(w);
      }}
      onMouseLeave={() => setWonView(null)}
    >
      <TrumpArtContext.Provider value={art}>
        {table}
        {note && (
          <Note tone="alert" className="cards-note">
            {note}
          </Note>
        )}
        {announce && <div className="announce-layer">{announce}</div>}
        {rules &&
          (legacyRules ? (
            <LegacyRules game={want} onClose={closeRules} />
          ) : c.game === 'tarot' ? (
            <TarotRules onClose={closeRules} />
          ) : (
            <TdcRules onClose={closeRules} />
          ))}
      </TrumpArtContext.Provider>
    </div>
  );
}
