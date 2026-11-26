// The window to change my code (openspec: player-account): choose a way (renew my code, take back an account, start
// again), type or draw the code (its strength said), the server checks it, then a confirmation — the code to note
// ticked first when an account is left behind. `first`: from the first launch (no account to leave yet).
import { useState, type FormEvent, type ReactNode } from 'react';
import { newCode, tidyCode } from '@slopesque/engines';
import { checkCode, connect, request } from '../../app/net';
import { useStore } from '../../app/store';
import { Button, Modal, ModalButtons } from '../../design';
import { checkError, codeReady, codeTitle, sameCode, type CodeMode } from './model';
import { ChooseStep, ConfirmStep, EditStep } from './CodeSteps';

export type { CodeMode } from './model';

export interface CodeModalProps {
  first: boolean;
  start: CodeMode | null;
  onClose: () => void;
  onDone: () => void;
}

export function CodeModal({ first, start, onClose, onDone }: CodeModalProps) {
  const { device, setDevice, set } = useStore();
  const [mode, setMode] = useState<CodeMode | null>(start);
  // the first launch keeps the code drawn on the welcome page; after a replaced code (fatal), a new one is drawn
  const [code, setCode] = useState(() =>
    start === 'new' && first && !useStore.getState().fatal
      ? device.code || newCode()
      : start && start !== 'resume'
        ? newCode()
        : '',
  );
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [noted, setNoted] = useState(false);
  const choose = (m: CodeMode | null) => {
    setMode(m);
    setStep('edit');
    setError('');
    setNoted(false);
    setCode(m === 'new' || m === 'renew' ? newCode() : '');
  };

  const backTo =
    step === 'confirm'
      ? () => {
          setStep('edit');
          setNoted(false);
        }
      : mode && !first
        ? () => choose(null)
        : onClose;
  const back = (
    <Button variant="ghost" onClick={backTo}>
      {backTo === onClose ? 'Annuler' : 'Retour'}
    </Button>
  );

  /** The confirmation accepted: the code saved (renewed by the server first), the account opened with it. */
  async function confirm(chosen: string) {
    if (mode === 'renew') {
      setBusy(true);
      const r = await request('account:renew', { code: chosen });
      setBusy(false);
      if (!r.ok) {
        setError(r.error);
        setStep('edit');
        return;
      }
      setDevice({ code: chosen });
      return onDone();
    }
    setDevice({ code: chosen });
    if (mode === 'new' && !first) set({ room: null, roomStatus: 'none' });
    connect(); // the server finds (or makes) the account of this code
    onDone();
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    if (!mode || busy) return;
    if (step === 'confirm') {
      if (first || noted) await confirm(tidyCode(code));
      return;
    }
    setError('');
    if (!first && sameCode(code, device.code)) return setError("C'est déjà ton code.");
    if (!codeReady(mode, code)) return;
    setBusy(true);
    const r = await checkCode(device.server, code, mode === 'resume');
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const why = checkError(r.value, mode);
    if (why) return setError(why);
    setFound(r.value.name);
    setStep('confirm');
  }

  let body: ReactNode;
  if (mode === null) body = <ChooseStep onChoose={choose} back={back} />;
  else if (step === 'edit')
    body = (
      <EditStep
        mode={mode}
        code={code}
        error={error}
        onCode={c => {
          setCode(c);
          setError('');
        }}
        buttons={
          <ModalButtons>
            {back}
            <Button type="submit" disabled={!codeReady(mode, code) || busy}>
              {busy ? 'Vérification…' : 'Continuer'}
            </Button>
          </ModalButtons>
        }
      />
    );
  else
    body = (
      <ConfirmStep
        mode={mode}
        first={first}
        code={code}
        found={found}
        noted={noted}
        onNoted={setNoted}
        error={error}
        back={back}
        busy={busy}
      />
    );
  return (
    <Modal as="form" className="code-modal" title={codeTitle(mode, first)} onClose={onClose} onSubmit={next}>
      {body}
    </Modal>
  );
}
