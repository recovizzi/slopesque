// /effet (openspec: chat-activity, Effets visuels): an effect on everyone's screen, now, not kept — checked (who, how
// many at once), its picture resolved (a screamer's image is relayed, never stored), sent on the « fx » channel
// (outside the numbered events: a missed one is not replayed).
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EFFECT_MS, EFFECT_PARALLEL, ON_PHOTO, type EffectKind, type EffectView } from '@slopesque/shared';
import { RoomLibrary } from '../../chat/library.service.js';
import { UserError } from '../../errors.js';
import { RoomRegistry } from '../../rooms/room-registry.js';
import type { RoomRt } from '../../rooms/room-rt.js';

/** The end of each effect running, by group (the photo effects count together). */
declare module '../../rooms/room-rt.js' { interface RoomSlots { fx?: Record<string, number[]> } }

type EffectPic = { kind: 'image' | 'sticker' | 'gif' | 'emoji'; value: string };

@Injectable()
export class Effects {
  constructor(private readonly rooms: RoomRegistry, private readonly library: RoomLibrary) {}

  async play(rt: RoomRt, me: string, v: { kind: EffectKind; target?: string | null; pic?: EffectPic }) {
    const now = Date.now(), fx = rt.slots.fx ??= {};
    const photo = ON_PHOTO.includes(v.kind), group = photo ? 'photo' : v.kind;
    const target = v.target ? (await this.rooms.members(rt, v.target))[0] : null;
    if (v.target && !target) throw new UserError('Ce joueur n\'est pas dans le salon.');
    if (photo && !target) throw new UserError(`/effet ${v.kind} vise un joueur : par exemple /effet ${v.kind} Léa.`);
    const running = (fx[group] ?? []).filter(end => end > now), max = EFFECT_PARALLEL[v.kind] ?? 1;
    if (running.length >= max) {
      throw new UserError(photo ? 'Un effet est déjà en cours sur une photo : attends sa fin.' : v.kind === 'screamer' ? 'Un screamer est déjà affiché : attends sa fin.'
        : `${max} ${v.kind === 'firework' ? 'feux d\'artifice' : 'salves de confettis'} sont déjà en cours : attends un instant.`);
    }
    const pic = v.kind === 'screamer' ? await this.screamer(rt, v.pic) : null;
    fx[group] = [...running, now + EFFECT_MS[v.kind]];
    const effect: EffectView = { id: randomUUID(), kind: v.kind, by: me, target: target?.id ?? null, hue: target?.hue ?? null, pic };
    this.rooms.to(rt).emit('fx', effect);
  }

  /** A screamer's picture: an image (relayed once, never stored), a sticker or an emoji of the room, a GIF of KLIPY or GIPHY. */
  private async screamer(rt: RoomRt, p: EffectPic | undefined): Promise<EffectView['pic']> {
    if (!p) throw new UserError('Choisis une image, un sticker, un GIF ou un emoji.');
    if (p.kind === 'image') {
      if (!/^data:image\/(webp|png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(p.value) || p.value.length > 700_000) throw new UserError('Image refusée : trop lourde ou d\'un format inconnu.');
      return { kind: 'image', src: p.value };
    }
    if (p.kind === 'sticker') {
      const st = (await this.library.stickers(rt)).find(x => x.id === p.value);
      if (!st) throw new UserError('Ce sticker n\'est plus dans le salon.');
      return { kind: 'image', src: st.src };
    }
    if (p.kind === 'gif') {
      let host = '';
      try { const u = new URL(p.value); host = u.protocol === 'https:' ? u.hostname : ''; } catch { /* not an address */ }
      if (!/(^|\.)(klipy\.com|giphy\.com)$/.test(host)) throw new UserError('GIF refusé : il doit venir de KLIPY ou GIPHY.');
      return { kind: 'image', src: p.value };
    }
    if (p.value.startsWith(':')) {
      const e = (await this.library.emoji(rt)).find(x => `:${x.name}:` === p.value);
      if (!e) throw new UserError('Cet emoji n\'existe pas dans le salon.');
      return { kind: 'image', src: e.url };
    }
    if (p.value.length > 32 || /[<>&"]/.test(p.value)) throw new UserError('Emoji refusé.');
    return { kind: 'emoji', src: p.value };
  }
}
