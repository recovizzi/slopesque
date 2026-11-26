// The suggestions above the chat's field, while typing `:co` (emoji), `/` (the commands) or a command's arguments:
// ↑ ↓ to choose, Entrée or Tab to write it, Échap to leave (useDraft.ts), a click to take one (the focus stays in the
// field). Fixed above the field, as wide as it (320 px at most).
import { useState, type CSSProperties } from 'react';
import { cls } from '../../../design';
import type { Suggestion } from '../../../lib/emoji';

interface Shown {
  items: Suggestion[];
  index: number;
  style: CSSProperties;
}

export function useSuggestions() {
  const [shown, setShown] = useState<Shown | null>(null);
  return {
    shown,
    isOpen: shown !== null,
    current: shown ? shown.items[shown.index] : undefined,
    /** Above `field`; the same list as before keeps its choice. */
    show(items: Suggestion[], field: HTMLElement) {
      if (!items.length) return setShown(null);
      const r = field.getBoundingClientRect();
      const style = { left: r.left, width: Math.min(r.width, 320), bottom: innerHeight - r.top + 4 };
      setShown(old => ({
        items,
        index: old && old.items.map(i => i.code).join() === items.map(i => i.code).join() ? old.index : 0,
        style,
      }));
    },
    hide: () => setShown(null),
    move: (d: number) =>
      setShown(old => old && { ...old, index: (old.index + d + old.items.length) % old.items.length }),
  };
}
export type Suggestions = ReturnType<typeof useSuggestions>;

export function SuggestionList({ list, onChoose }: { list: Suggestions; onChoose: (s: Suggestion) => void }) {
  const s = list.shown;
  return (
    <ul className="emoji-suggest" role="listbox" hidden={!s} style={s?.style}>
      {s?.items.map((it, i) => (
        <li
          key={`${i}:${it.code}`}
          role="option"
          className={cls(i === s.index && 'on')}
          aria-selected={i === s.index}
          onMouseDown={e => {
            e.preventDefault(); // keeps the focus in the field
            onChoose(it);
          }}
        >
          {it.cmd !== undefined ? (
            <>
              <span className="sg-code">
                {it.arg ? '' : '/'}
                {it.code}
              </span>
              <span className="sg-hint">{it.cmd}</span>
            </>
          ) : (
            <>
              <span className="sg-emoji">
                {it.url ? <img className="emoji-custom" src={it.url} alt="" /> : it.emoji}
              </span>
              <span className="sg-code">:{it.code}:</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
