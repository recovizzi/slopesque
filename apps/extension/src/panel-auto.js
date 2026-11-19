// Registered on every page when « Rester ouvert sur toutes les pages » is on (the permission asked at that moment): the
// panel opens by itself where it was open, and opens or closes everywhere at once.
import { panel } from './panel-core.js';

const p = panel();
chrome.storage.local.get({ 'slp-open': false }, ({ 'slp-open': open }) => { if (open) p.open(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('slp-open' in changes)) return;
  if (changes['slp-open'].newValue) p.open(); else p.close();
});
