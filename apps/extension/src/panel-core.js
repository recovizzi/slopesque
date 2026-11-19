// The floating panel (openspec: extension-shell, panel-persistence): it frames app/index.html?embed (the web app, with
// the extension's APIs) in a rounded card with an outer shadow, resizable by its bottom corners (size kept in
// chrome.storage.local.panelSize). Shared by panel.js (the icon, the shortcut) and panel-auto.js (« Rester ouvert sur
// toutes les pages »): one panel per page, in the extension's isolated world.
export function panel() {
  if (globalThis.__slpPanel) return globalThis.__slpPanel;
  let host = null;
  // open as soon as asked (the card is added to the page a moment later, once its size is read): isOpen() must say so at once
  const api = globalThis.__slpPanel = { isOpen: () => host !== null, open, close, toggle: () => (api.isOpen() ? close() : open()) };
  // the app asks to close (✕, Échap): closed here, and on every page when the panel follows the pages
  addEventListener('message', e => { if (host && e.source === host.__frame?.contentWindow && e.data?.scd === 'close') { close(); chrome.storage.local.set({ 'slp-open': false }); } });
  return api;

  function close() { host?.remove(); host = null; }

  function open() {
  if (api.isOpen()) return;
  const MIN = { w: 360, h: 420 }, GAP = 12;
  const vw = () => document.documentElement.clientWidth || innerWidth, vh = () => innerHeight;
  host = document.createElement('slp-panel');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    .card { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; background: Canvas;
      box-shadow: 0 0 0 1px rgb(128 128 128 / .3), 0 2px 6px rgb(0 0 0 / .12), 0 16px 40px rgb(0 0 0 / .28); }
    iframe { display: block; width: 100%; height: 100%; border: 0; }
    .grip { position: absolute; bottom: 0; width: 16px; height: 16px; cursor: nesw-resize; left: 0; z-index: 1; }
    .grip::after { content: ""; position: absolute; inset: 2px; opacity: .5;
      background: linear-gradient(45deg, transparent 0 45%, #8c959f 45% 52%, transparent 52% 65%, #8c959f 65% 72%, transparent 72%); }
    .grip:hover::after { opacity: 1; }
    .grip-r { left: auto; right: 0; cursor: nwse-resize; }
    .grip-r::after { transform: scaleX(-1); }
    .busy iframe { pointer-events: none; }
  </style>
  <div class="card"><iframe allow="clipboard-write" title="Slopesque"></iframe></div>
  <div class="grip" data-dir="-1" title="Redimensionner"></div><div class="grip grip-r" data-dir="1" title="Redimensionner"></div>`;
  const card = shadow.querySelector('.card'), frame = shadow.querySelector('iframe');

  let box = { w: 780, h: 620, x: vw() - 780 - GAP, y: GAP };
  const place = () => {
    box.w = Math.max(MIN.w, Math.min(box.w, vw() - 2 * GAP));
    box.h = Math.max(MIN.h, Math.min(box.h, vh() - 2 * GAP));
    box.x = Math.max(GAP, Math.min(box.x, vw() - box.w - GAP));
    host.style.cssText = `all: initial !important; position: fixed !important; z-index: 2147483647 !important; display: block !important;
      left: ${box.x}px !important; top: ${box.y}px !important; width: ${box.w}px !important; height: ${box.h}px !important;`;
  };
  addEventListener('resize', place);

  for (const grip of shadow.querySelectorAll('.grip')) {
    grip.addEventListener('pointerdown', e => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      card.classList.add('busy');   // the frame would swallow the pointer
      const dir = +grip.dataset.dir, x0 = e.clientX, y0 = e.clientY, start = { ...box };
      const move = ev => {
        const dx = ev.clientX - x0;
        box.w = dir < 0 ? Math.min(start.w - dx, start.x + start.w - GAP) : start.w + dx;
        box.h = start.h + ev.clientY - y0;
        box.w = Math.max(MIN.w, Math.min(box.w, vw() - 2 * GAP));
        box.x = dir < 0 ? start.x + start.w - box.w : start.x;   // the left grip moves the left edge
        place();
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', () => {
        grip.removeEventListener('pointermove', move);
        card.classList.remove('busy');
        chrome.storage.local.set({ panelSize: { w: box.w, h: box.h } });
      }, { once: true });
    });
  }

  host.__frame = frame;
  const me = host;
  new MutationObserver((_, mo) => { if (!me.isConnected) { removeEventListener('resize', place); mo.disconnect(); } })
    .observe(document.documentElement, { childList: true });

  frame.addEventListener('load', () => frame.focus(), { once: true });
  frame.src = chrome.runtime.getURL('app/index.html?embed');
  // shown at the size kept from last time, not resized after (the layout would jump)
  chrome.storage.local.get({ panelSize: null }, ({ panelSize }) => {
    if (panelSize) { box.x += box.w - panelSize.w; box.w = panelSize.w; box.h = panelSize.h; }
    place();
    if (host === me) document.documentElement.append(me);
  });
  }
}
