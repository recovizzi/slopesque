// The bottom of the chat: the picture waiting and the message answered (above the field), the field (its suggestions
// above it), « Envoyer », the « + » and the windows it opens (GIF, emoji). A picture can also be dropped on the chat.
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MessageView } from '@slopesque/shared';
import { useStore } from '../../../app/store';
import { IconButton } from '../../../design';
import type { CustomEmoji } from '../../../lib/emoji';
import { EmojiPicker } from '../emoji/EmojiPicker';
import { pickerOpening } from '../emoji/picker';
import { GifPicker } from '../gifs/GifPicker';
import { pushRecentGif, type Gif } from '../gifs/model';
import { AttachBar, ReplyBar } from './Bars';
import { PlusMenu } from './PlusMenu';
import { SuggestionList, useSuggestions } from './Suggestions';
import type { Attachments } from './useAttachments';
import { useDraft } from './useDraft';
import { useSend, type ChatModal } from './useSend';

export interface ComposerProps {
  inputRef: RefObject<HTMLInputElement | null>;
  files: Attachments;
  replyTo: MessageView | null;
  setReplyTo: (m: MessageView | null) => void;
  custom: CustomEmoji[];
  onModal: (m: ChatModal) => void;
}

export function Composer({ inputRef, files, replyTo, setReplyTo, custom, onModal }: ComposerProps) {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const [draft, setDraft] = useState(''),
    [menu, setMenu] = useState(false);
  const [gif, setGif] = useState<Element | null>(null),
    [emoji, setEmoji] = useState<Element | null>(null); // the windows open, next to the « + »
  const plusRef = useRef<HTMLButtonElement>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const suggestions = useSuggestions();
  const { send, command } = useSend({
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    files,
    custom,
    inputRef,
    onModal,
    hideSuggestions: suggestions.hide,
  });
  const typing = useDraft({
    draft,
    setDraft,
    inputRef,
    custom,
    suggestions,
    command,
    cancelReply: () => {
      if (!replyTo) return false;
      setReplyTo(null);
      return true;
    },
  });
  useEscapeChain(files, inputRef, menu || !!gif || !!emoji);

  const chooseGif = (g: Gif) => {
    const st = useStore.getState();
    st.setDevice({ gifRecent: pushRecentGif(st.device.gifRecent, g) });
    files.attachIt({ kind: 'gif', gif: g });
  };
  const members = new Map(room.members.map(m => [m.id, m]));

  return (
    <>
      {files.attach && <AttachBar attach={files.attach} sending={files.sending} onDrop={files.dropAttach} />}
      {replyTo && <ReplyBar m={replyTo} members={members} me={me} custom={custom} onCancel={() => setReplyTo(null)} />}
      <form className="chat-form" data-form="chat" onSubmit={e => void send(e)}>
        <input
          ref={inputRef}
          name="text"
          placeholder={
            files.attach
              ? "Un texte avec l'image (facultatif)…"
              : replyTo
                ? 'Ta réponse…'
                : 'Écrire un message… (/ pour les commandes)'
          }
          autoComplete="off"
          maxLength={500}
          value={draft}
          onChange={e => typing.onType(e.target.value)}
          onKeyDown={typing.onKey}
          onBlur={suggestions.hide}
        />
        <IconButton icon="send" label="Envoyer" type="submit" />
        <PlusMenu
          open={menu}
          onOpen={setMenu}
          plusRef={plusRef}
          onFile={() => fileRef.current?.click()}
          onSticker={() => {
            files.cancelPick();
            files.setStickers(!files.stickers);
          }}
          onGif={() => setGif(plusRef.current)}
          onEmoji={() => setEmoji(plusRef.current)}
        />
      </form>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void files.choose(f);
        }}
      />
      <SuggestionList list={suggestions} onChoose={typing.complete} />
      {gif && <GifPicker anchor={gif} onPick={chooseGif} onClose={() => setGif(null)} />}
      {emoji && <EmojiPicker anchor={emoji} keepOpen onPick={typing.insert} onClose={() => setEmoji(null)} />}
    </>
  );
}

/** Escape closes, one at a time, the file being sent, the stickers, then the picture waiting (from the field) — on
 *  the document, before the drawers and the panel itself (on `window`), but after an open menu or window (`busy`:
 *  the « + » menu, the GIF window, the emoji picker), which close first. */
function useEscapeChain(files: Attachments, inputRef: RefObject<HTMLInputElement | null>, busy: boolean) {
  const { picked, stickers, attach, cancelPick, setStickers, dropAttach } = files;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || busy || pickerOpening()) return;
      if (picked) cancelPick();
      else if (stickers) setStickers(false);
      else if (attach && document.activeElement === inputRef.current) dropAttach();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
}
