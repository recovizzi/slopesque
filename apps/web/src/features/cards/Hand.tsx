// My hand in a fan, as held at a real table: every card turns by its angle (--a) around the same point --r below the
// hand; hovered it comes up, chosen higher with an outline (cards.css). The fan fits the hand's width, measured before
// the cards are drawn — they take their place at once, nothing moves — and again when the panel is resized; a card
// that leaves, the others close up. The cards keep their id (`data-card`): the animations read where they are.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { cls } from '../../design';
import { fanOf, handAngle } from './model';

export interface HandCard {
  id: string;
  /** The card's face (a memoized component: the SVG isn't drawn again for nothing). */
  face: ReactNode;
  selected?: boolean;
  /** Can't be played (greyed). */
  off?: boolean;
  /** Just taken (the Tarot's chien): it glows. */
  fresh?: boolean;
}

/** The hand's width and a card's size (cards.css: --cw, --ch, smaller in a narrow panel); null until measured. */
function useHandSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ w: number; cw: number; ch: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const css = getComputedStyle(el),
        w = el.clientWidth,
        cw = parseFloat(css.getPropertyValue('--cw')) || 58,
        ch = parseFloat(css.getPropertyValue('--ch')) || 82;
      setSize(s => (s && s.w === w && s.cw === cw && s.ch === ch ? s : { w, cw, ch }));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref]);
  return size;
}

export function Hand({ cards, onPick }: { cards: HandCard[]; onPick: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null),
    size = useHandSize(ref),
    n = cards.length;
  const fan = size && fanOf(n, size.w, size.cw, size.ch);
  return (
    <div
      className="cg-hand"
      data-hand=""
      ref={ref}
      style={{ '--n': n, '--r': fan ? `${fan.r}px` : undefined } as CSSProperties}
    >
      {fan &&
        cards.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={cls('pcard in-hand', c.selected && 'is-selected', c.off && 'is-off', c.fresh && 'is-new')}
            data-action="card-pick"
            data-card={c.id}
            style={{ '--a': `${handAngle(i, n, fan.step)}rad` } as CSSProperties}
            aria-pressed={!!c.selected}
            onClick={() => onPick(c.id)}
          >
            {c.face}
          </button>
        ))}
    </div>
  );
}

const NONE: ReadonlySet<string> = new Set();
/** The cards I chose in my hand, forgotten as soon as `key` changes (a new turn, trick or deal). */
export function useSelection(key: string) {
  const [s, set] = useState({ key, ids: NONE });
  return [s.key === key ? s.ids : NONE, (ids: ReadonlySet<string>) => set({ key, ids })] as const;
}
