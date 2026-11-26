// Profil → Compte: my user code (hidden until I show it) and the button to change it (CodeModal.tsx).
import { useState } from 'react';
import { useStore } from '../../app/store';
import { Button, Field, Note } from '../../design';
import { CodeBox } from './CodeBox';

export function AccountSection({ onChange }: { onChange: () => void }) {
  const code = useStore(s => s.device.code);
  const [shown, setShown] = useState(false);
  return (
    <section className="account">
      <h3>Compte</h3>
      <Field
        as="div"
        label="Code utilisateur"
        help="Ton identité, sans mot de passe : tape-le sur un autre appareil pour y retrouver ton compte. Ne le donne à personne."
      >
        <CodeBox code={code} hidden={!shown} onToggle={() => setShown(!shown)} />
      </Field>
      <Button variant="danger-fill" className="code-change-btn" icon="key" onClick={onChange}>
        Changer de code utilisateur
      </Button>
      <Note tone="danger">
        Pour renouveler ton code en gardant ton compte (l'ancien code ne marchera plus), reprendre un compte existant
        (son code) ou repartir de zéro avec un compte vide.
      </Note>
    </section>
  );
}
