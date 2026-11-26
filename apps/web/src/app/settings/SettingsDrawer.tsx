// The right drawer, the settings: Profil, Extension, Partie (one file each). Its body is made again each time it opens
// (fields back to the saved values).
import { ExtensionTab } from './ExtensionTab';
import { GameTab } from './GameTab';
import { Profile } from './Profile';
import { Drawer, DrawerBody, IconButton, Tabs } from '../../design';
import type { EmojiPop } from '../../lib/emoji';

export type SettingsTab = 'profile' | 'extension' | 'game';

export interface SettingsDrawerProps {
  open: boolean;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onClose: () => void;
  /** No settings at the first launch. */
  first: boolean;
  pop: EmojiPop | null;
  /** The window to change my code (Profil → Compte). */
  onCode: () => void;
}

export function SettingsDrawer({ open, tab, onTab, onClose, first, pop, onCode }: SettingsDrawerProps) {
  return (
    <Drawer side="right" onClose={onClose}>
      {!first && (
        <>
          <Tabs
            value={tab}
            onChange={onTab}
            tabs={[
              { id: 'profile', label: 'Profil' },
              { id: 'extension', label: 'Extension' },
              { id: 'game', label: 'Partie' },
            ]}
          >
            <IconButton icon="close" label="Fermer" onClick={onClose} />
          </Tabs>
          <DrawerBody key={open ? 'open' : 'closed'}>
            {tab === 'profile' ? (
              <Profile pop={pop} onCode={onCode} />
            ) : tab === 'extension' ? (
              <ExtensionTab />
            ) : (
              <GameTab />
            )}
          </DrawerBody>
        </>
      )}
    </Drawer>
  );
}
