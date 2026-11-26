// The panel: the header (Header.tsx), the left drawer (the players, the chat in a game: LeftDrawer.tsx), the stage
// (the activity, or a page instead of it: Stage.tsx, pages/), the right drawer (the settings: settings/). This file
// holds what they share: which drawer and tab are open, the window to change my code, the emoji window.
import { useRef, useState } from 'react';
import { newCode } from '@slopesque/engines';
import { useBodyClasses, useEmojiPop, useShellEscape, useVoteOpensChat } from './hooks';
import { Header } from './Header';
import { LeftDrawer, type LeftTab } from './LeftDrawer';
import { NoticeModal } from './pages/NoticeModal';
import { SettingsDrawer, type SettingsTab } from './settings/SettingsDrawer';
import { Stage } from './Stage';
import { useStore } from './store';
import { CodeModal } from '../features/account/CodeModal';
import type { CodeMode } from '../features/account/model';

const EMBED = new URLSearchParams(location.search).has('embed');

export function App() {
  const { device, fatal, account, room, roomStatus } = useStore();
  const [leftOpen, setLeftOpen] = useState(innerWidth >= 640);
  const [rightOpen, setRightOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [leftTab, setLeftTab] = useState<LeftTab>('chat');
  const [codeModal, setCodeModal] = useState<{ first: boolean; start: CodeMode | null } | null>(null);
  const [welcomeCode] = useState(() => newCode()); // drawn at the first launch; kept only after « Continuer »
  const popHost = useRef<HTMLDivElement>(null);
  const pop = useEmojiPop(popHost, device.theme);

  const first = !device.code;
  const blocked = first || !!fatal || roomStatus !== 'ok' || !room || !account;
  const act = room?.activity.activity ?? 'chat';
  useBodyClasses({ activity: room?.activity.activity, room: !!room, left: leftOpen, right: rightOpen, blocked, first });
  useShellEscape(
    {
      codeModal: !!codeModal,
      closeCode: () => setCodeModal(null),
      right: rightOpen,
      closeRight: () => setRightOpen(false),
    },
    EMBED,
  );
  useVoteOpensChat(room, act, () => {
    setLeftOpen(true);
    setLeftTab('chat');
  });

  const openSettings = (t: SettingsTab) => {
    setRightOpen(true);
    setTab(t);
  };
  return (
    <>
      <Header
        first={first}
        embed={EMBED}
        onPlayers={() => setLeftOpen(!leftOpen)}
        onProfile={() => {
          setRightOpen(!rightOpen);
          setTab('profile');
        }}
      />
      <div className="main">
        <LeftDrawer tab={leftTab} onTab={setLeftTab} onClose={() => setLeftOpen(false)} blocked={blocked} pop={pop} />
        <Stage
          welcomeCode={welcomeCode}
          blocked={blocked}
          pop={pop}
          onCode={mode => setCodeModal({ first: true, start: mode })}
          onRooms={() => openSettings('extension')}
          onGameSettings={() => openSettings('game')}
        />
        <SettingsDrawer
          open={rightOpen}
          tab={tab}
          onTab={setTab}
          onClose={() => setRightOpen(false)}
          first={first}
          pop={pop}
          onCode={() => setCodeModal({ first: false, start: null })}
        />
      </div>
      {room?.notice && <NoticeModal notice={room.notice} />}
      {codeModal && (
        <CodeModal
          first={codeModal.first}
          start={codeModal.start}
          onClose={() => setCodeModal(null)}
          onDone={() => setCodeModal(null)}
        />
      )}
      <div ref={popHost} />
    </>
  );
}
