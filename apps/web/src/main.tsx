// The panel's app. Inside the extension (or with ?preview, or in `pnpm dev`) the game; opened as a plain web page,
// « Installer l'extension »; in `pnpm dev` with ?kit, the component library (design/kit).
import { wireTip } from './features/chat/hover';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/styles';
import { App } from './app/App';
import { loadDevice } from './lib/device';
import { connect, disconnect } from './app/net';
import { PRESENCE } from '@slopesque/shared';
import { useStore } from './app/store';

const RELEASES = 'https://github.com/recovizzi/slopesque/releases/latest';
const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const inExtension = /^(chrome|moz)-extension:$/.test(location.protocol);

if (inExtension && !params.has('embed')) document.body.classList.add('popup');
if (import.meta.env.DEV && params.has('kit')) {   // dev only: left out of the build
  (await import('./design/kit/Kit')).mountKit(root, params.get('kit') ?? '');
} else if (inExtension || import.meta.env.DEV || params.has('preview')) {
  useStore.getState().set({ device: await loadDevice() });
  if (useStore.getState().device.code) connect();
  // several tabs with the panel: only the visible one stays connected (a hidden one lets go after 30 s, panel-persistence)
  let hidden = 0;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(hidden);
    if (document.hidden) hidden = window.setTimeout(() => { disconnect(); useStore.getState().set({ conn: 'idle' }); }, PRESENCE.hiddenTabMs);
    else if (useStore.getState().conn === 'idle' && useStore.getState().device.code && !useStore.getState().fatal) connect();
  });
  wireTip();   // the names behind a count, on hover (reactions, answers)
  createRoot(root).render(<StrictMode><App /></StrictMode>);
} else {
  document.body.classList.add('install');
  createRoot(root).render(<main className="install-card">
    <h1>Slopesque</h1><p>Ce jeu se joue depuis l'extension de navigateur.</p>
    <a className="btn big" href={RELEASES} target="_blank" rel="noopener noreferrer">Installer l'extension</a>
    <p className="note">Chrome, Edge, Brave et Firefox. Une fois installée, clique sur son icône dans la barre d'outils.</p></main>);
}
