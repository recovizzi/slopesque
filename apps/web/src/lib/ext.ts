// The extension's own settings, from its pages (openspec: panel-persistence): the keyboard shortcut, and « Rester
// ouvert sur toutes les pages » (the permission to every site asked at that moment, a content script registered).
declare const chrome: any;
declare const browser: any;

export const inExtension = () => typeof chrome !== 'undefined' && !!chrome.runtime?.id;
const firefox = () => typeof browser !== 'undefined' && !!browser.commands?.update;
const SITES = ['https://*/*', 'http://*/*'];

export async function shortcut(): Promise<string> {
  if (!inExtension() || !chrome.commands?.getAll) return '';
  const all = await chrome.commands.getAll();
  return all.find((c: { name: string }) => c.name === 'toggle-panel')?.shortcut ?? '';
}

/** Firefox changes the shortcut here; Chrome and Edge only in their own page (opened in a new tab). */
export const canEditShortcut = () => firefox();
export async function setShortcut(value: string) { await browser.commands.update({ name: 'toggle-panel', shortcut: value }); }
export function openShortcutsPage() {
  const url = navigator.userAgent.includes('Edg/') ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
  chrome.tabs.create({ url });
}

export async function persistent(): Promise<boolean> {
  if (!inExtension()) return false;
  const { 'slp-persist': on } = await chrome.storage.local.get({ 'slp-persist': false });
  return !!on && await chrome.permissions.contains({ origins: SITES });
}

/** On: asks the browser for every site (refused: stays off, with the reason); the service worker then puts the panel in
 *  every page loaded (and in the tabs already open). Off: the option and the permission go. */
export async function setPersistent(on: boolean): Promise<string> {
  if (!inExtension()) return 'Seulement dans l\'extension.';
  if (on) {
    let granted: boolean;
    try { granted = await chrome.permissions.request({ origins: SITES }); } catch (e) { return `Le navigateur a refusé la demande : ${(e as Error).message}`; }
    if (!granted) return 'Permission refusée par le navigateur : le panneau reste dans l\'onglet où il est ouvert.';
    await chrome.storage.local.set({ 'slp-open': true, 'slp-persist': true });
    return '';
  }
  await chrome.storage.local.set({ 'slp-persist': false });
  await chrome.permissions.remove({ origins: SITES }).catch(() => {});
  return '';
}
