// A room's key in a pill (the header, a room's page, the window to create one): a click copies it.
import { useState } from 'react';
import { cls, Icon } from '../../design';
import { copyText } from '../../lib/clipboard';

export function KeyBadge({ k, big }: { k: string; big?: boolean }) {
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const copy = async () => {
    setCopied((await copyText(k)) ? 'ok' : 'fail');
    setTimeout(() => setCopied(''), 1600);
  };
  return (
    <button
      className={cls('key-badge', big && 'big', copied && `is-${copied}`)}
      type="button"
      onClick={copy}
      title="Clé du salon : cliquer pour la copier"
      aria-label={`Copier la clé du salon ${k}`}
    >
      <Icon name="key" />
      <span>{copied === 'ok' ? 'Copiée ✓' : copied === 'fail' ? 'Copie impossible' : k}</span>
    </button>
  );
}
