// Injected by the icon or the shortcut (background.js): opens or closes the panel on this page. The state is shared
// (slp-open): with « Rester ouvert sur toutes les pages », every page follows it (panel-auto.js).
import { panel } from './panel-core.js';

const p = panel();
p.toggle();
chrome.storage.local.set({ 'slp-open': p.isOpen() });
