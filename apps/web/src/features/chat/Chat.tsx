// The chat (openspec: chat-activity, data-retention): its lines (messages/), the panels and the field at its bottom
// (composer/), a picture dropped on it, the windows its commands open. In the left drawer, or filling the stage in the
// Chat activity. A note under it says what failed (to me only), 8 s.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MessageView } from '@slopesque/shared';
import { useStore } from '../../app/store';
import { cls, Icon } from '../../design';
import { loadCodes, type CustomEmoji, type EmojiPop } from '../../lib/emoji';
import { ChatModals } from './ChatModals';
import { Composer } from './composer/Composer';
import { ChatPanels } from './composer/Panels';
import { useAttachments } from './composer/useAttachments';
import type { ChatModal } from './composer/useSend';
import { setPickerCustom } from './emoji/picker';
import { MessageList } from './messages/MessageList';

export { People, PresenceIcon } from './People';

const NOTE_MS = 8000;

/** `pop`: not used any more (the chat opens the picker itself); app/App.tsx still passes it (task 3.6). */
export function Chat(_props: { pop?: EmojiPop | null }) {
  const emoji = useStore(s => s.room!.emoji),
    note = useStore(s => s.note),
    set = useStore(s => s.set);
  const custom: CustomEmoji[] = useMemo(() => emoji.map(e => ({ name: e.name, url: e.url, by: e.by ?? '' })), [emoji]);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useAttachments(inputRef, custom);
  const [replyTo, setReplyTo] = useState<MessageView | null>(null);
  const [modal, setModal] = useState<ChatModal>(null);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    void loadCodes();
  }, []);
  useEffect(() => setPickerCustom(custom), [custom]);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => set({ note: '' }), NOTE_MS);
    return () => clearTimeout(t);
  }, [note, set]);

  return (
    <div
      className={cls('chat-box', dropping && 'is-drop')}
      data-dropzone
      onDragOver={e => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
      }}
      onDrop={e => {
        e.preventDefault();
        setDropping(false);
        const f = e.dataTransfer.files[0];
        if (f) void files.choose(f);
      }}
    >
      <MessageList
        custom={custom}
        onReply={m => {
          setReplyTo(m);
          inputRef.current?.focus();
        }}
      />
      <ChatPanels files={files} />
      {note && <p className="chat-note">{note}</p>}
      <Composer
        inputRef={inputRef}
        files={files}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        custom={custom}
        onModal={setModal}
      />
      <div className="drop-hint" aria-hidden="true">
        <Icon name="file" />
        Dépose ton image
      </div>
      <ChatModals modal={modal} onModal={setModal} />
    </div>
  );
}
