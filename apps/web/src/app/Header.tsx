// The panel's header: the players' drawer, the logo, the connection's state (reconnecting, not encrypted), the room's
// key, my avatar (Profil and settings), the close button of the embedded panel.
import { useStore } from './store';
import { APP_NAME } from './version';
import { Avatar, Badge, IconButton } from '../design';
import { KeyBadge } from '../features/rooms/KeyBadge';

/** The logo: a speech bubble holding four tiles, the same colours in both themes. */
const Logo = () => (
  <svg className="brand-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M7 2h10a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5H9.5L4 22.5l1.2-4.4A5 5 0 0 1 2 14V7a5 5 0 0 1 5-5Z"
      fill="var(--accent)"
    />
    <rect x="6" y="5.5" width="5.5" height="5" rx="1.5" fill="#ffd166" />
    <rect x="12.5" y="5.5" width="5.5" height="5" rx="1.5" fill="#ef476f" />
    <rect x="6" y="11.5" width="5.5" height="5" rx="1.5" fill="#06d6a0" />
    <rect x="12.5" y="11.5" width="5.5" height="5" rx="1.5" fill="#4cc9f0" />
  </svg>
);

export interface HeaderProps {
  /** The first launch: no room, no settings yet. */
  first: boolean;
  embed: boolean;
  onPlayers: () => void;
  onProfile: () => void;
}

export function Header({ first, embed, onPlayers, onProfile }: HeaderProps) {
  const { device, conn, insecure, account, room } = useStore();
  const me = room && account ? room.members.find(m => m.id === account.id) : null;
  return (
    <header className="bar">
      <IconButton icon="sidebar" label="Joueurs" onClick={onPlayers} />
      <div className="brand">
        <Logo />
        {APP_NAME}
      </div>
      {conn === 'reconnecting' && (
        <Badge tone="wait" className="conn-state" role="status">
          Reconnexion…
        </Badge>
      )}
      {insecure && (
        <Badge tone="insecure" icon="lock" title={`${device.server} : le code et les messages circulent en clair`}>
          Connexion non chiffrée
        </Badge>
      )}
      <div className="spacer" />
      {!first && (
        <div className="header-tools">
          {device.roomKey && <KeyBadge k={device.roomKey} />}
          {account && (
            <Avatar
              name={account.name}
              hue={me?.hue ?? account.hue ?? 222}
              photo={me?.photo}
              size=""
              onClick={onProfile}
              title={`${account.name} — profil et paramètres`}
              label="Profil et paramètres"
            />
          )}
        </div>
      )}
      {embed && <IconButton icon="close" label="Fermer" onClick={() => parent.postMessage({ scd: 'close' }, '*')} />}
    </header>
  );
}
