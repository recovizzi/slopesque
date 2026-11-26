// ?kit: the controls — Button, LinkButton, IconButton, Field, TextInput, Select, Checkbox, Segmented, Tabs.
import { useState } from 'react';
import { Button, LinkButton } from '../Button';
import { Checkbox } from '../Checkbox';
import { Field } from '../Field';
import { IconButton } from '../IconButton';
import { Segmented } from '../Segmented';
import { Select } from '../Select';
import { Tabs } from '../Tabs';
import { TextInput } from '../TextInput';
import { Section } from './Section';

const KINDS = [
  { value: 'choices', label: 'Choix définis' },
  { value: 'free', label: 'Choix libre' },
  { value: 'gradient', label: 'Gradient' },
] as const;
const THEMES = [
  { value: 'auto', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export function KitControls() {
  const [kind, setKind] = useState<'choices' | 'free' | 'gradient'>('choices');
  const [tab, setTab] = useState<'profile' | 'extension' | 'game'>('profile');
  const [left, setLeft] = useState<'chat' | 'ranking' | 'palmares'>('chat');
  const [checked, setChecked] = useState(true),
    [theme, setTheme] = useState('auto'),
    [name, setName] = useState('Léa');
  return (
    <>
      <Section title="Button">
        {(['md', 'sm', 'big'] as const).map(size => (
          <div key={size} className="kit-row">
            <Button size={size}>Valider</Button>
            <Button size={size} variant="ghost">
              Annuler
            </Button>
            <Button size={size} variant="danger" icon="reset">
              Réinitialiser
            </Button>
            <Button size={size} variant="danger-fill">
              Renouveler
            </Button>
            <Button size={size} icon="camera">
              Avec icône
            </Button>
            <Button size={size} disabled>
              Désactivé
            </Button>
          </div>
        ))}
        <div className="kit-row">
          <LinkButton href="https://example.org" external variant="ghost" size="sm">
            Lien en bouton
          </LinkButton>
        </div>
      </Section>
      <Section title="IconButton">
        <div className="kit-row">
          <IconButton icon="sidebar" label="Joueurs" />
          <IconButton icon="close" label="Fermer" />
          <IconButton icon="send" label="Envoyer" />
          <IconButton icon="close" label="Fermer" size="sm" />
          <IconButton icon="crown" label="Donner le rôle d'hôte" size="sm" />
        </div>
      </Section>
      <Section title="Field, TextInput, Select, Checkbox, Segmented">
        <div className="kit-col">
          <Field label="Pseudo">
            <TextInput value={name} maxLength={20} onChange={e => setName(e.target.value)} />
          </Field>
          <Field as="div" label="Serveur" help="L'adresse du serveur de ton groupe.">
            <TextInput placeholder="http://localhost:23100" />
          </Field>
          <Field as="div" label="Clé du salon" error="Une clé a la forme XXXX-XXXX.">
            <TextInput mono placeholder="XXXX-XXXX" />
          </Field>
          <Field label="Thème">
            <Select value={theme} onChange={setTheme} options={THEMES} />
          </Field>
          <Checkbox label="Rester ouvert sur toutes les pages" checked={checked} onChange={setChecked} />
          <Checkbox label="Désactivée" checked={false} disabled />
          <Field as="div" label="Type de réponse">
            <Segmented value={kind} onChange={setKind} label="Type de réponse" options={[...KINDS]} />
          </Field>
        </div>
      </Section>
      <Section title="Tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'profile', label: 'Profil' },
            { id: 'extension', label: 'Extension' },
            { id: 'game', label: 'Partie' },
          ]}
        >
          <IconButton icon="close" label="Fermer" />
        </Tabs>
        <Tabs
          value={left}
          onChange={setLeft}
          tabs={[
            { id: 'chat', label: 'Chat', icon: 'chat' },
            { id: 'ranking', label: 'Classement', icon: 'trophy' },
            { id: 'palmares', label: 'Palmarès', icon: 'chart' },
          ]}
        />
      </Section>
    </>
  );
}
