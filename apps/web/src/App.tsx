// The panel: header, left drawer (the players), the stage (the chat, or the page of a room that can't be entered),
// right drawer (Profil, Extension, Partie). Before any code: the first launch. A refused code: its page.
import { useEffect, useRef, useState } from 'react';
import { MIN_HUE_GAP, RAINBOW, hueColor, hueDistance, newCode } from '@slopesque/engines';
import { isInsecureUrl, type ActivityChoice, type MemberView } from '@slopesque/shared';
import { EmojiPop, emojiHtml } from './lib/emoji';
import { connect, request, upload } from './net';
import { useStore } from './store';
import { AccountSection, CodeModal, Welcome, type CodeMode } from './ui/Account';
import { Chat, People } from './ui/Chat';
import { Avatar, Html, Icon } from './ui/common';
import { KeyBadge, RoomList, RoomPage } from './ui/Rooms';
import { DiskSettings, DiskStage, Ranking } from './ui/DiskStage';
import { PollSettings, PollStage, WheelStage } from './ui/PollWheel';
import { CardsStage } from './ui/CardsStage';
import { READY_ACTIVITIES } from '@slopesque/shared';

const EMBED = new URLSearchParams(location.search).has('embed');
const RELEASES = 'https://github.com/recovizzi/slopesque/releases/latest';
type RightTab = 'profile' | 'extension' | 'game';

export function App() {
  const { device, conn, fatal, account, room, roomStatus, insecure, setDevice } = useStore();
  const [leftOpen, setLeftOpen] = useState(innerWidth >= 640);
  const [rightOpen, setRightOpen] = useState(false);
  const [tab, setTab] = useState<RightTab>('profile');
  const [leftTab, setLeftTab] = useState<'chat' | 'ranking'>('chat');
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
    b.toggle('left-open', leftOpen);
    b.toggle('right-open', rightOpen);
    b.toggle('room-blocked', blocked);
    b.toggle('is-welcome', first);
  }, [leftOpen, rightOpen, blocked, first, room?.activity.activity]);
  const act = room?.activity.activity ?? 'chat';

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

  const openList = () => { setRightOpen(true); setTab('extension'); };
  const giveHost = async (m: MemberView) => { const r = await request('host:give', { to: m.id }); if (!r.ok) useStore.getState().set({ note: r.error }); };

  let page: React.ReactNode = null;
  if (first) page = <Welcome code={welcomeCode} onChange={mode => setCodeModal({ first: true, start: mode })} />;
  else if (fatal) page = <FatalPage onCode={mode => setCodeModal({ first: true, start: mode })} />;
  else if (!account && conn === 'offline') page = <OfflinePage />;
  else if (!account) page = <div className="room-card"><p className="note">Connexion au serveur…</p></div>;
  else if (roomStatus !== 'ok' || !room) page = <RoomPage status={roomStatus === 'ok' ? 'loading' : roomStatus} onList={openList} />;

  const me = room && account ? room.members.find(m => m.id === account.id) : null;
  return <>
    <header className="bar">
      <button className="icon-btn" type="button" onClick={() => setLeftOpen(!leftOpen)} title="Joueurs" aria-label="Joueurs"><Icon name="sidebar" /></button>
      <div className="brand"><svg className="brand-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5H9.5L4 22.5l1.2-4.4A5 5 0 0 1 2 14V7a5 5 0 0 1 5-5Z" fill="var(--accent)"/><rect x="6" y="5.5" width="5.5" height="5" rx="1.5" fill="#ffd166"/><rect x="12.5" y="5.5" width="5.5" height="5" rx="1.5" fill="#ef476f"/><rect x="6" y="11.5" width="5.5" height="5" rx="1.5" fill="#06d6a0"/><rect x="12.5" y="11.5" width="5.5" height="5" rx="1.5" fill="#4cc9f0"/></svg>Slopesque</div>
      {conn === 'reconnecting' && <span className="tag wait conn-state" role="status">Reconnexion…</span>}
      {insecure && <span className="tag insecure" title={`${device.server} : le code et les messages circulent en clair`}><Icon name="lock" />Connexion non chiffrée</span>}
      <div className="spacer" />
      {!first && <div className="header-tools">
        {device.roomKey && <KeyBadge k={device.roomKey} />}
        {account && <button className={`avatar${me?.photo ? ' has-photo' : ''}`} type="button" onClick={() => { setRightOpen(!rightOpen); setTab('profile'); }}
          style={{ '--c': hueColor(me?.hue ?? account.hue ?? 222) } as React.CSSProperties} title={`${account.name} — profil et paramètres`} aria-label="Profil et paramètres">
          {me?.photo ? <img src={me.photo} alt="" draggable={false} /> : account.name.slice(0, 1).toUpperCase()}</button>}
      </div>}
      {EMBED && <button className="icon-btn" type="button" onClick={() => parent.postMessage({ scd: 'close' }, '*')} title="Fermer" aria-label="Fermer"><Icon name="close" /></button>}
    </header>
    <div className="main">
      <aside className="drawer drawer-left">{room && account && (act === 'chat' ? <>
        <div className="tabs"><span className="tab on static"><Icon name="users" />Joueurs</span>
          <button className="icon-btn" type="button" onClick={() => setLeftOpen(false)} title="Fermer" aria-label="Fermer le panneau"><Icon name="close" /></button></div>
        <People onGiveHost={giveHost} /></> : <>
        <div className="tabs">
          <button className={`tab ${leftTab === 'chat' ? 'on' : ''}`} type="button" onClick={() => setLeftTab('chat')} title="Chat"><Icon name="chat" /><span className="tab-label">Chat</span></button>
          <button className={`tab ${leftTab === 'ranking' ? 'on' : ''}`} type="button" onClick={() => setLeftTab('ranking')} title="Classement"><Icon name="trophy" /><span className="tab-label">Classement</span></button>
          <button className="icon-btn" type="button" onClick={() => setLeftOpen(false)} title="Fermer" aria-label="Fermer le panneau"><Icon name="close" /></button></div>
        {leftTab === 'chat' ? !blocked && <Chat pop={pop} /> : act === 'disk' || act === 'cards' ? <Ranking onGiveHost={giveHost} /> : <People onGiveHost={giveHost} />}</>)}</aside>
      <main className="stage">
        <div className="room-page">{page}</div>
        <div className="chat-stage">{!blocked && act === 'chat' && <Chat pop={pop} />}</div>
        {!blocked && act === 'disk' && <DiskStage />}
        {!blocked && act === 'poll' && <PollStage />}
        {!blocked && act === 'wheel' && <WheelStage />}
        {!blocked && act === 'cards' && <CardsStage />}
      </main>
      <div className="backdrop" onClick={() => setRightOpen(false)} />
      <aside className="drawer drawer-right">{!first && <>
        <div className="tabs">
          {(['profile', 'extension', 'game'] as const).map(t => <button key={t} type="button" className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{{ profile: 'Profil', extension: 'Extension', game: 'Partie' }[t]}</button>)}
          <button className="icon-btn" type="button" onClick={() => setRightOpen(false)} title="Fermer" aria-label="Fermer"><Icon name="close" /></button></div>
        <div className="drawer-body">{tab === 'profile' ? <Profile pop={pop} onCode={() => setCodeModal({ first: false, start: null })} />
          : tab === 'extension' ? <ExtensionTab setDevice={setDevice} />
          : <GameTab />}</div></>}</aside>
    </div>
    {codeModal && <CodeModal first={codeModal.first} start={codeModal.start} onClose={() => setCodeModal(null)} onDone={() => setCodeModal(null)} />}
    <div ref={popHost} />
  </>;
}

/** Profil: pseudo, colour (a rainbow slider; applied 3 s after the last move, refused too close to another player), my
 *  double-click reaction, then Compte. */
function Profile({ pop, onCode }: { pop: EmojiPop | null; onCode: () => void }) {
  const account = useStore(s => s.account), room = useStore(s => s.room), set = useStore(s => s.set);
  const [name, setName] = useState(account?.name ?? '');
  const me = room?.members.find(m => m.id === account?.id);
  const [hue, setHue] = useState<number | null>(null), [hueNote, setHueNote] = useState('');
  const timer = useRef(0);
  if (!account) return null;
  const others = room?.members.filter(m => m.id !== account.id) ?? [];
  const close = (h: number) => others.find(m => hueDistance(m.hue, h) < MIN_HUE_GAP);
  const save = async (p: { name?: string; hue?: number; quick?: string }) => { const r = await request('profile:update', p); if (r.ok) set({ account: r.value }); else set({ note: r.error }); };
  const shown = hue ?? me?.hue ?? account.hue ?? 222;
  const pos = (v: number) => `calc(11px + (100% - 22px) * ${(v / 359).toFixed(4)})`;
  return <>
    <PhotoField />
    <label className="field"><span>Pseudo</span><input name="pseudo" value={name} maxLength={20} onChange={e => setName(e.target.value)}
      onBlur={() => { if (name.trim() && name.trim() !== account.name) void save({ name: name.trim() }); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
    <div className="field"><span>Couleur</span>
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
      </div>
      <p className="note">{hueNote}</p></div>
    <div className="field"><span>Réaction au double-clic</span>
      <button className="quick-btn" type="button" onClick={ev => void pop?.open(ev.currentTarget, e => { if (!e.startsWith(':')) void save({ quick: e }); })} title="Changer d'emoji">
        <Html className="quick-emoji" html={emojiHtml(account.quick || '\u{1F44D}\u{FE0F}', [])} /><small>Changer</small></button>
      <p className="note">Double-clique sur un message pour réagir avec cet emoji.</p></div>
    <AccountSection onChange={onCode} />
  </>;
}

function ExtensionTab({ setDevice }: { setDevice: (p: Partial<ReturnType<typeof useStore.getState>['device']>) => void }) {
  const device = useStore(s => s.device);
  const [server, setServer] = useState(device.server);
  return <>
    <label className="field"><span>Serveur</span><input value={server} spellCheck={false} onChange={e => setServer(e.target.value)}
      onBlur={() => { const v = server.trim().replace(/\/+$/, ''); if (v && v !== device.server) { setDevice({ server: v }); connect(); } }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
    {isInsecureUrl(device.server) && <p className="alert">Connexion non chiffrée : ton code et tes messages circulent en clair jusqu'à ce serveur.</p>}
    <RoomList />
    <label className="field"><span>Thème</span><select value={device.theme} onChange={e => setDevice({ theme: e.target.value as 'auto' })}>
      <option value="auto">Système</option><option value="light">Clair</option><option value="dark">Sombre</option></select></label>
  </>;
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
  return <div className="field"><span>Photo de profil <small>dans ce salon</small></span>
    <div className="photo-row"><span className="photo-wrap"><Avatar name={me.name} hue={me.hue} photo={me.photo} size="lg" />
      {me.photo && <button className="photo-del" type="button" onClick={() => void request('photo:set', { mediaId: null })} title="Retirer la photo : ta lettre sur ta couleur revient" aria-label="Retirer la photo"><Icon name="close" /></button>}</span>
      <button className="btn ghost sm" type="button" disabled={busy} onClick={() => file.current?.click()}><Icon name="camera" />{busy ? 'Envoi…' : me.photo ? 'Changer de photo' : 'Ajouter une photo'}</button></div>
    <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void choose(f); }} />
    <p className="note">{note ? <b>{note}</b> : 'Propre à ce salon : chaque salon a la sienne. Coupée en carré, au milieu de l\'image ; l\'ancienne est supprimée.'}</p></div>;
}

/** Partie: the activity first (the host changes it, the others see it), then its settings. */
function GameTab() {
  const room = useStore(s => s.room), me = useStore(s => s.account)?.id, set = useStore(s => s.set);
  if (!room) return <p className="note">Entre dans un salon pour voir sa partie.</p>;
  const host = room.hostId === me, act = room.activity.activity;
  const names: Record<string, string> = { chat: 'Chat', disk: 'Demi-disque', poll: 'Sondage', wheel: 'Roulette', cards: 'Cartes', lowtide: 'Low Tide' };
  const choose = async (a: ActivityChoice['activity']) => { const r = await request('activity:choose', { choice: { activity: a } }); if (!r.ok) set({ note: r.error }); };
  return <>
    <label className="field"><span>Activité</span><select value={act} disabled={!host} onChange={e => void choose(e.target.value as ActivityChoice['activity'])}>
      {Object.entries(names).map(([k, n]) => <option key={k} value={k} disabled={!READY_ACTIVITIES.includes(k as ActivityChoice['activity'])}>{n}{READY_ACTIVITIES.includes(k as ActivityChoice['activity']) ? '' : ' (bientôt)'}</option>)}</select></label>
    {!host && <p className="note">Seul l'hôte change l'activité ; les autres la proposent au vote avec /activity.</p>}
    <hr />
    {act === 'disk' ? <DiskSettings /> : act === 'poll' ? <PollSettings /> : act === 'wheel' ? <p className="note">Les propositions et leurs poids se règlent dans la zone de jeu : tout le monde voit la roue se construire.</p> : <p className="note">Rien à régler : le chat prend toute la place, la liste des joueurs est à gauche. Les scores ne bougent pas.</p>}
  </>;
}

/** The server refused my code, or this version of the extension. */
function FatalPage({ onCode }: { onCode: (m: CodeMode) => void }) {
  const fatal = useStore(s => s.fatal);
  if (fatal === 'protocol') return <div className="room-card offline"><h1>Mets l'extension à jour</h1><p>Le serveur attend une version plus récente de l'extension.</p>
    <a className="btn big" href={RELEASES} target="_blank" rel="noopener noreferrer">Télécharger la dernière version</a></div>;
  if (fatal === 'limited') return <div className="room-card offline"><h1>Trop d'essais</h1><p>Le serveur a reçu trop de codes inconnus depuis ta connexion. Réessaie dans une minute.</p>
    <button className="btn big" type="button" onClick={() => connect()}><Icon name="reset" />Réessayer</button></div>;
  return <div className="room-card unknown"><h1>{fatal === 'code' ? 'Code invalide' : 'Ce code a été remplacé'}</h1>
    <p>{fatal === 'code' ? 'Ce code utilisateur n\'est pas valable.' : 'Ton code a été renouvelé sur un autre appareil (ou par un admin) : tape le nouveau (Profil → Compte sur ton autre appareil).'}</p>
    <button className="btn big" type="button" onClick={() => onCode('resume')}>J'ai le nouveau code</button>
    <button className="btn ghost" type="button" onClick={() => onCode('new')}>Repartir de zéro</button></div>;
}

function OfflinePage() {
  const server = useStore(s => s.device.server);
  return <div className="room-card offline"><h1>Serveur injoignable</h1><p>Aucune réponse de {server}. Vérifie l'adresse du serveur, ou ta connexion.</p>
    <button className="btn big" type="button" onClick={() => connect()}><Icon name="reset" />Réessayer</button></div>;
}

