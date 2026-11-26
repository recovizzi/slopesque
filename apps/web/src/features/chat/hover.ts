// The names behind a count ([data-names]: who reacted, who answered a poll's choice), in a small tip above it while it
// is hovered — anywhere in the panel, so once for the page (main.tsx). The tip only holds text. A reply's quoted
// message, whole, is the chat's own bubble (messages/Reply.tsx QuotePop).
import { bubbleAt } from '../../lib/floating';

export function wireTip() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  document.body.append(tip);
  document.addEventListener('pointerover', e => {
    const t = (e.target as Element).closest?.<HTMLElement | SVGElement>('[data-names]');
    if (!t || !t.dataset.names) {
      tip.hidden = true;
      return;
    }
    tip.textContent = t.dataset.names;
    tip.hidden = false;
    const at = bubbleAt(
      t.getBoundingClientRect(),
      { width: tip.offsetWidth, height: tip.offsetHeight },
      innerWidth,
      true,
    );
    Object.assign(tip.style, { left: `${at.left}px`, top: `${at.top}px` });
  });
  document.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });
}
