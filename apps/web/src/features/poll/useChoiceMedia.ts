// A choice's picture in « Choix définis », chosen from its "+" menu or dropped on its row: an image file (sent,
// converted for the poll), a GIF (a link to its provider, as in the chat: the GIF window with the recent ones and
// favourites shared with the chat), a sticker of the room; or an emoji, written in the choice's text at the caret.
import { useRef, type Dispatch, type SetStateAction } from 'react';
import type { StickerView } from '@slopesque/shared';
import { ServerGifs, toggleGifFavorite, upload } from '../../app/net';
import { useStore } from '../../app/store';
import { placeFloating, type EmojiPop } from '../../lib/emoji';
import { GifPop, useGif } from '../chat/gif';
import type { MediaTarget } from './ChoiceRow';
import { atRow, insertAt, setChoice, setPic, type Draft, type DraftPic } from './model';

const MAX_TEXT = 40; // a choice's field (maxLength)

export function useChoiceMedia(
  onDraft: Dispatch<SetStateAction<Draft>>,
  onNote: (s: string) => void,
  pop: EmojiPop | null,
) {
  const file = useRef<HTMLInputElement>(null),
    fileFor = useRef<number | null>(null);
  const gifs = useRef<GifPop | null>(null),
    gifHost = useRef<HTMLDivElement>(null);

  /** A choice's picture, on its row (`key`: the row, wherever it is by then). */
  const put = (key: number, pic: DraftPic) => onDraft(d => atRow(d, key, (x, i) => setPic(x, i, pic)));
  /** An image file for a choice: sent, then shown on its row. */
  async function sendFile(key: number, f: File) {
    const r = await upload('poll', f);
    if (!r.ok) {
      onNote(r.error);
      return;
    }
    onNote('');
    put(key, { kind: 'image', src: r.value.url, w: r.value.w, h: r.value.h, mediaId: r.value.id });
  }

  return {
    /** The hidden file field (+ → Image) and its change. */
    file,
    async onFile(f: File | undefined) {
      const key = fileFor.current;
      if (f && key !== null) await sendFile(key, f);
    },
    /** Where the GIF window lives (fixed, placed next to the "+" button): the compose form's root. */
    gifHost,
    sendFile,
    sticker: (key: number, s: StickerView) =>
      put(key, { kind: 'sticker', src: s.src, w: s.w, h: s.h, stickerId: s.id }),
    pickFile(key: number) {
      fileFor.current = key;
      file.current?.click();
    },
    pickGif(key: number, { anchor }: MediaTarget) {
      gifs.current ??= new GifPop(
        gifHost.current!,
        new ServerGifs(),
        {
          recent: () => useStore.getState().device.gifRecent,
          favorites: () => useStore.getState().account?.gifFavorites ?? [],
          toggleFavorite: g => toggleGifFavorite(g),
        },
        (el, a) => placeFloating(el, a, 380, 460),
      );
      gifs.current.open(anchor, g => {
        const st = useStore.getState();
        st.setDevice({ gifRecent: useGif(st.device.gifRecent, g) });
        put(key, { kind: 'gif', src: g.url, w: g.w, h: g.h, gif: g });
      });
    },
    pickEmoji(key: number, { anchor, input }: MediaTarget) {
      void pop?.open(
        anchor,
        emo => {
          const r = insertAt(
            input.value,
            input.selectionStart ?? input.value.length,
            input.selectionEnd ?? input.value.length,
            emo,
            MAX_TEXT,
          );
          onDraft(d => atRow(d, key, (x, i) => setChoice(x, i, r.text)));
          requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(r.caret, r.caret);
          });
        },
        { keepOpen: true },
      );
    },
  };
}
