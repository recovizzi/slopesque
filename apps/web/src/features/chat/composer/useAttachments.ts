// Pictures in the chat (openspec: chat-activity, Images et stickers): a file chosen (+ → Fichier) or dropped becomes
// an image (sent with the message), a sticker (kept in the room's library) or a custom emoji of the room (its name
// asked); a sticker of the library or a GIF chosen. The picture then waits above the field, to go with a text or
// alone (or as a screamer).
import { useState, type RefObject } from 'react';
import type { GifRef } from '@slopesque/shared';
import { request, upload } from '../../../app/net';
import { useStore } from '../../../app/store';
import { NAME, suggestName, type CustomEmoji } from '../../../lib/emoji';

export interface Picked {
  file: File;
  url: string;
  w: number;
  h: number;
  error: string;
}
/** A picture waiting above the field: an image not sent yet (sent with the message), a sticker of the room, a GIF. */
export type Attach =
  | { kind: 'image'; file: File; url: string; w: number; h: number }
  | { kind: 'sticker'; id: string; src: string; w: number; h: number }
  | { kind: 'gif'; gif: GifRef };

/** A file read as a picture (its size), or why it can't be one. */
async function read(file: File): Promise<Picked> {
  const url = URL.createObjectURL(file);
  if (!file.type.startsWith('image/'))
    return {
      file,
      url,
      w: 0,
      h: 0,
      error:
        "Ce fichier n'est pas une image : seules les images peuvent être envoyées (en sticker, en image ou en emoji).",
    };
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    return { file, url, w: 0, h: 0, error: 'Cette image ne peut pas être lue.' };
  }
  return { file, url, w: img.naturalWidth, h: img.naturalHeight, error: '' };
}

export function useAttachments(inputRef: RefObject<HTMLInputElement | null>, custom: CustomEmoji[]) {
  const set = useStore(s => s.set);
  const [attach, setAttach] = useState<Attach | null>(null),
    [sending, setSending] = useState(false);
  const [picked, setPicked] = useState<Picked | 'loading' | null>(null);
  const [naming, setNaming] = useState<string | null>(null),
    [nameError, setNameError] = useState('');
  const [stickers, setStickers] = useState(false);

  /** The picture chosen waits above the field (the one before it let go). */
  function attachIt(a: Attach) {
    setAttach(old => {
      if (old?.kind === 'image' && old.url !== (a.kind === 'image' ? a.url : '')) URL.revokeObjectURL(old.url);
      return a;
    });
    setStickers(false);
    set({ note: '' });
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  const dropAttach = () =>
    setAttach(old => {
      if (old?.kind === 'image') URL.revokeObjectURL(old.url);
      return null;
    });
  const cancelPick = () => {
    setPicked(null);
    setNaming(null);
  };

  async function choose(file: File) {
    setStickers(false);
    setNaming(null);
    set({ note: '' });
    setPicked('loading');
    setPicked(await read(file));
  }

  /** The file chosen becomes an image (waiting), a sticker (kept in the room's library, then waiting) or an emoji. */
  async function use(as: 'image' | 'sticker' | 'emoji') {
    if (!picked || picked === 'loading' || picked.error) return;
    if (as === 'emoji' && (!naming || !NAME.test(naming))) {
      setNameError('De 2 à 24 caractères : minuscules sans accent, chiffres et _.');
      return;
    }
    if (as === 'emoji' && custom.some(c => c.name === naming)) {
      setNameError(`:${naming}: existe déjà dans le salon.`);
      return;
    }
    const p = picked;
    if (as === 'image') {
      cancelPick();
      attachIt({ kind: 'image', file: p.file, url: p.url, w: p.w, h: p.h }); // sent with the message
      return;
    }
    setPicked('loading');
    const up = await upload(as, p.file);
    if (!up.ok) return setPicked({ ...p, error: up.error });
    if (as === 'sticker') {
      const r = await request('sticker:add', { mediaId: up.value.id, send: false });
      if (!r.ok) return setPicked({ ...p, error: r.error });
      URL.revokeObjectURL(p.url);
      cancelPick();
      attachIt({ kind: 'sticker', id: r.value.id, src: r.value.src, w: r.value.w, h: r.value.h });
      return;
    }
    const r = await request('emoji:add', { name: naming, mediaId: up.value.id });
    if (!r.ok) return setPicked({ ...p, error: r.error });
    URL.revokeObjectURL(p.url);
    cancelPick();
  }

  return {
    attach,
    sending,
    setSending,
    attachIt,
    dropAttach,
    picked,
    choose,
    use,
    cancelPick,
    naming,
    nameError,
    /** The emoji's name, being typed (null: back to the choice). */
    setNaming: (v: string | null) => {
      setNaming(v);
      setNameError('');
    },
    /** « Emoji »: a name suggested from the file's. */
    nameIt: () => {
      if (picked && picked !== 'loading') {
        setNaming(
          suggestName(
            picked.file.name,
            custom.map(c => c.name),
          ),
        );
        setNameError('');
      }
    },
    stickers,
    setStickers,
  };
}
export type Attachments = ReturnType<typeof useAttachments>;
