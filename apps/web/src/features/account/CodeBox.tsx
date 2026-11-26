// A user code in its box: shown (or hidden behind dots, with an eye to show it), and a button to copy it.
import { useState } from 'react';
import { Button, cls, IconButton } from '../../design';
import { copyText } from '../../lib/clipboard';

export function CodeBox({ code, hidden, onToggle }: { code: string; hidden?: boolean; onToggle?: () => void }) {
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const show = hidden === undefined || !hidden;
  const copy = async () => {
    setCopied((await copyText(code)) ? 'ok' : 'fail');
    setTimeout(() => setCopied(''), 1600);
  };
  return (
    <div className="code-box">
      <code className={cls('code-text', !show && 'is-hidden')}>{show ? code : code.replace(/[A-Z0-9]/g, '•')}</code>
      {onToggle && (
        <IconButton
          icon={show ? 'eyeOff' : 'eye'}
          size="sm"
          label={show ? 'Masquer le code' : 'Afficher le code'}
          title={show ? 'Masquer' : 'Afficher'}
          aria-pressed={show}
          onClick={onToggle}
        />
      )}
      <Button variant="ghost" size="sm" onClick={copy}>
        {copied === 'ok' ? 'Copié ✓' : copied === 'fail' ? 'Copie impossible' : 'Copier'}
      </Button>
    </div>
  );
}

/** The old code, or the new one, in a plain box (the confirmation). */
export const OldCode = ({ code }: { code: string }) => (
  <div className="code-box is-old">
    <code className="code-text">{code}</code>
  </div>
);
