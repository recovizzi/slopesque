// The visual effects of /effet (openspec: chat-activity, Effets visuels), as they arrive from the server (its « fx »
// channel): each played on the layer over the game area. A new effect: a function of (layer, effect) here.
import type { EffectView } from '@slopesque/shared';
import { useStore } from '../store';
import { confetti } from './confetti';
import { firework } from './firework';
import { FxLayer, reduced, type Who } from './layer';
import { screamer, still } from './screamer';
import { hammer, hit, tomato } from './strike';
import './fx.css';

let layer: FxLayer | null = null;

/** His place at a card table, when the game is a card game and he sits there (his photo on the table). */
function seatAvatar(user: string) {
  const room = useStore.getState().room;
  if (room?.activity.activity !== 'cards') return null;
  const seat = room.cards.seats.find(s => s.user === user);
  const el = seat ? document.querySelector<HTMLElement>(`.cg-seat[data-seat="${CSS.escape(seat.id)}"] .avatar`) : null;
  return el && el.offsetParent !== null && el.getBoundingClientRect().width > 0 ? el : null;
}

const STILL: Record<EffectView['kind'], string> = { firework: '🎆', confetti: '🎊', hit: '🤜💥', tomato: '🍅', hammer: '🔨', screamer: '😱' };

export function playEffect(e: EffectView) {
  const room = useStore.getState().room;
  if (!room) return;
  layer ??= new FxLayer(seatAvatar);
  const m = e.target ? room.members.find(x => x.id === e.target) : null;
  const who: Who | null = m ? { id: m.id, name: m.name, hue: m.hue, photo: m.photo } : null;
  if (reduced()) { void still(layer, e.kind === 'screamer' && e.pic?.kind === 'emoji' ? e.pic.src : STILL[e.kind]); return; }
  if (e.kind === 'firework') void firework(layer);
  else if (e.kind === 'confetti') void confetti(layer, e.hue);
  else if (e.kind === 'screamer' && e.pic) void screamer(layer, e.pic);
  else if (who && e.kind === 'hit') void hit(layer, who);
  else if (who && e.kind === 'tomato') void tomato(layer, who);
  else if (who && e.kind === 'hammer') void hammer(layer, who);
}
