// The panel: header, left drawer (the players), the stage (the chat, or the page of a room that can't be entered),
// right drawer (Profil, Extension, Partie). Before any code: the first launch. A refused code: its page.
import { useEffect, useRef, useState } from 'react';
import { MIN_HUE_GAP, RAINBOW, hueColor, hueDistance, newCode } from '@slopesque/engines';
import { isInsecureUrl, type ActivityChoice, type MemberView } from '@slopesque/shared';
import { codeOf, EmojiPop, THUMBS_UP } from '../lib/emoji';
import * as X from '../lib/ext';
import { connect, request, upload } from './net';
import { useStore } from './store';
import { AccountSection } from '../features/account/AccountSection';
import { CodeModal } from '../features/account/CodeModal';
import type { CodeMode } from '../features/account/model';
import { Welcome } from '../features/account/Welcome';
import { Chat, People } from '../features/chat/Chat';
import {
  Avatar, Badge, Button, Card, Checkbox, Drawer, DrawerBody, Field, Icon, IconButton, LinkButton, Modal, ModalButtons, Note, RichText, Select, Tabs,
  TextInput,
} from '../design';
import { KeyBadge } from '../features/rooms/KeyBadge';
import { RoomList } from '../features/rooms/RoomList';
import { RoomPage } from '../features/rooms/RoomPage';
import { ServerField } from '../features/rooms/ServerField';
import { DiskSettings } from '../features/disk/DiskSettings';
import { DiskStage } from '../features/disk/DiskStage';
import { Ranking } from '../features/disk/Ranking';
import { PollSettings, PollStage, WheelStage } from '../features/poll/PollWheel';
import { CardsStage } from '../features/cards/CardsStage';
import { TrumpArt } from '../features/cards/tarot/TrumpArt';
import { Palmares } from '../features/palmares/Palmares';
import { WebSettings } from '../features/web/WebSettings';
import { WebStage } from '../features/web/WebStage';
import { EXT_VERSION, APP_NAME } from './version';
import { CARD_PLAYERS, COINCHE_TARGETS, HOLDEM_EVERY, HOLDEM_STACKS, cardGameOf, READY_ACTIVITIES, SCORE_NAMES, scoreKey, versionBelow } from '@slopesque/shared';

const EMBED = new URLSearchParams(location.search).has('embed');
const RELEASES = 'https://github.com/recovizzi/slopesque/releases/latest';
type RightTab = 'profile' | 'extension' | 'game';
const PLAYERS_TAB = { id: 'ranking', label: 'Joueurs', icon: 'users', title: 'Joueurs' } as const;
const PALMARES_TAB = { id: 'palmares', label: 'Palmarès', icon: 'chart', title: 'Palmarès : victoires et taux de victoire, gardés dans le temps' } as const;

export function App() {
  const { device, conn, fatal, account, room, roomStatus, insecure, setDevice } = useStore();
  const [leftOpen, setLeftOpen] = useState(innerWidth >= 640);
  const [rightOpen, setRightOpen] = useState(false);
  const [tab, setTab] = useState<RightTab>('profile');
  const [leftTab, setLeftTab] = useState<'chat' | 'ranking' | 'palmares'>('chat');
  const [codeModal, setCodeModal] = useState<{ first: boolean; start: CodeMode | null } | null>(null);
  const [welcomeCode] = useState(() => newCode());   // drawn at the first launch; kept only after « Continuer »
  const popHost = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<EmojiPop | null>(null);

  useEffect(() => { if (popHost.current && !pop) setPop(new EmojiPop(popHost.current)); }, [pop]);
  const dark = device.theme === 'dark' || (device.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => { document.documentElement.dataset.theme = device.theme; pop?.setTheme(dark); }, [device.theme, dark, pop]);

  const first = !device.code;
  const blocked = first || !!fatal || roomStatus !== 'ok' || !room || !account;
  useEffect(() => {
    const b = document.body.classList;
    b.toggle('activity-chat', !room || room.activity.activity === 'chat');
    b.toggle('activity-poll', room?.activity.activity === 'poll');
    b.toggle('activity-wheel', room?.activity.activity === 'wheel');
    b.toggle('activity-cards', room?.activity.activity === 'cards');
    b.toggle('activity-web', room?.activity.activity === 'lowtide');
    b.toggle('left-open', leftOpen);
    b.toggle('right-open', rightOpen);
    b.toggle('room-blocked', blocked);
    b.toggle('is-welcome', first);
  }, [leftOpen, rightOpen, blocked, first, room?.activity.activity]);
  const act = room?.activity.activity ?? 'chat', scored = act === 'disk' || act === 'cards';   // the others have no points: their players

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (codeModal) setCodeModal(null);
      else if (rightOpen) setRightOpen(false);
      else if (EMBED) parent.postMessage({ scd: 'close' }, '*');
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [codeModal, rightOpen]);

  // a vote starts outside the Chat activity: the chat opens on it (the left drawer)
  const openVote = room?.chat.messages.findLast(m => m.kind === 'vote' && !(m.data?.vote as { result?: string } | undefined)?.result)?.id ?? 0;
  const seenVote = useRef(0);
  useEffect(() => {
    if (!openVote || openVote === seenVote.current) return;
    seenVote.current = openVote;
    if (act !== 'chat') { setLeftOpen(true); setLeftTab('chat'); }
  }, [openVote, act]);

  const openList = () => { setRightOpen(true); setTab('extension'); };
  const giveHost = async (m: MemberView) => { const r = await request('host:give', { to: m.id }); if (!r.ok) useStore.getState().set({ note: r.error }); };

  let page: React.ReactNode = null;
  if (first) page = <Welcome code={welcomeCode} onChange={mode => setCodeModal({ first: true, start: mode })} />;
  else if (fatal) page = <FatalPage onCode={mode => setCodeModal({ first: true, start: mode })} />;
  else if (!account && conn === 'offline') page = <OfflinePage />;
  else if (!account) page = <Card><Note>Connexion au serveur…</Note></Card>;
  else if (roomStatus !== 'ok' || !room) page = <RoomPage status={roomStatus === 'ok' ? 'loading' : roomStatus} onList={openList} />;

  const me = room && account ? room.members.find(m => m.id === account.id) : null;
  const closeLeft = <IconButton icon="close" label="Fermer le panneau" title="Fermer" onClick={() => setLeftOpen(false)} />;
  return <>
    <header className="bar">
      <IconButton icon="sidebar" label="Joueurs" onClick={() => setLeftOpen(!leftOpen)} />
      <div className="brand"><svg className="brand-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5H9.5L4 22.5l1.2-4.4A5 5 0 0 1 2 14V7a5 5 0 0 1 5-5Z" fill="var(--accent)"/><rect x="6" y="5.5" width="5.5" height="5" rx="1.5" fill="#ffd166"/><rect x="12.5" y="5.5" width="5.5" height="5" rx="1.5" fill="#ef476f"/><rect x="6" y="11.5" width="5.5" height="5" rx="1.5" fill="#06d6a0"/><rect x="12.5" y="11.5" width="5.5" height="5" rx="1.5" fill="#4cc9f0"/></svg>{APP_NAME}</div>
      {conn === 'reconnecting' && <Badge tone="wait" className="conn-state" role="status">Reconnexion…</Badge>}
      {insecure && <Badge tone="insecure" icon="lock" title={`${device.server} : le code et les messages circulent en clair`}>Connexion non chiffrée</Badge>}
      <div className="spacer" />
      {!first && <div className="header-tools">
        {device.roomKey && <KeyBadge k={device.roomKey} />}
        {account && <Avatar name={account.name} hue={me?.hue ?? account.hue ?? 222} photo={me?.photo} size="" onClick={() => { setRightOpen(!rightOpen); setTab('profile'); }}
          title={`${account.name} — profil et paramètres`} label="Profil et paramètres" />}
      </div>}
      {EMBED && <IconButton icon="close" label="Fermer" onClick={() => parent.postMessage({ scd: 'close' }, '*')} />}
    </header>
    <div className="main">
      <Drawer side="left">{room && account && (act === 'chat' ? <>
        {/* the Chat activity: its players, and the Palmarès kept for every game */}
        <Tabs value={leftTab === 'palmares' ? 'palmares' : 'ranking'} onChange={setLeftTab} tabs={[PLAYERS_TAB, PALMARES_TAB]}>{closeLeft}</Tabs>
        {leftTab === 'palmares' ? <Palmares /> : <People onGiveHost={giveHost} />}</> : <>
        <Tabs value={leftTab} onChange={setLeftTab}
          tabs={[{ id: 'chat', label: 'Chat', icon: 'chat', title: 'Chat' }, scored ? { id: 'ranking', label: 'Classement', icon: 'trophy', title: 'Classement' } : PLAYERS_TAB, PALMARES_TAB]}>
          {closeLeft}</Tabs>
        {leftTab === 'chat' ? !blocked && <Chat pop={pop} /> : leftTab === 'palmares' ? <Palmares /> : scored ? <Ranking onGiveHost={giveHost} /> : <People onGiveHost={giveHost} />}</>)}</Drawer>
      <main className="stage">
        <div className="room-page">{page}</div>
        <div className="chat-stage">{!blocked && act === 'chat' && <Chat pop={pop} />}</div>
        {!blocked && act === 'disk' && <DiskStage />}
        {!blocked && act === 'poll' && <PollStage pop={pop} />}
        {!blocked && act === 'wheel' && <WheelStage />}
        {!blocked && act === 'cards' && <CardsStage />}
        {!blocked && act === 'lowtide' && <WebStage onSettings={() => { setRightOpen(true); setTab('game'); }} />}
      </main>
      <Drawer side="right" onClose={() => setRightOpen(false)}>{!first && <>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'profile', label: 'Profil' }, { id: 'extension', label: 'Extension' }, { id: 'game', label: 'Partie' }]}>
          <IconButton icon="close" label="Fermer" onClick={() => setRightOpen(false)} /></Tabs>
        <DrawerBody key={rightOpen ? 'open' : 'closed'}>{tab === 'profile' ? <Profile pop={pop} onCode={() => setCodeModal({ first: false, start: null })} />
          : tab === 'extension' ? <ExtensionTab setDevice={setDevice} />
          : <GameTab />}</DrawerBody></>}</Drawer>
    </div>
    {room?.notice && <NoticeModal notice={room.notice} />}
    {codeModal && <CodeModal first={codeModal.first} start={codeModal.start} onClose={() => setCodeModal(null)} onDone={() => setCodeModal(null)} />}
    <div ref={popHost} />
  </>;
}

/** Profil: pseudo, colour (a rainbow slider; applied 3 s after the last move, refused too close to another player), my
 *  double-click reaction, then Compte. */
function Profile({ pop, onCode }: { pop: EmojiPop | null; onCode: () => void }) {
  const account = useStore(s => s.account), room = useStore(s => s.room), set = useStore(s => s.set);
  const [name, setName] = useState(account?.name ?? '');
  useEffect(() => { if (document.activeElement?.getAttribute('name') !== 'pseudo') setName(account?.name ?? ''); }, [account?.name]);   // the account arrives after
  const me = room?.members.find(m => m.id === account?.id);
  const [hue, setHue] = useState<number | null>(null), [hueNote, setHueNote] = useState(''), [quickNote, setQuickNote] = useState('');
  const timer = useRef(0);
  if (!account) return null;
  const others = room?.members.filter(m => m.id !== account.id) ?? [];
  const close = (h: number) => others.find(m => hueDistance(m.hue, h) < MIN_HUE_GAP);
  const save = async (p: { name?: string; hue?: number; quick?: string }) => { const r = await request('profile:update', p); if (r.ok) set({ account: r.value }); else set({ note: r.error }); };
  const shown = hue ?? me?.hue ?? account.hue ?? 222;
  const pos = (v: number) => `calc(11px + (100% - 22px) * ${(v / 359).toFixed(4)})`;
  const quick = account.quick || THUMBS_UP;
  return <>
    <PhotoField />
    <Field label="Pseudo"><TextInput name="pseudo" value={name} maxLength={20} onChange={e => setName(e.target.value)}
      onBlur={() => { if (name.trim() && name.trim() !== account.name) void save({ name: name.trim() }); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></Field>
    <Field as="div" label="Couleur" help={hueNote}>
      <div className="hue" style={{ '--h': shown } as React.CSSProperties}>
        <input type="range" className="hue-range" min={0} max={359} step={1} value={shown} style={{ background: RAINBOW }} aria-label="Couleur" onChange={e => {
          const h = +e.target.value, other = close(h);
          setHue(h);
          setHueNote(other ? `Trop proche de la couleur de ${other.name}.` : 'Appliquée dans 3 secondes…');
          clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            if (close(h)) setHueNote(`Trop proche de ${close(h)!.name} : couleur inchangée.`);
            else { void save({ hue: h }); setHueNote(''); }
            setHue(null);
          }, 3000);
        }} />
        <div className="hue-marks">{others.map(m => <span key={m.id} className="hue-mark" style={{ left: pos(m.hue), '--c': hueColor(m.hue) } as React.CSSProperties} title={m.name} />)}</div>
      </div></Field>
    <Field as="div" label="Réaction au double-clic" help={quickNote ? <b>{quickNote}</b> : 'Double-clique sur un message pour réagir avec cet emoji.'}>
      <button className="quick-btn" type="button" onClick={ev => void pop?.open(ev.currentTarget, e => {
        if (e.startsWith(':')) setQuickNote('Choisis un emoji standard : un emoji personnalisé n\'existe que dans son salon.');
        else { setQuickNote(''); void save({ quick: e }); }
      })} title="Changer d'emoji">
        <span className="quick-emoji"><RichText text={quick} links={false} /></span>{codeOf(quick) && <code>:{codeOf(quick)}:</code>}<small>Changer</small></button></Field>
    <AccountSection onChange={onCode} />
  </>;
}

function ExtensionTab({ setDevice }: { setDevice: (p: Partial<ReturnType<typeof useStore.getState>['device']>) => void }) {
  const device = useStore(s => s.device);
  void setDevice;
  return <>
    <ServerField onSaved={() => connect()} />
    {isInsecureUrl(device.server) && <Note tone="alert">Connexion non chiffrée : ton code et tes messages circulent en clair jusqu'à ce serveur.</Note>}
    <RoomList />
    <ExtensionOptions />
    <Field label="Thème"><Select value={device.theme} onChange={v => setDevice({ theme: v as 'auto' })}
      options={[{ value: 'auto', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} /></Field>
    <Versions />
  </>;
}

/** At the bottom of the Extension tab: this extension's version in a bubble (and the server's, when connected). */
function Versions() {
  const v = useStore(s => s.versions);
  const behind = v && v.minExtension !== '?' && v.version !== '?' && versionBelow(EXT_VERSION, v.version);
  return <div className="versions">
    <span className="version-bubble" title="Version de l'extension">Slopesque {EXT_VERSION}</span>
    {v && <span className="version-server">serveur {v.version}</span>}
    {behind && <a className="version-new" href={v.download} target="_blank" rel="noopener noreferrer">Une version plus récente existe</a>}
  </div>;
}

/** Profil: my photo in this room (or my letter), a small ✕ to remove it, a button to choose one. */
function PhotoField() {
  const account = useStore(s => s.account), room = useStore(s => s.room);
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const me = room?.members.find(m => m.id === account?.id);
  if (!me) return null;
  const choose = async (f: File) => {
    setBusy(true);
    const up = await upload('photo', f);
    const r = up.ok ? await request('photo:set', { mediaId: up.value.id }) : up;
    setBusy(false);
    setNote(r.ok ? '' : r.error);
  };
  return <Field as="div" label={<>Photo de profil <small>dans ce salon</small></>}
    help={note ? <b>{note}</b> : 'Propre à ce salon : chaque salon a la sienne. Coupée en carré, au milieu de l\'image ; l\'ancienne est supprimée.'}>
    <div className="photo-row"><span className="photo-wrap"><Avatar name={me.name} hue={me.hue} photo={me.photo} size="lg" />
      {me.photo && <button className="photo-del" type="button" onClick={() => void request('photo:set', { mediaId: null })}
        title="Retirer la photo : ta lettre sur ta couleur revient" aria-label="Retirer la photo"><Icon name="close" /></button>}</span>
      <Button variant="ghost" size="sm" icon="camera" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Envoi…' : me.photo ? 'Changer de photo' : 'Ajouter une photo'}</Button></div>
    <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void choose(f); }} /></Field>;
}

/** Partie: the activity first (the host changes it, the others see it), then its settings. */
const ACT_HELP: Record<string, string> = {
  disk: 'Un mot par tour, placé entre deux extrémités ; des points selon la distance à la réponse de l\'hôte.',
  poll: 'Une question, posée dans la zone de jeu : choix définis, choix libre ou gradient. Pas de points.',
  wheel: 'Une roue de propositions, chacune avec un poids, construite dans la zone de jeu sous les yeux de tous ; l\'hôte la lance, l\'aiguille désigne le résultat. Pas de points.',
  chat: 'Pas de jeu : le chat en plein écran, la liste des joueurs à gauche. Les scores sont gardés.',
  cards: 'Des jeux de cartes à plusieurs : le Trou du cul, le Tarot, le Texas Hold\'em et la Coinche. Les manches donnent des points au classement.',
  lowtide: 'Le jeu Low Tide, sur sa propre page, dans la zone de jeu. Pas de points.',
};
const GAME_HELP = {
  tdc: 'Aussi appelé Président. Se débarrasser de ses cartes le premier : les rôles de la manche donnent des points et des échanges de cartes.',
  tarot: 'À 4 : le preneur contre les trois autres ; à 5, il appelle un Roi. Enchères (Prise, Garde, Garde sans, Garde contre), chien et écart, 21 atouts et l\'Excuse ; les points du preneur dépendent de ses bouts.',
  coinche: 'La belote coinchée, deux contre deux : enchères de 80 à 160 (ou le capot) avec une couleur d\'atout, coinche et surcoinche ; Valet et 9 d\'atout les plus forts, belote-rebelote ; partie en 1 000 points ou plus.',
  holdem: 'Le poker No Limit en tournoi, avec des jetons fictifs : deux cartes cachées, cinq communes, des mises à chaque tour ; le dernier à garder des jetons gagne. Points selon la place.',
};
const GAME_NAMES = { tdc: 'Trou du cul', tarot: 'Tarot', holdem: 'Texas Hold\'em', coinche: 'Coinche' };
const LEVEL_NAMES = { facile: 'Facile', moyen: 'Moyen', fort: 'Fort' } as const;
const fmtEvery = (n: number) => (n ? `Toutes les ${n} mains` : 'Jamais');

function GameTab() {
  const room = useStore(s => s.room), me = useStore(s => s.account)?.id, set = useStore(s => s.set);
  if (!room) return <Note>Entre dans un salon pour voir sa partie.</Note>;
  const host = room.hostId === me, act = room.activity.activity;
  const names: Record<string, string> = { chat: 'Chat', disk: 'Demi-disque', poll: 'Sondage', wheel: 'Roulette', cards: 'Cartes', lowtide: 'Low Tide' };
  const choose = async (a: ActivityChoice['activity']) => { const r = await request('activity:choose', { choice: { activity: a } }); if (!r.ok) set({ note: r.error }); };
  const key = scoreKey(room.activity);
  if (!host) return <GameInfo />;
  return <>
    <Field label="Activité"><Select value={act} onChange={v => void choose(v as ActivityChoice['activity'])} options={Object.entries(names).map(([k, n]) => {
      const ready = READY_ACTIVITIES.includes(k as ActivityChoice['activity']);
      return { value: k, label: `${n}${ready ? '' : ' (bientôt)'}`, disabled: !ready };
    })} /></Field>
    <Note>{ACT_HELP[act]}</Note>
    <hr className="sep" />
    <h3 className="section">{{ disk: 'Paramètres du demi-disque', poll: 'Paramètres du sondage', wheel: 'Paramètres de la roulette', chat: 'Paramètres du chat', lowtide: 'Paramètres de Low Tide', cards: 'Paramètres des cartes' }[act]}</h3>
    {act === 'disk' ? <DiskSettings /> : act === 'poll' ? <PollSettings /> : act === 'lowtide' ? <WebSettings /> : act === 'cards' ? <CardsSettings />
      : act === 'wheel' ? <Note>Les propositions et leurs poids se règlent dans la zone de jeu : tout le monde voit la roue se construire.</Note>
      : <Note>Rien à régler : le chat prend toute la place, la liste des joueurs est à gauche. Les scores ne bougent pas.</Note>}
    {(act === 'disk' || act === 'poll' || act === 'cards') && <Note>Les changements faits pendant un tour en cours s'appliquent à sa fin.</Note>}
    {key && <><hr /><Button variant="danger" icon="reset" onClick={async () => { const r = await request('game:reset'); if (!r.ok) set({ note: r.error }); }}>Réinitialiser la partie</Button>
      <Note>Remet le classement {SCORE_NAMES[key]} à zéro (les autres jeux gardent le leur). Le palmarès est toujours gardé.</Note></>}
  </>;
}

const ACT_NAMES: Record<string, string> = { chat: 'Chat', disk: 'Demi-disque', poll: 'Sondage', wheel: 'Roulette', cards: 'Cartes', lowtide: 'Low Tide' };
const fmtDur = (s: number) => (s < 3600 ? `${s / 60} min` : `${s / 3600} h`);
/** Partie, for the players who aren't the host: each setting on its line — what it is (and does) on the left, the
 *  host's choice on the right — read only. */
function GameInfo() {
  const room = useStore(s => s.room)!, act = room.activity.activity, host = room.members.find(m => m.id === room.hostId);
  const hr = room.cards.settings.holdemRules ?? { stack: 1000, every: 10 };
  const d = { ...room.disk.rules, ...room.disk.pending }, game = cardGameOf(room.activity);
  type Row = [label: string, help: string, value: React.ReactNode];
  const rows: Row[] = act === 'disk' ? [
      ['Sujet', 'La question posée à chaque tour', d.topic],
      ['Extrémités', 'Les deux bouts du demi-disque', <>{d.left} <span className="ro-arrow">↔</span> {d.right}</>],
      ['Mode de scrutin', d.mode === 'amphi' ? 'Une colonne pour l\'hôte, un siège par candidat' : 'Chacun place son rayon où il veut', d.mode === 'amphi' ? 'Amphithéâtre' : 'Rayon libre'],
      ['Temps de réponse', 'Pour placer sa réponse', `${d.roundSeconds} s`]]
    : act === 'poll' ? [
      ['Temps de réponse', 'Le sondage se ferme à la fin du temps, ou quand tous ont répondu', fmtDur(room.poll.seconds)],
      ['Résultats', room.poll.secret ? 'Personne ne voit qui a répondu quoi' : 'Survoler un résultat montre qui l\'a donné', room.poll.secret ? 'Secrets' : 'Nominatifs']]
    : act === 'wheel' ? [
      ['Propositions', 'Écrites par l\'hôte dans la zone de jeu', String(room.wheel.items.filter(i => i.label.trim()).length)],
      ['Tirage', 'Le numéro du tirage en cours', `n° ${room.wheel.round}`]]
    : act === 'cards' ? [
      ['Jeu', GAME_HELP[game], GAME_NAMES[game]],
      ['Joueurs', 'Des robots complètent les places libres', `${room.cards.settings[game]}${game === 'tarot' && room.cards.settings.tarot === 5 ? ' · Roi appelé' : ''}`],
      ...(game === 'tarot' ? [['Revoir les plis gagnés', 'Au survol d\'un joueur ou de sa pile', room.cards.showTricks ? 'Oui' : 'Non'] as Row,
        ['Niveau des robots', 'Ils jouent avec ce que leur place voit', LEVEL_NAMES[room.cards.settings.bots ?? 'moyen']] as Row] : []),
      ...(game === 'holdem' ? [['Tapis de départ', `Les mêmes jetons pour tous ; blindes de départ 10 / 20`, `${hr.stack} jetons`] as Row,
        ['Montée des blindes', '20 / 40, 30 / 60, 40 / 80… : la partie finit plus vite', fmtEvery(hr.every)] as Row,
        ['Niveau des robots', 'Ils jouent avec ce que leur place voit', LEVEL_NAMES[room.cards.settings.bots ?? 'moyen']] as Row] : []),
      ...(game === 'coinche' || game === 'tarot' ? [['Distribution', 'À l\'ancienne : plis ramassés, coupe, par paquets (plus de mains déséquilibrées)', (room.cards.settings.dealMode ?? 'random') === 'classic' ? 'À l\'ancienne' : 'Aléatoire'] as Row] : []),
      ...(game === 'coinche' ? [['Objectif', 'La première équipe à ce score gagne la partie', `${room.cards.settings.coincheTarget ?? 1000} points`] as Row,
        ['Niveau des robots', 'Ils jouent avec ce que leur place voit', LEVEL_NAMES[room.cards.settings.bots ?? 'moyen']] as Row] : [])]
    : act === 'lowtide' ? [['Adresse', 'La page du jeu, vérifiée par l\'hôte', <span className="ro-url">{Object.values(room.web)[0] ?? '—'}</span>]] : [];
  return <>
    <div className="ro-head"><span className="ro-who">Réglé par l'hôte</span>{host && <span className="ro-host"><Avatar name={host.name} hue={host.hue} photo={host.photo} size="sm" />{host.name}</span>}</div>
    <ul className="ro-settings">
      {([['Activité', ACT_HELP[act], ACT_NAMES[act]], ...rows] as Row[]).map(([label, help, value]) => <li key={label} className={typeof value !== 'string' || value.length > 16 ? 'is-long' : ''}>
        <span className="ro-label">{label}</span><span className="ro-value">{value}</span>
        <small className="ro-help">{help}</small></li>)}
    </ul>
    {act === 'cards' && game === 'tarot' && <TrumpArt edit={false} />}
    <Note>Seul l'hôte modifie la partie ; propose une autre activité au vote avec /activity.</Note>
  </>;
}

/** Extension: the shortcut (shown, changed: Firefox here, Chrome and Edge in their page) and « Rester ouvert sur toutes
 *  les pages » (off by default; the permission asked when turned on). */
function ExtensionOptions() {
  const [keys, setKeys] = useState(''), [persist, setPersist] = useState(false), [note, setNote] = useState(''), [edit, setEdit] = useState('');
  const refresh = () => { void X.shortcut().then(setKeys); void X.persistent().then(setPersist); };
  useEffect(() => { refresh(); addEventListener('focus', refresh); return () => removeEventListener('focus', refresh); }, []);
  if (!X.inExtension()) return null;
  return <>
    <Field as="div" label="Raccourci clavier">
      <Note>Ouvre et ferme le panneau : <b>{keys || 'aucun'}</b>{keys ? '' : ' (le navigateur ne l\'a pas attribué : un autre l\'utilise déjà)'}.</Note>
      {X.canEditShortcut() ? <form className="row" onSubmit={async e => { e.preventDefault(); try { await X.setShortcut(edit); setNote(''); refresh(); } catch { setNote('Raccourci refusé : par exemple Alt+Shift+S.'); } }}>
        <TextInput value={edit} onChange={e => setEdit(e.target.value)} placeholder="Alt+Shift+S" /><Button size="sm" type="submit">Changer</Button></form>
        : <><Button variant="ghost" size="sm" onClick={() => X.openShortcutsPage()}>Changer le raccourci</Button>
          <Note>Chrome et Edge le changent dans leur page des raccourcis (elle s'ouvre dans un onglet) ; reviens ici ensuite.</Note></>}</Field>
    <Checkbox label="Rester ouvert sur toutes les pages" checked={persist} onChange={async on => { const msg = await X.setPersistent(on); setNote(msg); refresh(); }} />
    <Note>Le panneau se rouvre sur chaque page, à la même place ; le fermer le ferme partout. Le navigateur demande l'accès à tous les sites à l'activation.</Note>
    {note && <Note tone="alert">{note}</Note>}
  </>;
}

const BOT_LEVELS = {
  coinche: ['Facile — des fautes, des enchères au hasard', 'Moyen — compte les cartes, charge son partenaire', 'Fort — simule la fin de la donne'],
  holdem: ['Facile — suit trop, se trompe, bluffe peu', 'Moyen — ses chances contre la cote du pot', 'Fort — devine les mains d\'après les mises, bluffe mieux'],
  other: ['Facile — des fautes, des enchères prudentes', 'Moyen — les règles du jeu, un peu de hasard', 'Fort — il calcule la fin de la donne'],
};

/** Partie (cards): the game first, then its number of players (the values each game allows; robots complete the
 *  free seats, from the next deal), and the Tarot's won tricks shown or not. */
function CardsSettings() {
  const room = useStore(s => s.room)!, me = useStore(s => s.account)?.id, set = useStore(s => s.set), host = room.hostId === me;
  const game = cardGameOf(room.activity), players = room.cards.settings[game] ?? CARD_PLAYERS[game][0];
  const hr = room.cards.settings.holdemRules ?? { stack: 1000, every: 10 }, holdemOn = room.cards.game === 'holdem' && !!room.cards.holdem && !room.cards.holdem.over;
  const ack = (r: { ok: boolean; error?: string }) => { if (!r.ok) set({ note: r.error ?? '' }); };
  const deal = room.cards.settings.dealMode ?? 'random';
  const dealMode = <><Field label="Distribution"><Select value={deal} disabled={!host} onChange={async v => ack(await request('cards:deal-mode', { mode: v as 'random' }))}
      options={[{ value: 'random', label: 'Aléatoire — le paquet mélangé à chaque donne' }, { value: 'classic', label: 'À l\'ancienne — plis ramassés, coupe, distribution par paquets' }]} /></Field>
    <Note>{deal === 'classic' ? 'Comme à table : les couleurs restent groupées, plus de mains déséquilibrées (longues couleurs, coupes franches). La première donne d\'une partie est mélangée.' : 'Le hasard pur : des mains souvent équilibrées. « À l\'ancienne » en donne de plus déséquilibrées.'} À partir de la donne suivante.</Note></>;
  const levels = BOT_LEVELS[game === 'coinche' || game === 'holdem' ? game : 'other'];
  const bots = <><Field label="Niveau des robots"><Select value={room.cards.settings.bots ?? 'moyen'} disabled={!host} onChange={async v => ack(await request('cards:bots', { level: v as 'moyen' }))}
      options={(['facile', 'moyen', 'fort'] as const).map((v, i) => ({ value: v, label: levels[i] }))} /></Field>
    <Note>Les robots jouent comme un joueur : avec ce que leur place voit, jamais les cartes des autres. Le niveau vaut pour tous les jeux de cartes.</Note></>;
  return <>
    <Field label="Jeu"><Select value={game} disabled={!host} onChange={async v => ack(await request('activity:choose', { choice: { activity: 'cards', cardGame: v as 'tdc' } }))}
      options={[{ value: 'tdc', label: 'Trou du cul' }, { value: 'tarot', label: 'Tarot' }, { value: 'holdem', label: 'Texas Hold\'em' }, { value: 'coinche', label: 'Coinche' }]} /></Field>
    <Note>{GAME_HELP[game]}</Note>
    <Field label="Joueurs"><Select value={players} disabled={!host} onChange={async v => ack(await request('cards:players', { game, players: Number(v) }))}
      options={CARD_PLAYERS[game].map(n => ({ value: n, label: `${n} joueurs${game === 'tarot' && n === 5 ? ' (le preneur appelle un Roi)' : game === 'holdem' && n === 2 ? ' (en tête-à-tête)' : game === 'coinche' ? ' (deux contre deux)' : ''}` }))} /></Field>
    <Note>À partir de la {game === 'holdem' ? 'partie' : 'donne'} suivante. Prends une place à la table avant la donne ; des robots complètent les places libres. Les règles se lisent avec le bouton « i » de la table.</Note>
    {game === 'tarot' && <><Checkbox label="Revoir les plis gagnés (au survol)" checked={room.cards.showTricks} disabled={!host} onChange={show => void request('tarot:tricks', { show })} />
      <Note>Décoché, la partie est plus dure : personne ne peut revoir les plis déjà joués.</Note>
      {dealMode}{bots}
      <TrumpArt edit={host} /></>}
    {game === 'coinche' && <>
      <Field label="Objectif"><Select value={room.cards.settings.coincheTarget ?? 1000} disabled={!host} onChange={async v => ack(await request('coinche:target', { target: Number(v) }))}
        options={COINCHE_TARGETS.map(n => ({ value: n, label: `${n} points${n === 1000 ? ' (une partie courte)' : ''}` }))} /></Field>
      <Note>La première équipe à ce score gagne, après la donne qui l'y amène. À partir de la partie suivante.</Note>
      {dealMode}{bots}</>}
    {game === 'holdem' && <>
      <Field label="Tapis de départ"><Select value={hr.stack} disabled={!host} onChange={async v => ack(await request('holdem:rules', { stack: Number(v) }))}
        options={HOLDEM_STACKS.map(n => ({ value: n, label: `${n} jetons (${n / 20} grosses blindes)` }))} /></Field>
      <Field label="Montée des blindes"><Select value={hr.every} disabled={!host} onChange={async v => ack(await request('holdem:rules', { every: Number(v) }))}
        options={HOLDEM_EVERY.map(n => ({ value: n, label: n ? `Toutes les ${n} mains` : 'Jamais (blindes fixes 10 / 20)' }))} /></Field>
      <Note>Blindes de départ 10 / 20, puis 20 / 40, 30 / 60, 40 / 80… Plus le tapis est petit et les blindes montent vite, plus la partie est courte. À partir de la partie suivante.</Note>
      {bots}
      {host && holdemOn && <><Button variant="danger" onClick={async () => { if (confirm('Terminer la partie ? Les joueurs encore en jeu sont classés selon leurs jetons.')) ack(await request('holdem:end')); }}>Terminer la partie</Button>
        <Note>Les joueurs encore en jeu sont classés selon leurs jetons ; chacun reçoit les points de sa place.</Note></>}</>}
  </>;
}

/** The server refused my code, or this version of the extension. */
function FatalPage({ onCode }: { onCode: (m: CodeMode) => void }) {
  const fatal = useStore(s => s.fatal);
  if (fatal === 'protocol' || fatal === 'outdated') {   // blocking: this extension is older than the server accepts
    const v = useStore.getState().versions;
    return <Card tone="offline" className="outdated" title="Mets l'extension à jour">
      <p>Cette version de l'extension ({EXT_VERSION}) n'est plus prise en charge par le serveur{v ? ` : il demande la ${v.minExtension} ou plus récente` : ''}.</p>
      <LinkButton size="big" href={v?.download ?? RELEASES} external>Télécharger la dernière version</LinkButton>
      <Note>Puis recharge l'extension (↻ dans la page des extensions du navigateur). Ton compte et tes salons sont gardés sur le serveur.</Note></Card>;
  }
  if (fatal === 'limited') return <Card tone="offline" title="Trop d'essais"><p>Le serveur a reçu trop de codes inconnus depuis ta connexion. Réessaie dans une minute.</p>
    <Button size="big" icon="reset" onClick={() => connect()}>Réessayer</Button></Card>;
  return <Card tone="unknown" title={fatal === 'code' ? 'Code invalide' : 'Ce code a été remplacé'}>
    <p>{fatal === 'code' ? 'Ce code utilisateur n\'est pas valable.' : 'Ton code a été renouvelé sur un autre appareil (ou par un admin) : tape le nouveau (Profil → Compte sur ton autre appareil).'}</p>
    <Button size="big" onClick={() => onCode('resume')}>J'ai le nouveau code</Button>
    <Button variant="ghost" onClick={() => onCode('new')}>Repartir de zéro</Button></Card>;
}

function OfflinePage() {
  const server = useStore(s => s.device.server);
  return <Card tone="offline" title="Serveur injoignable"><p>Aucune réponse de {server}. Vérifie l'adresse du serveur, ou ta connexion.</p>
    <ServerField onSaved={() => connect()} />
    <Button size="big" icon="reset" onClick={() => connect()}>Réessayer</Button></Card>;
}


/** The server restarted during a game: it is lost — said once to each player (this device remembers it was read). */
function NoticeModal({ notice }: { notice: { id: string; title: string; text: string } }) {
  const KEY = 'slp-notices-read';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; } };
  const [open, setOpen] = useState(() => !read().includes(notice.id));
  useEffect(() => { setOpen(!read().includes(notice.id)); }, [notice.id]);
  const close = () => { try { localStorage.setItem(KEY, JSON.stringify([...read(), notice.id].slice(-20))); } catch { /* not kept: shown again next time */ } setOpen(false); };
  if (!open) return null;
  return <Modal title={notice.title} onClose={close} className="notice-modal" role="alertdialog"><p>{notice.text}</p>
    <ModalButtons><Button onClick={close} autoFocus>Compris</Button></ModalButtons></Modal>;
}
