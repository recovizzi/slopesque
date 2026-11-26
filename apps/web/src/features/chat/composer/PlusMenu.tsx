// The « + » of the chat's field: Fichier (an image, a sticker or an emoji from a file), Sticker (the room's library),
// GIF (the GIF window) and Emoji (the picker, writing at the caret). Closed by Escape or a click elsewhere.
import type { Ref } from 'react';
import { IconButton, Menu, MenuItem, Popover } from '../../../design';

export interface PlusMenuProps {
  open: boolean;
  onOpen: (open: boolean) => void;
  /** The « + » itself: where the GIF and emoji windows open. */
  plusRef: Ref<HTMLButtonElement>;
  onFile: () => void;
  onSticker: () => void;
  onGif: () => void;
  onEmoji: () => void;
}

export function PlusMenu({ open, onOpen, plusRef, onFile, onSticker, onGif, onEmoji }: PlusMenuProps) {
  const item = (f: () => void) => () => {
    onOpen(false);
    f();
  };
  return (
    <Popover
      open={open}
      onClose={() => onOpen(false)}
      className="plus-wrap"
      trigger={
        <IconButton
          ref={plusRef}
          icon="plus"
          label="Fichier, sticker, GIF, emoji"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => onOpen(!open)}
        />
      }
    >
      <Menu className="plus-menu">
        <MenuItem icon="file" onClick={item(onFile)}>
          Fichier
        </MenuItem>
        <MenuItem icon="sticker" onClick={item(onSticker)}>
          Sticker
        </MenuItem>
        <MenuItem icon="gif" onClick={item(onGif)}>
          GIF
        </MenuItem>
        <MenuItem icon="smile" onClick={item(onEmoji)}>
          Emoji
        </MenuItem>
      </Menu>
    </Popover>
  );
}
