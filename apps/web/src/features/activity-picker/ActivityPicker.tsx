// The /activity window (openspec: chat-activity, Commandes du chat): every kind of activity with a small picture, then
// (where there is one) its exact format. The host launches it at once; another player proposes it to a vote. An
// activity the V1 can't play yet is shown greyed (« bientôt »).
import { READY_ACTIVITIES, type ActivityChoice } from '@slopesque/shared';
import { Icon, useEscape } from '../../design';

// small pictures (80 × 52), clear at a glance, the same colours in both themes
const ART = {
  disk: `<path d="M10 46A30 30 0 0 1 70 46Z" fill="#e9e7ff" stroke="#5b5bd6" stroke-width="3" stroke-linejoin="round"/><path d="M40 46L58 24" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="46" r="4" fill="#5b5bd6"/>`,
  poll: `<rect x="12" y="10" width="44" height="9" rx="4.5" fill="#5b5bd6"/><rect x="12" y="23" width="56" height="9" rx="4.5" fill="#06d6a0"/><rect x="12" y="36" width="28" height="9" rx="4.5" fill="#ef476f"/>`,
  wheel: `<g transform="translate(40 28)"><path d="M0 0L0-21A21 21 0 0 1 21 0Z" fill="#ffd166"/><path d="M0 0L21 0A21 21 0 0 1 0 21Z" fill="#ef476f"/><path d="M0 0L0 21A21 21 0 0 1-21 0Z" fill="#06d6a0"/><path d="M0 0L-21 0A21 21 0 0 1 0-21Z" fill="#4cc9f0"/><circle r="4" fill="#fff" stroke="#1c1b19" stroke-width="1.5"/></g><path d="M40 2l-5 7h10z" fill="#1c1b19"/>`,
  chat: `<rect x="8" y="8" width="40" height="22" rx="8" fill="#5b5bd6"/><path d="M16 30l-4 7 11-7z" fill="#5b5bd6"/><rect x="32" y="22" width="40" height="20" rx="8" fill="#e9e7ff" stroke="#5b5bd6" stroke-width="2"/><path d="M62 42l5 6-11-6z" fill="#e9e7ff" stroke="#5b5bd6" stroke-width="2" stroke-linejoin="round"/>`,
  cards: `<g transform="rotate(-12 34 28)"><rect x="18" y="8" width="26" height="38" rx="4" fill="#fff" stroke="#1c1b19" stroke-opacity=".35" stroke-width="1.5"/><text x="31" y="33" font-size="16" text-anchor="middle" fill="#1c1b19">♠</text></g><g transform="rotate(10 48 28)"><rect x="36" y="8" width="26" height="38" rx="4" fill="#fff" stroke="#1c1b19" stroke-opacity=".35" stroke-width="1.5"/><text x="49" y="33" font-size="16" text-anchor="middle" fill="#d93d42">♥</text></g>`,
  web: `<rect x="8" y="6" width="64" height="40" rx="5" fill="#1b4b6e"/><rect x="8" y="6" width="64" height="9" rx="4" fill="#2a6f97"/><circle cx="14" cy="10.5" r="1.8" fill="#fff"/><circle cx="20" cy="10.5" r="1.8" fill="#fff"/><path d="M34 22v16l13-8z" fill="#ffd166"/>`,
};
const Art = ({ k }: { k: keyof typeof ART }) => <svg className="act-art" viewBox="0 0 80 52" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[k] }} />;

interface Format { label: string; help: string; choice: ActivityChoice; soon?: boolean }
interface Kind { id: keyof typeof ART; name: string; help: string; choice?: ActivityChoice; formats?: Format[] }
const KINDS: Kind[] = [
  { id: 'disk', name: 'Demi-disque', help: 'Placer un mot entre deux extrémités', formats: [
    { label: 'Rayon libre', help: 'Chacun place son rayon où il veut', choice: { activity: 'disk', mode: 'ray' } },
    { label: 'Amphithéâtre', help: 'Un siège par candidat, l\'hôte choisit une colonne', choice: { activity: 'disk', mode: 'amphi' } }] },
  { id: 'poll', name: 'Sondage', help: 'Une question, les réponses de tous', choice: { activity: 'poll' } },
  { id: 'wheel', name: 'Roulette', help: 'Tirer au sort parmi des propositions', choice: { activity: 'wheel' } },
  { id: 'chat', name: 'Chat', help: 'Discuter, sans jeu', choice: { activity: 'chat' } },
  { id: 'cards', name: 'Cartes', help: 'Des jeux de cartes à plusieurs', formats: [
    { label: 'Trou du cul', help: 'Se débarrasser de ses cartes le premier · de 3 à 8 joueurs', choice: { activity: 'cards', cardGame: 'tdc' } },
    { label: 'Tarot', help: 'Le preneur contre les autres · à 4, ou à 5 avec un Roi appelé', choice: { activity: 'cards', cardGame: 'tarot' } },
    { label: 'Texas Hold\'em', help: 'Le poker en tournoi, jetons fictifs · de 2 à 8 joueurs', choice: { activity: 'cards', cardGame: 'holdem' } },
    { label: 'Coinche', help: 'La belote coinchée, deux contre deux · 4 joueurs', choice: { activity: 'cards', cardGame: 'coinche' } }] },
  { id: 'web', name: 'Jeux web', help: 'Le jeu d\'un autre site, dans le salon', formats: [
    { label: 'Low Tide', help: 'Course de bateaux, sur sa propre page', choice: { activity: 'lowtide' } }] },
];
const ready = (c: ActivityChoice) => READY_ACTIVITIES.includes(c.activity);
const kindOf = (a: string) => (a === 'lowtide' ? 'web' : a);

export function ActivityPicker({ kind, current, host, busy, onKind, onPick, onClose }: { kind: string | null; current: string; host: boolean; busy: boolean;
  onKind: (k: string | null) => void; onPick: (c: ActivityChoice) => void; onClose: () => void }) {
  const k = KINDS.find(x => x.id === kind);
  useEscape(onClose);
  const how = host ? 'Tu es l\'hôte : l\'activité change tout de suite.' : busy ? 'Un vote est déjà en cours dans le chat : attends sa fin.'
    : 'Ton choix sera proposé au vote dans le chat : 2 minutes, la majorité l\'emporte, et la moitié des joueurs connectés doit voter.';
  return <><div className="modal-backdrop" onClick={onClose} />
    <div className="modal act-picker" role="dialog" aria-modal="true" aria-label="Changer d'activité">
      <div className="rules-head"><h2>Changer d'activité</h2><button className="icon-btn sm" type="button" onClick={onClose} title="Fermer" aria-label="Fermer"><Icon name="close" /></button></div>
      <p className={`note act-how ${!host && busy ? 'is-busy' : ''}`}>{!host && <Icon name="vote" />}{how}</p>
      {k?.formats ? <>
        <button className="btn ghost sm act-back" type="button" onClick={() => onKind(null)}>← Toutes les activités</button>
        <div className="act-kind-head"><Art k={k.id} /><div><b>{k.name}</b><small>{k.id === 'cards' ? 'Choisis le jeu ; le nombre de joueurs se règle dans Partie' : 'Choisis le format'}</small></div></div>
        <ul className="act-formats">{k.formats.map(f => { const off = f.soon || !ready(f.choice); return <li key={f.label}><button type="button" className="act-format" disabled={off || (!host && busy)} onClick={() => onPick(f.choice)}>
          <b>{f.label}</b><small>{off && !f.soon ? 'Bientôt dans la V1' : f.help}</small></button></li>; })}</ul></>
        : <ul className="act-grid">{KINDS.map(x => { const off = x.choice ? !ready(x.choice) : !x.formats!.some(f => ready(f.choice)); const on = kindOf(current) === x.id;
          return <li key={x.id}><button type="button" className={`act-tile ${on ? 'is-current' : ''}`} disabled={(!host && busy) || (!!x.choice && off)} onClick={() => (x.formats ? onKind(x.id) : onPick(x.choice!))}>
            <Art k={x.id} /><b>{x.name}</b><small>{off ? 'Bientôt dans la V1' : x.help}</small>{on && <span className="act-now">en cours</span>}</button></li>; })}</ul>}
    </div></>;
}
