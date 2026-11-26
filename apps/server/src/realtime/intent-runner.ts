// How every gateway runs an intent of packages/shared/protocol.ts (openspec: realtime-sync): validated (zod), run, and
// answered by an acknowledgement { ok, value | error }; an error said to the player (UserError) or logged. Each module
// declares its own @SubscribeMessage handlers with it (refactor-architecture, design decision 1).
import { Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { intents, LIMITS, type Ack, type Intent, type IntentName, type IntentResults } from '@slopesque/shared';
import { CacheService } from '../cache/cache.service.js';
import { UserError } from '../errors.js';
import type { Account } from '../accounts/accounts.service.js';
import { RoomRegistry } from '../rooms/room-registry.js';
import type { RoomRt, SocketData } from '../rooms/room-rt.js';

type Limit = 'messages' | 'reactions' | 'effects' | 'joins' | 'gifs';
const SLOW_DOWN: Record<Limit, string> = { messages: 'Doucement : trop de messages.', reactions: 'Doucement : trop de réactions.',
  effects: 'Doucement : trop d\'effets.', joins: 'Trop de salons essayés : attends une minute.', gifs: 'Doucement : trop de recherches de GIF.' };

@Injectable()
export class IntentRunner {
  private readonly log = new Logger('Temps réel');

  constructor(private readonly cache: CacheService, private readonly rooms: RoomRegistry) {}

  /** Validates an intent, runs it, answers { ok, value } or { ok: false, error } (an unexpected error is logged). */
  async run<N extends IntentName>(name: N, body: unknown, fn: (v: Intent<N>) => Promise<IntentResults[N]>): Promise<Ack<IntentResults[N]>> {
    const v = intents[name].safeParse(body ?? {});
    if (!v.success) return { ok: false, error: 'Demande invalide.' };
    try { return { ok: true, value: await fn(v.data as Intent<N>) }; } catch (e) {
      if (e instanceof UserError) return { ok: false, error: e.message };
      this.log.error(`${name} : ${(e as Error).stack ?? e}`);
      return { ok: false, error: 'Erreur du serveur : réessaie.' };
    }
  }

  /** The same, for a player in a room (« Tu n'es dans aucun salon. » otherwise): his room and his account. */
  inRoom<N extends IntentName>(s: Socket, name: N, body: unknown, fn: (v: Intent<N>, rt: RoomRt, me: Account) => Promise<IntentResults[N]>) {
    return this.run(name, body, v => fn(v, this.rooms.roomOf(s), this.me(s)));
  }

  me(s: Socket) { return (s.data as SocketData).account; }

  /** The player's rate of messages, reactions, effects, rooms tried, GIF searches (LIMITS): over it, said to him. */
  async limit(s: Socket, what: Limit) {
    const l = LIMITS[what];
    if (!(await this.cache.allow(`${what}:${this.me(s).id}`, l.count, l.perMs))) throw new UserError(SLOW_DOWN[what]);
  }
}
