// Above the chat's field: the picture waiting to be sent (with a text, alone, or as a screamer), and the message being
// answered (✕: no longer a reply).
import type { MemberView, MessageView } from '@slopesque/shared';
import { cls, Icon, IconButton } from '../../../design';
import type { CustomEmoji } from '../../../lib/emoji';
import { quoteParts } from '../model';
import { Author, QuoteText } from '../messages/Reply';
import type { Attach } from './useAttachments';

const KIND = { image: 'Image', sticker: 'Sticker', gif: 'GIF' };
const thumb = (a: Attach) => (a.kind === 'gif' ? a.gif.url : a.kind === 'image' ? a.url : a.src);

export function AttachBar({ attach, sending, onDrop }: { attach: Attach; sending: boolean; onDrop: () => void }) {
  return (
    <div className={cls('attach-bar', sending && 'is-sending')}>
      <span className="attach-thumb">
        <img src={thumb(attach)} alt="" draggable={false} />
      </span>
      <span className="attach-text">
        <b>{KIND[attach.kind]}</b>
        <small>
          {sending ? 'Envoi…' : "Écris un texte pour l'accompagner (facultatif), puis Entrée — ou /effet screamer"}
        </small>
      </span>
      <IconButton icon="close" label="Retirer l'image" title="Retirer" size="sm" onClick={onDrop} />
    </div>
  );
}

export function ReplyBar(p: {
  m: MessageView;
  members: Map<string, MemberView>;
  me: string;
  custom: CustomEmoji[];
  onCancel: () => void;
}) {
  return (
    <div className="reply-bar">
      <Icon name="reply" />
      <span className="reply-who">
        Réponse à <Author id={p.m.from} members={p.members} me={p.me} />
      </span>
      <span className="reply-quote">
        <QuoteText parts={quoteParts(p.m)} custom={p.custom} />
      </span>
      <IconButton icon="close" label="Ne plus répondre" size="sm" onClick={p.onCancel} />
    </div>
  );
}
