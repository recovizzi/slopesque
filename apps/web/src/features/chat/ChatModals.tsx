// The windows the chat's commands open: /activity (the kinds of activity, then their format) and /credit-social.
import type { Vote } from '@slopesque/engines';
import { useStore } from '../../app/store';
import { ActivityPicker } from '../activity-picker/ActivityPicker';
import { CreditModal } from '../credit/CreditModal';
import { chooseActivity } from './actions';
import type { ChatModal } from './composer/useSend';

type Props = { modal: ChatModal; onModal: (m: ChatModal) => void };

/** Nothing (and no reading of the room) while no window is asked. */
export const ChatModals = (p: Props) => (p.modal ? <Modals {...p} /> : null);

function Modals({ modal, onModal }: Props) {
  const room = useStore(s => s.room)!,
    me = useStore(s => s.account)!.id;
  const close = () => onModal(null);
  if (modal?.kind === 'activity')
    return (
      <ActivityPicker
        kind={modal.at}
        current={room.activity.activity}
        host={room.hostId === me}
        busy={room.chat.messages.some(m => m.kind === 'vote' && !(m.data?.vote as Vote | undefined)?.result)}
        onKind={k => onModal({ kind: 'activity', at: k })}
        onPick={c => {
          close();
          void chooseActivity(c);
        }}
        onClose={close}
      />
    );
  if (modal?.kind === 'credit')
    return <CreditModal members={room.members} me={me} initial={modal.to ?? null} onClose={close} />;
  return null;
}
