// The stage: the activity of the room (the chat, the Demi-disque, the Sondage, the Roulette, the cards, Low Tide), or
// a page instead of it — the first launch, a refused code, a server down, a room that can't be entered.
import { useStore } from './store';
import { FatalPage } from './pages/FatalPage';
import { OfflinePage } from './pages/OfflinePage';
import { Card, Note } from '../design';
import type { EmojiPop } from '../lib/emoji';
import type { CodeMode } from '../features/account/model';
import { Welcome } from '../features/account/Welcome';
import { CardsStage } from '../features/cards/CardsStage';
import { Chat } from '../features/chat/Chat';
import { DiskStage } from '../features/disk/DiskStage';
import { PollStage, WheelStage } from '../features/poll/PollWheel';
import { RoomPage } from '../features/rooms/RoomPage';
import { WebStage } from '../features/web/WebStage';

export interface StageProps {
  /** The code drawn at the first launch (kept only after « Continuer »). */
  welcomeCode: string;
  blocked: boolean;
  pop: EmojiPop | null;
  /** The window to change my code, opened on a way (the first launch, a refused code). */
  onCode: (mode: CodeMode) => void;
  /** Extension → Salons. */
  onRooms: () => void;
  /** Partie (Low Tide's address). */
  onGameSettings: () => void;
}

/** What replaces the room, if anything. */
function Page({ welcomeCode, onCode, onRooms }: Pick<StageProps, 'welcomeCode' | 'onCode' | 'onRooms'>) {
  const { device, fatal, conn, account, room, roomStatus } = useStore();
  if (!device.code) return <Welcome code={welcomeCode} onChange={onCode} />;
  if (fatal) return <FatalPage onCode={onCode} />;
  if (!account && conn === 'offline') return <OfflinePage />;
  if (!account)
    return (
      <Card>
        <Note>Connexion au serveur…</Note>
      </Card>
    );
  if (roomStatus !== 'ok' || !room)
    return <RoomPage status={roomStatus === 'ok' ? 'loading' : roomStatus} onList={onRooms} />;
  return null;
}

export function Stage({ blocked, pop, onGameSettings, ...page }: StageProps) {
  const act = useStore(s => s.room?.activity.activity ?? 'chat');
  const on = (a: string) => !blocked && act === a;
  return (
    <main className="stage">
      <div className="room-page">
        <Page {...page} />
      </div>
      <div className="chat-stage">{on('chat') && <Chat pop={pop} />}</div>
      {on('disk') && <DiskStage />}
      {on('poll') && <PollStage pop={pop} />}
      {on('wheel') && <WheelStage />}
      {on('cards') && <CardsStage />}
      {on('lowtide') && <WebStage onSettings={onGameSettings} />}
    </main>
  );
}
