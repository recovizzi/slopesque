// HTML views ported from the maquette (lib/poll.ts, lib/wheel.ts: escaped strings with data-* attributes): redrawn
// when their HTML changes, keeping the focus and the caret of the field being typed in; clicks and inputs are read by
// delegation (data-action, data-poll, data-wh, data-i).
import { useLayoutEffect, useRef } from 'react';

function keyOf(a: Element) {
  const h = a as HTMLElement;
  if (h.dataset.poll) return `[data-poll="${h.dataset.poll}"]${h.dataset.i ? `[data-i="${h.dataset.i}"]` : ''}`;
  if (h.dataset.wh) return `[data-wh="${h.dataset.wh}"][data-i="${h.dataset.i}"]`;
  return null;
}

export function LiveHtml({ html, className, onAction, onInput }: { html: string; className?: string;
  onAction?: (action: string, el: HTMLElement, e: React.MouseEvent) => void; onInput?: (el: HTMLInputElement) => void }) {
  const ref = useRef<HTMLDivElement>(null), last = useRef('');
  useLayoutEffect(() => {
    const box = ref.current!;
    if (last.current === html) return;
    last.current = html;
    const a = document.activeElement, key = a instanceof HTMLInputElement && box.contains(a) ? keyOf(a) : null;
    const sel = key ? [(a as HTMLInputElement).selectionStart, (a as HTMLInputElement).selectionEnd] : null;
    box.innerHTML = html;
    const back = key ? box.querySelector<HTMLInputElement>(key) : null;
    if (back) { back.focus(); try { back.setSelectionRange(sel![0], sel![1]); } catch { /* not a text field */ } }
  });
  return <div ref={ref} className={className}
    onClick={e => { const el = (e.target as Element).closest<HTMLElement>('[data-action]'); if (el && onAction) onAction(el.dataset.action!, el, e); }}
    onInput={e => { if (e.target instanceof HTMLInputElement && onInput) onInput(e.target); }} />;
}
