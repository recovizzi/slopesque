// The steps of the window to change my code (CodeModal.tsx): the way to choose, the code to type (its strength), the
// confirmation (what is kept, what is left, the code to note).
import type { ReactNode } from 'react';
import { CODE_MIN_LEN, codeStrength, newCode, tidyCode, type Strength } from '@slopesque/engines';
import { useStore } from '../../app/store';
import { Button, Checkbox, Choice, Field, Icon, ModalButtons, Note, TextInput } from '../../design';
import { OldCode } from './CodeBox';
import { SAMPLE_HINT, type CodeMode } from './model';

export function ChooseStep({ onChoose, back }: { onChoose: (m: CodeMode) => void; back: ReactNode }) {
  return (
    <>
      <Note>Ton code ouvre ton compte : garde ton compte avec un nouveau code, ou passe à un autre compte.</Note>
      <div className="code-choices">
        <Choice
          title="Renouveler mon code"
          help="Même compte, nouveau code : tout est gardé. L'ancien code ne marchera plus, nulle part."
          onClick={() => onChoose('renew')}
        />
        <Choice
          title="Reprendre un compte existant"
          help="Tu as déjà un code (sur un autre appareil) : tu retrouves ce compte."
          onClick={() => onChoose('resume')}
        />
        <Choice
          title="Repartir de zéro"
          help="Un nouveau code, un compte vide : pseudo, couleur, photos et résultats repartent de rien."
          onClick={() => onChoose('new')}
        />
      </div>
      <ModalButtons>{back}</ModalButtons>
    </>
  );
}

/** How hard the code is to guess: three bars, and why. */
const Meter = ({ s }: { s: Strength }) => (
  <>
    <div className={`code-meter lv-${s.level}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <Note tone={s.level < 2 ? 'alert' : 'note'} className="code-reason">
      {s.reason}
    </Note>
  </>
);

interface EditProps {
  mode: CodeMode;
  code: string;
  error: string;
  onCode: (code: string) => void;
  buttons: ReactNode;
}

export function EditStep({ mode, code, error, onCode, buttons }: EditProps) {
  return (
    <>
      <Field label={mode === 'resume' ? 'Code du compte à reprendre' : 'Ton nouveau code'}>
        <TextInput
          mono
          name="codeInput"
          value={code}
          onChange={e => onCode(e.target.value)}
          maxLength={48}
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoFocus
        />
      </Field>
      {mode === 'resume' ? (
        <Note>{SAMPLE_HINT}</Note>
      ) : (
        <>
          <Meter s={codeStrength(code)} />
          <Button variant="ghost" size="sm" icon="reset" onClick={() => onCode(newCode())}>
            Tirer un code au hasard
          </Button>
          <Note>
            {mode === 'renew' ? "Ton compte reste le même ; seul le code qui l'ouvre change. " : ''}Garde le code tiré
            au hasard, ou écris le tien : {CODE_MIN_LEN} lettres ou chiffres au moins, sans suite ni mot connu. Un code
            simple se devine, et qui le devine prend ton compte.
          </Note>
        </>
      )}
      {error && <Note tone="alert">{error}</Note>}
      {buttons}
    </>
  );
}

interface ConfirmProps {
  mode: CodeMode;
  first: boolean;
  code: string;
  found: string | null;
  noted: boolean;
  onNoted: (on: boolean) => void;
  error: string;
  back: ReactNode;
  busy: boolean;
}

export function ConfirmStep({ mode, first, code, found, noted, onNoted, error, back, busy }: ConfirmProps) {
  const account = useStore(s => s.account),
    current = useStore(s => s.device.code);
  const renew = mode === 'renew',
    chosen = tidyCode(code);
  const what = renew ? (
    <>
      <p>Ton compte garde tout : pseudo, couleur, photos, crédit social et palmarès. Seul son code change.</p>
      <p>
        <b>L'ancien code ne marchera plus</b>, sur aucun appareil : tape le nouveau sur tes autres appareils. Note-le :
      </p>
    </>
  ) : mode === 'resume' ? (
    <p>
      Tu reprends le compte <b>{found || 'sans pseudo'}</b> : son pseudo, sa couleur, ses photos et ses résultats
      remplacent les tiens sur cet appareil.
    </p>
  ) : first ? (
    <p>
      Ton compte sera créé avec le code <code>{chosen}</code>. <b>Note-le</b> : sur un autre appareil, il te rend ton
      compte.
    </p>
  ) : (
    <p>
      Tu crées un <b>compte vide</b> avec le code <code>{chosen}</code> : pseudo, couleur, photos, crédit social et
      palmarès repartent de zéro.
    </p>
  );
  const tick = (label: string) => <Checkbox name="codeNoted" label={label} checked={noted} onChange={onNoted} />;
  const leave = first ? null : renew ? (
    <>
      <OldCode code={chosen} />
      {tick("J'ai noté mon nouveau code")}
    </>
  ) : (
    <>
      <p>
        Tu quittes ton compte actuel{account ? ` (${account.name})` : ''}. <b>Note son code</b> si tu veux y revenir un
        jour : il ne sera plus affiché.
      </p>
      <OldCode code={current} />
      {tick("J'ai noté mon code actuel")}
    </>
  );
  return (
    <>
      <div className="code-warn">
        <Icon name="info" />
        <div>
          {what}
          {leave}
        </div>
      </div>
      {error && <Note tone="alert">{error}</Note>}
      <ModalButtons>
        {back}
        <Button
          type="submit"
          variant="danger-fill"
          disabled={(!first && !noted) || busy}
          title={
            !first && !noted ? `Coche d'abord « J'ai noté mon ${renew ? 'nouveau code' : 'code actuel'} »` : undefined
          }
        >
          {renew ? 'Renouveler mon code' : mode === 'resume' ? 'Reprendre ce compte' : 'Créer ce compte'}
        </Button>
      </ModalButtons>
    </>
  );
}
