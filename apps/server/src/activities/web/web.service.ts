// The integrations (openspec: define-game-concept, Intégrations): an external page played in the game's area (Low
// Tide first). The host saves its address, checked in his panel (the page declares the integration's name).
import { Injectable } from '@nestjs/common';
import { UserError } from '../../errors.js';
import type { Activity } from '../../rooms/activity.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';

@Injectable()
export class WebActivity implements Activity {
  readonly key = 'lowtide';

  constructor(private readonly rooms: RoomRegistry) {}

  /** Each integration's address (default: its own). */
  view(rt: RoomRt) { return { web: (rt.room.rules.web as Record<string, string> | undefined) ?? {} }; }

  async set(rt: RoomRt, me: string, integration: string, url: string) {
    this.rooms.hostOnly(rt, me);
    const u = new URL(url), local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
      throw new UserError('L\'adresse doit commencer par https:// (http:// seulement pour localhost).');
    }
    const web = { ...((rt.room.rules.web as Record<string, string> | undefined) ?? {}), [integration]: u.href };
    await this.rooms.saveRules(rt, 'web', web);
    this.rooms.emit(rt, { type: 'web', web });
    await this.rooms.say(rt, `Nouvelle adresse pour Low Tide : ${u.host}`);
  }
}
