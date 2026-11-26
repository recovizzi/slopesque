// The host builds the wheel (openspec: roulette-activity): a name and an optional weight per proposition, the share
// each one gets, and why it can't be launched yet (weights above 100, not a number…). Each change is sent at once:
// the others watch the wheel being built.
import type { CSSProperties } from 'react';
import { Wheel } from '@slopesque/engines';
import { Button, cls, IconButton, Note, TextInput } from '../../design';
import { editorNote, itemColor, pct, type WheelItem } from './model';

export function WheelEditor({ items, onChange }: { items: WheelItem[]; onChange: (items: WheelItem[]) => void }) {
  const sh = Wheel.shares(items),
    note = editorNote(items);
  const set = (i: number, part: Partial<WheelItem>) =>
    onChange(items.map((it, k) => (k === i ? { ...it, ...part } : it)));
  return (
    <div className="wheel-edit">
      <div className="wheel-head">
        <span>Proposition</span>
        <span>Poids</span>
        <span>Part</span>
      </div>
      <ol className="wheel-items">
        {items.map((it, i) => (
          <li key={i} style={{ '--c': itemColor(i) } as CSSProperties}>
            <span className="swatch" />
            <TextInput
              data-wh="label"
              data-i={i}
              value={it.label}
              maxLength={30}
              placeholder={`Proposition ${i + 1}`}
              autoComplete="off"
              aria-label={`Proposition ${i + 1}`}
              onChange={e => set(i, { label: e.target.value })}
            />
            <TextInput
              className={cls('weight', Number.isNaN(Wheel.weightOf(it.weight)) && 'is-bad')}
              data-wh="weight"
              data-i={i}
              value={it.weight}
              maxLength={5}
              inputMode="decimal"
              placeholder="auto"
              autoComplete="off"
              aria-label={`Poids de la proposition ${i + 1}`}
              onChange={e => set(i, { weight: e.target.value })}
            />
            <span className="share" data-share={i}>{`${pct(sh[i])} %`}</span>
            {items.length > Wheel.MIN_ITEMS ? (
              <IconButton
                icon="close"
                size="sm"
                label="Retirer"
                onClick={() => onChange(items.filter((_, k) => k !== i))}
              />
            ) : (
              <span className="icon-sp" />
            )}
          </li>
        ))}
      </ol>
      {items.length < Wheel.MAX_ITEMS && (
        <Button variant="ghost" size="sm" onClick={() => onChange([...items, { label: '', weight: '' }])}>
          + Ajouter une proposition
        </Button>
      )}
      {note && <Note tone={note.alert ? 'alert' : 'note'}>{note.text}</Note>}
    </div>
  );
}
