// The ?kit page (dev only: `pnpm dev`, then http://localhost:5173/?kit): every piece of the library with its
// variants, light and dark side by side — two frames of this page, `?kit=light` and `?kit=dark`. Left out of the
// build (main.tsx imports it under import.meta.env.DEV).
import { createRoot } from 'react-dom/client';
import './kit.css';
import { KitControls } from './KitControls';
import { KitDisplay } from './KitDisplay';
import { KitOverlays } from './KitOverlays';
import { KitTokens } from './KitTokens';

function KitBody({ theme }: { theme: string }) {
  return (
    <div className="kit">
      <div className="kit-head">
        <h1>Slopesque — bibliothèque</h1>
        <span className="note">thème {theme}</span>
      </div>
      <KitTokens />
      <KitControls />
      <KitDisplay />
      <KitOverlays />
    </div>
  );
}

/** The kit in `root`: two frames (light, dark), or, inside a frame, the kit in its theme. */
export function mountKit(root: HTMLElement, theme: string) {
  if (theme !== 'light' && theme !== 'dark') {
    document.body.classList.add('kit-frames');
    createRoot(root).render(
      <>
        <iframe src="?kit=light" title="Clair" />
        <iframe src="?kit=dark" title="Sombre" />
      </>,
    );
    return;
  }
  document.documentElement.dataset.theme = theme;
  document.body.classList.add('kit', 'left-open', 'right-open'); // the drawers' demo open
  createRoot(root).render(<KitBody theme={theme === 'dark' ? 'sombre' : 'clair'} />);
}
