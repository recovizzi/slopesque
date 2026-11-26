// A choice (or a proposition of the gradient) being written: its field and its remove button; in « Choix définis »,
// its picture too (optional): a thumbnail, the "+" menu (image, GIF, sticker, emoji) opening downwards, and an image
// file dropped on the row.
import { useRef, useState, type DragEvent } from 'react';
import type { StickerView } from '@slopesque/shared';
import { Button, cls, Icon, IconButton, Menu, MenuItem, Note, Popover, TextInput, useDismiss } from '../../design';
import { ChoicePic } from './ChoiceParts';
import type { DraftPic, PollKind } from './model';

export type MediaKind = 'file' | 'gif' | 'sticker' | 'emoji';
/** Where a picture or an emoji chosen from the menu goes: the GIF and emoji windows open next to the "+" button, an
 *  emoji is written in the field where its caret is. */
export interface MediaTarget {
  anchor: HTMLElement;
  input: HTMLInputElement;
}

export interface ChoiceRowProps {
  i: number;
  kind: PollKind;
  text: string;
  pic: DraftPic | null;
  removable: boolean;
  menuOpen: boolean;
  onText: (text: string) => void;
  onMenu: (open: boolean) => void;
  onMedia: (kind: MediaKind, at: MediaTarget) => void;
  onFile: (f: File) => void;
  onRemovePic: () => void;
  onRemove: () => void;
}

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

export function ChoiceRow(p: ChoiceRowProps) {
  const input = useRef<HTMLInputElement>(null),
    plus = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false); // an image dragged over the row
  const withPics = p.kind === 'choices';
  const media = (kind: MediaKind) => () => {
    p.onMenu(false);
    p.onMedia(kind, { anchor: plus.current!, input: input.current! });
  };
  // the row takes an image file (the stage around refuses it: dropEffect none)
  const drop = {
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setOver(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOver(false);
      const f = e.dataTransfer.files[0];
      if (f) p.onFile(f);
    },
  };
  return (
    <li className={cls('choice-row', over && 'is-drop')} {...(withPics ? drop : {})}>
      {withPics &&
        (p.pic ? (
          <span className="choice-thumb">
            <ChoicePic pic={p.pic} />
            <button
              type="button"
              className="thumb-del"
              title="Retirer l'image"
              aria-label="Retirer l'image"
              onClick={p.onRemovePic}
            >
              <Icon name="close" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="choice-thumb empty"
            title="Ajouter une image (facultatif)"
            aria-label="Ajouter une image"
            onClick={() => p.onMenu(true)}
          >
            <Icon name="file" />
          </button>
        ))}
      <TextInput
        ref={input}
        data-poll="choice"
        data-i={p.i}
        value={p.text}
        maxLength={40}
        placeholder={`${p.kind === 'gradient' ? 'Proposition' : 'Choix'} ${p.i + 1}`}
        autoComplete="off"
        onChange={e => p.onText(e.target.value)}
      />
      {withPics && (
        <Popover
          className="plus-wrap choice-plus"
          open={p.menuOpen}
          onClose={() => p.onMenu(false)}
          trigger={
            <IconButton
              ref={plus}
              icon="plus"
              size="sm"
              label="Image, GIF, sticker ou emoji"
              data-action="choice-plus"
              data-i={p.i}
              aria-haspopup="menu"
              aria-expanded={p.menuOpen}
              onClick={() => p.onMenu(!p.menuOpen)}
            />
          }
        >
          <Menu className="plus-menu choice-menu">
            <MenuItem icon="file" onClick={media('file')}>
              Image
            </MenuItem>
            <MenuItem icon="gif" onClick={media('gif')}>
              GIF
            </MenuItem>
            <MenuItem icon="sticker" onClick={media('sticker')}>
              Sticker
            </MenuItem>
            <MenuItem icon="smile" onClick={media('emoji')}>
              Emoji
            </MenuItem>
          </Menu>
        </Popover>
      )}
      {p.removable && <IconButton icon="close" size="sm" label="Retirer" onClick={p.onRemove} />}
      {withPics && (
        <span className="drop-hint" aria-hidden="true">
          Dépose l'image
        </span>
      )}
    </li>
  );
}

/** The room's stickers, under the row whose menu asked for one; closed by Escape, a click elsewhere or « Fermer ». */
export function ChoiceStickers({
  i,
  stickers,
  onPick,
  onClose,
}: {
  i: number;
  stickers: StickerView[];
  onPick: (s: StickerView) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useDismiss(ref, onClose);
  return (
    <li ref={ref} className="choice-stickers">
      {stickers.length ? (
        <ul className="sticker-grid">
          {stickers.map(s => (
            <li key={s.id}>
              <button
                className="sticker-item"
                type="button"
                data-action="choice-sticker-pick"
                data-i={i}
                title="Mettre ce sticker"
                onClick={() => onPick(s)}
              >
                <img src={s.src} width={s.w} height={s.h} alt="Sticker" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Note tone="alert">
          Aucun sticker dans ce salon pour l'instant : ajoutes-en depuis le chat (+ → Fichier → Sticker).
        </Note>
      )}
      <Button variant="ghost" size="sm" onClick={onClose}>
        Fermer
      </Button>
    </li>
  );
}
