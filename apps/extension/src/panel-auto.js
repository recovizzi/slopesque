// Injected by background.js in every page loaded while « Rester ouvert sur toutes les pages » is on: the panel opens
// where it was open, and opens or closes everywhere at once (slp-open). Injected again on each load: done once per page.
import { panel } from './panel-core.js';

if (!globalThis.__slpAuto) {
  globalThis.__slpAuto = true;
  const p = panel();
  chrome.storage.local.get({ 'slp-open': false }, ({ 'slp-open': open }) => { if (open) p.open(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('slp-open' in changes)) return;
    if (changes['slp-open'].newValue) p.open(); else p.close();
  });
}
