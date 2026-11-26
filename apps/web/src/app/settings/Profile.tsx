// Profil: my photo in this room, my pseudo, my colour (a rainbow slider: applied 3 s after the last move, refused too
// close to another player's), my double-click reaction, then Compte (the user code).
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { hueColor, hueDistance, MIN_HUE_GAP, RAINBOW } from '@slopesque/engines';
import type { MemberView } from '@slopesque/shared';
import { request } from '../net';
import { useStore } from '../store';
import { PhotoField } from './PhotoField';
import { Field, RichText, TextInput } from '../../design';
import { AccountSection } from '../../features/account/AccountSection';
import { codeOf, THUMBS_UP, type EmojiPop } from '../../lib/emoji';

type Changes = { name?: string; hue?: number; quick?: string };

async function save(p: Changes) {
  const r = await request('profile:update', p);
  if (r.ok) useStore.getState().set({ account: r.value });
  else useStore.getState().set({ note: r.error });
}

export function Profile({ pop, onCode }: { pop: EmojiPop | null; onCode: () => void }) {
  const account = useStore(s => s.account),
    room = useStore(s => s.room);
  const [name, setName] = useState(account?.name ?? '');
  useEffect(() => {
    // the account arrives after
    if (document.activeElement?.getAttribute('name') !== 'pseudo') setName(account?.name ?? '');
  }, [account?.name]);
  if (!account) return null;
  const me = room?.members.find(m => m.id === account.id);
  const others = room?.members.filter(m => m.id !== account.id) ?? [];
  return (
    <>
      <PhotoField />
      <Field label="Pseudo">
        <TextInput
          name="pseudo"
          value={name}
          maxLength={20}
          onChange={e => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== account.name) void save({ name: name.trim() });
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </Field>
      <HueField hue={me?.hue ?? account.hue ?? 222} others={others} />
      <QuickField quick={account.quick || THUMBS_UP} pop={pop} />
      <AccountSection onChange={onCode} />
    </>
  );
}

/** My colour: the whole rainbow, the other players' colours marked under it. */
function HueField({ hue, others }: { hue: number; others: MemberView[] }) {
  const [moving, setMoving] = useState<number | null>(null),
    [note, setNote] = useState('');
  const timer = useRef(0);
  const close = (h: number) => others.find(m => hueDistance(m.hue, h) < MIN_HUE_GAP);
  const shown = moving ?? hue;
  const pos = (v: number) => `calc(11px + (100% - 22px) * ${(v / 359).toFixed(4)})`;
  const move = (h: number) => {
    const other = close(h);
    setMoving(h);
    setNote(other ? `Trop proche de la couleur de ${other.name}.` : 'Appliquée dans 3 secondes…');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const near = close(h);
      if (near) setNote(`Trop proche de ${near.name} : couleur inchangée.`);
      else {
        void save({ hue: h });
        setNote('');
      }
      setMoving(null);
    }, 3000);
  };
  return (
    <Field as="div" label="Couleur" help={note}>
      <div className="hue" style={{ '--h': shown } as CSSProperties}>
        <input
          type="range"
          className="hue-range"
          min={0}
          max={359}
          step={1}
          value={shown}
          style={{ background: RAINBOW }}
          aria-label="Couleur"
          onChange={e => move(+e.target.value)}
        />
        <div className="hue-marks">
          {others.map(m => (
            <span
              key={m.id}
              className="hue-mark"
              style={{ left: pos(m.hue), '--c': hueColor(m.hue) } as CSSProperties}
              title={m.name}
            />
          ))}
        </div>
      </div>
    </Field>
  );
}

/** My reaction to a double click on a message: a standard emoji (a custom one exists only in its room). */
function QuickField({ quick, pop }: { quick: string; pop: EmojiPop | null }) {
  const [note, setNote] = useState('');
  return (
    <Field
      as="div"
      label="Réaction au double-clic"
      help={note ? <b>{note}</b> : 'Double-clique sur un message pour réagir avec cet emoji.'}
    >
      <button
        className="quick-btn"
        type="button"
        onClick={ev =>
          void pop?.open(ev.currentTarget, e => {
            if (e.startsWith(':'))
              setNote("Choisis un emoji standard : un emoji personnalisé n'existe que dans son salon.");
            else {
              setNote('');
              void save({ quick: e });
            }
          })
        }
        title="Changer d'emoji"
      >
        <span className="quick-emoji">
          <RichText text={quick} links={false} />
        </span>
        {codeOf(quick) && <code>:{codeOf(quick)}:</code>}
        <small>Changer</small>
      </button>
    </Field>
  );
}
