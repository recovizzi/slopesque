// The left drawer: in the Chat activity, its players and the Palmarès; in a game, the chat beside the stage, the
// ranking (a game with points) or the players, and the Palmarès kept for every game.
import type { MemberView } from '@slopesque/shared';
import { request } from './net';
import { useStore } from './store';
import { Drawer, IconButton, Tabs, type TabItem } from '../design';
import type { EmojiPop } from '../lib/emoji';
import { Chat, People } from '../features/chat/Chat';
import { Ranking } from '../features/disk/Ranking';
import { Palmares } from '../features/palmares/Palmares';

export type LeftTab = 'chat' | 'ranking' | 'palmares';
const CHAT_TAB: TabItem<LeftTab> = { id: 'chat', label: 'Chat', icon: 'chat', title: 'Chat' };
const RANKING_TAB: TabItem<LeftTab> = { id: 'ranking', label: 'Classement', icon: 'trophy', title: 'Classement' };
const PLAYERS_TAB: TabItem<LeftTab> = { id: 'ranking', label: 'Joueurs', icon: 'users', title: 'Joueurs' };
const PALMARES_TAB: TabItem<LeftTab> = {
  id: 'palmares',
  label: 'Palmarès',
  icon: 'chart',
  title: 'Palmarès : victoires et taux de victoire, gardés dans le temps',
};

export interface LeftDrawerProps {
  tab: LeftTab;
  onTab: (t: LeftTab) => void;
  onClose: () => void;
  /** A room that can't be entered: no chat. */
  blocked: boolean;
  pop: EmojiPop | null;
}

export function LeftDrawer({ tab, onTab, onClose, blocked, pop }: LeftDrawerProps) {
  const room = useStore(s => s.room),
    account = useStore(s => s.account);
  const act = room?.activity.activity ?? 'chat',
    scored = act === 'disk' || act === 'cards'; // the others have no points: their players
  const giveHost = async (m: MemberView) => {
    const r = await request('host:give', { to: m.id });
    if (!r.ok) useStore.getState().set({ note: r.error });
  };
  const close = <IconButton icon="close" label="Fermer le panneau" title="Fermer" onClick={onClose} />;
  if (!room || !account) return <Drawer side="left" />;
  if (act === 'chat')
    return (
      <Drawer side="left">
        <Tabs value={tab === 'palmares' ? 'palmares' : 'ranking'} onChange={onTab} tabs={[PLAYERS_TAB, PALMARES_TAB]}>
          {close}
        </Tabs>
        {tab === 'palmares' ? <Palmares /> : <People onGiveHost={giveHost} />}
      </Drawer>
    );
  return (
    <Drawer side="left">
      <Tabs value={tab} onChange={onTab} tabs={[CHAT_TAB, scored ? RANKING_TAB : PLAYERS_TAB, PALMARES_TAB]}>
        {close}
      </Tabs>
      {tab === 'chat' ? (
        !blocked && <Chat pop={pop} />
      ) : tab === 'palmares' ? (
        <Palmares />
      ) : scored ? (
        <Ranking onGiveHost={giveHost} />
      ) : (
        <People onGiveHost={giveHost} />
      )}
    </Drawer>
  );
}
