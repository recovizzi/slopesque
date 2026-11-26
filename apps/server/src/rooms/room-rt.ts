// A room being played, in memory (openspec: realtime-sync, design decision 4): who is connected, the numbered events,
// the vote open in the chat, and a slot per module for its own state (refactor-architecture, design decision 1).
import type { Vote } from '@slopesque/engines';
import type { Account } from '../accounts/accounts.service.js';
import type { Room } from './rooms.service.js';

export interface MemberRt { sockets: Set<string>; awaySince: number | null; grace: NodeJS.Timeout | null }

/** Each module's state in a room (an activity's round, the effects running…), under its own name. Empty here: every
 *  module adds its slot by augmenting this interface (`declare module '…/rooms/room-rt.js' { interface RoomSlots … }`),
 *  so the core never names an activity. An activity fills its slot in its `init`, when the room is loaded. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RoomSlots {}

export interface RoomRt {
  room: Room;
  seq: number;
  members: Map<string, MemberRt>;
  /** The vote open in the chat (one at a time per room). */
  vote: { id: number; v: Vote; timer: NodeJS.Timeout } | null;
  /** The server restarted during a game: it is lost, said in a window to whoever comes within 30 min. */
  notice: { id: string; title: string; text: string; at: number } | null;
  slots: RoomSlots;
}

export interface SocketData { account: Account; ip: string; roomId: string | null }
