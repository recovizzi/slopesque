// The contract of an activity (openspec: refactor-architecture, design decision 1): what the room's core asks of each
// one — its state when a room is loaded, its part of the full state, what a change of activity cancels or continues,
// what a restart lost. The rest (its intents, its rules) stays in its own module, which depends on the RoomRegistry,
// never on the RoomHub.
import type { ActivityChoice, RoomState } from '@slopesque/shared';
import type { RoomRt } from './room-rt.js';

/** The activities (activities/activities.module.ts), in this order: « le tour du Demi-disque et la manche du Trou du
 *  cul sont annulés » follows it. */
export const ACTIVITIES = Symbol('ACTIVITIES');

export interface Activity {
  /** The activity it plays (an ActivityChoice's `activity`). */
  readonly key: ActivityChoice['activity'];
  /** Its slot in a room that starts being played (its first player since the server started), from the saved rules. */
  init?(rt: RoomRt): void;
  /** Right after every activity's init: what it takes back from the database, and what the restart lost if a round
   *  was running (« le sondage »: said once, in the chat and in a window), else null. */
  restore?(rt: RoomRt): Promise<string | null>;
  /** Its part of the room's full state (RoomState), as this player may see it. */
  view(rt: RoomRt, me: string): Partial<RoomState>;
  /** The room switches to `to` (another activity, or another card game): its running round is cancelled (what is
   *  lost, said in the chat) or goes on elsewhere (null; e.g. an open poll continues in the chat). */
  cancel?(rt: RoomRt, to: ActivityChoice): Promise<string | null>;
  /** The room switches to `to` (whichever activity it is), before it is saved and said: e.g. the Demi-disque's mode. */
  choose?(rt: RoomRt, to: ActivityChoice): Promise<void>;
  /** Once the switch is said (the « activity » event sent): e.g. the card table shown. */
  chosen?(rt: RoomRt, to: ActivityChoice): Promise<void>;
  /** « Réinitialiser la partie » while it is played: its ranking is back to zero, its own round starts again. */
  reset?(rt: RoomRt): Promise<void>;
  /** A player is away (his last connection gone, after the grace). None reacts yet: a seated card player keeps his
   *  seat until /kick. */
  left?(rt: RoomRt, id: string): Promise<void>;
}
