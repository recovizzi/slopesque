// Two hover helpers of the maquette (app.ts wireTip, wireQuotes): the names behind a count ([data-names]: who reacted,
// who answered) in a small tip, and a reply's quoted message, whole, in a bubble above its quote.
const place = (el: HTMLElement, r: DOMRect, centre: boolean) => {
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = `${Math.max(4, Math.min(innerWidth - w - 4, centre ? r.left + r.width / 2 - w / 2 : r.left))}px`;
  el.style.top = `${r.top - h - 6 < 4 ? r.bottom + 6 : r.top - h - 6}px`;
};

/** Once for the page: hovering anything with data-names shows them. */
export function wireTip() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  document.body.append(tip);
  document.addEventListener('pointerover', e => {
    const t = (e.target as Element).closest?.<HTMLElement | SVGElement>('[data-names]');
    if (!t || !t.dataset.names) { tip.hidden = true; return; }
    tip.textContent = t.dataset.names;
    tip.hidden = false;
    place(tip, t.getBoundingClientRect(), true);
  });
  document.addEventListener('pointerleave', () => { tip.hidden = true; });
}

/** In a chat: hovering a reply's quote (.reply-ref[data-msg]) shows the message quoted (`html` of its id). */
export function wireQuotes(root: HTMLElement, html: (id: number) => string) {
  const pop = document.createElement('div');
  pop.className = 'quote-pop';
  pop.hidden = true;
  document.body.append(pop);
  const over = (e: PointerEvent) => {
    const ref = (e.target as Element).closest?.<HTMLElement>('.reply-ref[data-msg]');
    if (!ref) { pop.hidden = true; return; }
    pop.innerHTML = html(+ref.dataset.msg!);
    pop.hidden = false;
    place(pop, ref.getBoundingClientRect(), false);
  };
  const out = () => { pop.hidden = true; };
  root.addEventListener('pointerover', over);
  root.addEventListener('pointerleave', out);
  return () => { root.removeEventListener('pointerover', over); root.removeEventListener('pointerleave', out); pop.remove(); };
}
