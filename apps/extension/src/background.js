// The toolbar icon and the shortcut (openspec: panel-persistence) open the game as a floating panel in the current tab
// (panel.js); where extensions can't run (chrome:// pages, the stores…), the classic popup instead. With « Rester
// ouvert sur toutes les pages » (slp-persist, and the permission to every site), every page loaded gets panel-auto.js.
const SITES = ['https://*/*', 'http://*/*'];

async function toggle(tab) {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['panel.js'] });
  } catch {
    await chrome.action.setPopup({ tabId: tab.id, popup: 'app/index.html' });   // the next clicks on this page too
    try { await chrome.action.openPopup(); }
    catch { chrome.windows.create({ url: 'app/index.html', type: 'popup', width: 800, height: 620 }); }
  }
}

chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-panel') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await toggle(tab);
});

/** The option is on and the browser gave the permission to every site. */
async function persistent() {
  const { 'slp-persist': on } = await chrome.storage.local.get({ 'slp-persist': false });
  return on && await chrome.permissions.contains({ origins: SITES });
}

async function inject(tabId) {
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ['panel-auto.js'] }); } catch { /* a page extensions can't touch */ }
}

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'loading') chrome.action.setPopup({ tabId, popup: '' }).catch(() => {});   // a page left for another one gets the panel again
  if (info.status === 'complete' && /^https?:/.test(tab.url ?? '') && await persistent()) await inject(tabId);
});

// turned on: the tabs already open get it at once
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes['slp-persist']?.newValue || !(await persistent())) return;
  for (const t of await chrome.tabs.query({ url: SITES })) if (t.id) await inject(t.id);
});
