// The app's state: the device's settings, the connection, my account, the room I'm in (its full state, then the
// numbered events applied in order; a gap asks for the full state again).
import { create } from 'zustand';
import type { AccountView, ChatPage, FatalReason, MemberView, MessageView, RoomState, SequencedEvent } from '@slopesque/shared';
import { saveDevice, type Device } from './lib/device';

export type Conn = 'idle' | 'connecting' | 'ok' | 'reconnecting' | 'offline';
/** Why the room isn't shown: loading, no room chosen, pending (an admin must create it), unknown key, server down. */
export type RoomStatus = 'none' | 'loading' | 'ok' | 'pending' | 'unknown' | 'offline';

interface State {
  device: Device;
  conn: Conn;
  fatal: FatalReason | null;
  insecure: boolean;
  account: AccountView | null;
  room: RoomState | null;
  roomStatus: RoomStatus;
  clockSkew: number;                     // server time − my time (ms)
  note: string;                          // a short message under the chat (an error of mine)
  setDevice(p: Partial<Device>): void;
  set(p: Partial<Omit<State, 'set' | 'setDevice' | 'apply' | 'prependPage'>>): void;
  apply(e: SequencedEvent): 'ok' | 'gap';
  prependPage(p: ChatPage): void;
}

const upsertMember = (list: MemberView[], m: MemberView) => (list.some(x => x.id === m.id) ? list.map(x => (x.id === m.id ? m : x)) : [...list, m]);
const mapMessage = (list: MessageView[], id: number, f: (m: MessageView) => MessageView) => list.map(m => (m.id === id ? f(m) : m));

export const useStore = create<State>((set, get) => ({
  device: { code: '', server: '', theme: 'auto', roomKey: '', recent: [], gifRecent: [] },
  conn: 'idle', fatal: null, insecure: false, account: null, room: null, roomStatus: 'none', clockSkew: 0, note: '',
  setDevice: p => { const device = { ...get().device, ...p }; set({ device }); void saveDevice(device); },
  set: p => set(p),
  apply: e => {
    const room = get().room;
    if (!room || e.seq <= room.seq) return 'ok';
    if (e.seq !== room.seq + 1) return 'gap';
    const next: RoomState = { ...room, seq: e.seq };
    if (e.type === 'message') next.chat = { ...room.chat, messages: room.chat.messages.some(m => m.id === e.message.id) ? room.chat.messages : [...room.chat.messages, e.message] };
    else if (e.type === 'message-removed') next.chat = { ...room.chat, messages: room.chat.messages.filter(m => m.id !== e.id) };
    else if (e.type === 'reactions') next.chat = { ...room.chat, messages: mapMessage(room.chat.messages, e.id, m => ({ ...m, reactions: e.reactions })) };
    else if (e.type === 'member') next.members = upsertMember(room.members, e.member);
    else if (e.type === 'host') next.hostId = e.hostId;
    else if (e.type === 'message-updated') next.chat = { ...room.chat, messages: mapMessage(room.chat.messages, e.message.id, () => e.message) };
    else if (e.type === 'stickers') next.stickers = e.stickers;
    else if (e.type === 'emoji') next.emoji = e.emoji;
    else if (e.type === 'activity') next.activity = e.activity;
    set({ room: next });
    return 'ok';
  },
  prependPage: p => {
    const room = get().room;
    if (!room) return;
    const known = new Set(room.chat.messages.map(m => m.id));
    set({ room: { ...room, chat: { messages: [...p.messages.filter(m => !known.has(m.id)), ...room.chat.messages], hasMore: p.hasMore, start: p.start } } });
  },
}));
