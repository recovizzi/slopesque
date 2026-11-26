// Extension: the server, my rooms, the shortcut and « Rester ouvert sur toutes les pages », the theme, the versions.
import { useEffect, useState } from 'react';
import { isInsecureUrl, versionBelow } from '@slopesque/shared';
import { connect } from '../net';
import { useStore } from '../store';
import { EXT_VERSION } from '../version';
import { Button, Checkbox, Field, Note, Select, TextInput } from '../../design';
import * as X from '../../lib/ext';
import type { Device } from '../../lib/device';
import { RoomList } from '../../features/rooms/RoomList';
import { ServerField } from '../../features/rooms/ServerField';

export function ExtensionTab() {
  const device = useStore(s => s.device),
    setDevice = useStore(s => s.setDevice);
  return (
    <>
      <ServerField onSaved={() => connect()} />
      {isInsecureUrl(device.server) && (
        <Note tone="alert">
          Connexion non chiffrée : ton code et tes messages circulent en clair jusqu'à ce serveur.
        </Note>
      )}
      <RoomList />
      <ExtensionOptions />
      <Field label="Thème">
        <Select
          value={device.theme}
          onChange={v => setDevice({ theme: v as Device['theme'] })}
          options={[
            { value: 'auto', label: 'Système' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />
      </Field>
      <Versions />
    </>
  );
}

/** At the bottom of the tab: this extension's version in a bubble (and the server's, when connected). */
function Versions() {
  const v = useStore(s => s.versions);
  const behind = v && v.minExtension !== '?' && v.version !== '?' && versionBelow(EXT_VERSION, v.version);
  return (
    <div className="versions">
      <span className="version-bubble" title="Version de l'extension">
        Slopesque {EXT_VERSION}
      </span>
      {v && <span className="version-server">serveur {v.version}</span>}
      {behind && (
        <a className="version-new" href={v.download} target="_blank" rel="noopener noreferrer">
          Une version plus récente existe
        </a>
      )}
    </div>
  );
}

/** The shortcut (shown, changed: Firefox here, Chrome and Edge in their page) and « Rester ouvert sur toutes les
 *  pages » (off by default; the permission asked when turned on). */
function ExtensionOptions() {
  const [keys, setKeys] = useState(''),
    [persist, setPersist] = useState(false),
    [note, setNote] = useState(''),
    [edit, setEdit] = useState('');
  const refresh = () => {
    void X.shortcut().then(setKeys);
    void X.persistent().then(setPersist);
  };
  useEffect(() => {
    refresh();
    addEventListener('focus', refresh);
    return () => removeEventListener('focus', refresh);
  }, []);
  if (!X.inExtension()) return null;
  const change = async () => {
    try {
      await X.setShortcut(edit);
      setNote('');
      refresh();
    } catch {
      setNote('Raccourci refusé : par exemple Alt+Shift+S.');
    }
  };
  return (
    <>
      <Field as="div" label="Raccourci clavier">
        <Note>
          Ouvre et ferme le panneau : <b>{keys || 'aucun'}</b>
          {keys ? '' : " (le navigateur ne l'a pas attribué : un autre l'utilise déjà)"}.
        </Note>
        {X.canEditShortcut() ? (
          <form
            className="row"
            onSubmit={e => {
              e.preventDefault();
              void change();
            }}
          >
            <TextInput value={edit} onChange={e => setEdit(e.target.value)} placeholder="Alt+Shift+S" />
            <Button size="sm" type="submit">
              Changer
            </Button>
          </form>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => X.openShortcutsPage()}>
              Changer le raccourci
            </Button>
            <Note>
              Chrome et Edge le changent dans leur page des raccourcis (elle s'ouvre dans un onglet) ; reviens ici
              ensuite.
            </Note>
          </>
        )}
      </Field>
      <Checkbox
        label="Rester ouvert sur toutes les pages"
        checked={persist}
        onChange={async on => {
          setNote(await X.setPersistent(on));
          refresh();
        }}
      />
      <Note>
        Le panneau se rouvre sur chaque page, à la même place ; le fermer le ferme partout. Le navigateur demande
        l'accès à tous les sites à l'activation.
      </Note>
      {note && <Note tone="alert">{note}</Note>}
    </>
  );
}
