// The /credit-social window (openspec: chat-activity, Crédit social): the players and their credit; one chosen (never
// oneself); − or + the amount typed, its hieroglyph on the button.
import { useState } from 'react';
import { amountOf, fmtCredit, MAX_CHANGE } from '@slopesque/engines';
import type { MemberView } from '@slopesque/shared';
import { request } from '../../app/net';
import { Avatar, Button, cls, Modal, Note } from '../../design';
import { CreditBadge, Glyph } from './Credit';

export function CreditModal({
  members,
  me,
  initial = null,
  onClose,
}: {
  members: MemberView[];
  me: string;
  initial?: string | null;
  onClose: () => void;
}) {
  const [to, setTo] = useState<string | null>(initial),
    [amount, setAmount] = useState('10'),
    [error, setError] = useState('');
  const n = amountOf(amount),
    target = members.find(p => p.id === to),
    ready = !!target && n !== null;
  const apply = async (sign: 1 | -1) => {
    if (!ready) return;
    const r = await request('credit:give', { to, delta: sign * n! });
    if (r.ok) onClose();
    else setError(r.error);
  };
  const change = (sign: 1 | -1) => (
    <Button
      className={cls('credit-apply', sign < 0 ? 'is-take' : 'is-give')}
      disabled={!ready}
      onClick={() => void apply(sign)}
      data-v={sign}
      title={ready ? `${sign < 0 ? 'Retirer' : 'Accorder'} ${n} à ${target!.name}` : 'Choisis un joueur et une valeur'}
    >
      {sign < 0 ? '−' : '+'}
      {n !== null && <Glyph delta={sign * n} />}
    </Button>
  );
  return (
    <Modal title="Crédit social" className="credit-modal" closeButton onClose={onClose}>
      <Note>
        Une valeur à part, sans effet sur les jeux, visible dans l'activité Chat. Chaque changement est dit dans le
        chat. On ne peut pas s'en donner soi-même.
      </Note>
      <ul className="credit-list">
        {members.map(p => {
          const mine = p.id === me;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={cls('credit-row', p.id === to && 'on')}
                disabled={mine}
                title={mine ? 'Impossible de se donner du crédit' : undefined}
                aria-pressed={p.id === to}
                onClick={() => {
                  setTo(p.id);
                  setError('');
                }}
              >
                <Avatar name={p.name} hue={p.hue} photo={p.photo} />
                <span className="credit-name">
                  {mine ? 'Toi' : p.name}
                  {mine && (
                    <>
                      {' '}
                      <i>(toi)</i>
                    </>
                  )}
                </span>
                <CreditBadge v={p.credit} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="credit-change">
        {change(-1)}
        <label className="credit-amount">
          <input
            name="creditAmount"
            inputMode="numeric"
            value={amount}
            maxLength={4}
            autoComplete="off"
            aria-label="Valeur"
            onChange={e => {
              setAmount(e.target.value);
              setError('');
            }}
          />
        </label>
        {change(1)}
      </div>
      {error ? (
        <Note tone="alert">{error}</Note>
      ) : !target ? (
        <Note>Choisis un joueur dans la liste.</Note>
      ) : n === null ? (
        <Note tone="alert">Un nombre entier de 1 à {MAX_CHANGE}.</Note>
      ) : (
        <Note>
          {target.name} : {fmtCredit(target.credit)}, puis {fmtCredit(target.credit - n)} avec −, ou{' '}
          {fmtCredit(target.credit + n)} avec +.
        </Note>
      )}
    </Modal>
  );
}
