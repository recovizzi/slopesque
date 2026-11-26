// The social credit (openspec: chat-activity, Crédit social): a hieroglyph by step (PNG masks in hieroglyphs/, coloured
// by the theme), a player's badge, a change said in the chat. The /credit-social window: CreditModal.tsx.
import type { CSSProperties } from 'react';
import { creditWord, fmtCredit, tierOf } from '@slopesque/engines';
import type { MemberView } from '@slopesque/shared';
import h1301d from './hieroglyphs/1301d.png';
import h13013 from './hieroglyphs/13013.png';
import h1300f from './hieroglyphs/1300f.png';
import h13012 from './hieroglyphs/13012.png';
import h13020 from './hieroglyphs/13020.png';
import h13024 from './hieroglyphs/13024.png';
import h1304f from './hieroglyphs/1304f.png';
import h1302d from './hieroglyphs/1302d.png';
import { cls, Who } from '../../design';

const SRC: Record<string, string> = {
  '1301d': h1301d,
  '13013': h13013,
  '1300f': h1300f,
  '13012': h13012,
  '13020': h13020,
  '13024': h13024,
  '1304f': h1304f,
  '1302d': h1302d,
};
const side = (delta: number) => (delta < 0 ? 'is-take' : 'is-give');

/** The hieroglyph of a change: its step (said by its name), given or taken. */
export function Glyph({ delta }: { delta: number }) {
  const t = tierOf(delta);
  return (
    <span
      className={cls('hiero', side(delta))}
      style={{ '--src': `url('${SRC[t.code]}')` } as CSSProperties}
      role="img"
      aria-label={`${String.fromCodePoint(parseInt(t.code, 16))} ${t.name}`}
      title={t.name}
      data-glyph={t.code}
    />
  );
}

export const CreditBadge = ({ v }: { v: number }) => (
  <span
    className={cls('credit-badge', v < 0 && 'neg', v > 0 && 'pos')}
    title="Crédit social (/credit-social pour le changer)"
  >
    {fmtCredit(v)}
  </span>
);

/** A change in the chat: who, the hieroglyph and the amount, to whom; then the same in words. */
export function CreditCard({
  data,
  members,
  me,
}: {
  data: { by: string; to: string; delta: number };
  members: Map<string, MemberView>;
  me: string;
}) {
  const name = (id: string) => (id === me ? 'Toi' : (members.get(id)?.name ?? '?'));
  const who = (id: string) => {
    const m = members.get(id);
    return m ? <Who name={name(id)} hue={m.hue} /> : <b>?</b>;
  };
  const n = Math.abs(data.delta);
  return (
    <>
      <div className={cls('credit-card', side(data.delta))}>
        <span className="credit-who">{who(data.by)}</span>
        <span className="credit-act">
          <Glyph delta={data.delta} />
          <b className="credit-delta">{fmtCredit(data.delta)}</b>
        </span>
        <span className="credit-who">{who(data.to)}</span>
      </div>
      <p className="credit-line">
        {name(data.by)} {data.delta < 0 ? 'retire' : 'accorde'} {creditWord(n)} à {name(data.to)} ·{' '}
        {tierOf(data.delta).name}
      </p>
    </>
  );
}
