// ?kit: what opens over the rest — Popover and Menu, Modal, Drawer.
import { useState } from 'react';
import { Button } from '../Button';
import { Drawer, DrawerBody } from '../Drawer';
import { Field } from '../Field';
import { IconButton } from '../IconButton';
import { Modal, ModalButtons } from '../Modal';
import { Note } from '../Note';
import { Menu, MenuItem, Popover } from '../Popover';
import { Tabs } from '../Tabs';
import { TextInput } from '../TextInput';
import { Section } from './Section';

export function KitOverlays() {
  const [menu, setMenu] = useState(false),
    [modal, setModal] = useState(false),
    [tab, setTab] = useState<'chat' | 'ranking'>('chat');
  const close = () => setMenu(false);
  return (
    <>
      <Section title="Popover, Menu, Modal">
        <div className="kit-row">
          <Popover
            open={menu}
            onClose={close}
            className="plus-wrap"
            trigger={
              <IconButton
                icon="plus"
                label="Fichier, sticker, GIF, emoji"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              />
            }
          >
            <Menu className="plus-menu" label="Ajouter">
              <MenuItem icon="file" onClick={close}>
                Fichier
              </MenuItem>
              <MenuItem icon="sticker" onClick={close}>
                Sticker
              </MenuItem>
              <MenuItem icon="gif" onClick={close}>
                GIF
              </MenuItem>
            </Menu>
          </Popover>
          <Button variant="ghost" onClick={() => setModal(true)}>
            Ouvrir une fenêtre
          </Button>
        </div>
        {modal && (
          <Modal title="Retirer ce salon de ta liste ?" onClose={() => setModal(false)} closeButton>
            <Note>Il n'est pas supprimé du serveur.</Note>
            <ModalButtons>
              <Button variant="ghost" onClick={() => setModal(false)}>
                Annuler
              </Button>
              <Button variant="danger-fill" onClick={() => setModal(false)}>
                Retirer
              </Button>
            </ModalButtons>
          </Modal>
        )}
      </Section>
      <Section title="Drawer">
        <div className="kit-shell">
          <div className="main">
            <Drawer side="left">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'chat', label: 'Chat', icon: 'chat' },
                  { id: 'ranking', label: 'Joueurs', icon: 'users' },
                ]}
              />
            </Drawer>
            <main className="stage">la scène</main>
            <Drawer side="right" onClose={() => undefined}>
              <DrawerBody>
                <Field label="Pseudo">
                  <TextInput defaultValue="Léa" />
                </Field>
              </DrawerBody>
            </Drawer>
          </div>
        </div>
      </Section>
    </>
  );
}
