// The toolbar icon and the shortcut (openspec: panel-persistence) open the game as a floating panel in the current tab
// (panel.js); where extensions can't run (chrome:// pages, the stores…), the classic popup instead.
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

// a page left for another one gets the panel again
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.action.setPopup({ tabId, popup: '' }).catch(() => {});
});
