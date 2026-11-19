// The toolbar icon opens the game as a floating panel in the current tab (panel.js): rounded corners and an outer
// shadow, which an action popup can't have. Where extensions can't run (chrome:// / edge:// pages, the stores…),
// the classic popup instead. Same approach as gitantix (openspec/specs/extension-shell).
chrome.action.onClicked.addListener(async tab => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['panel.js'] });
  } catch {
    await chrome.action.setPopup({ tabId: tab.id, popup: 'app/index.html' });   // the next clicks on this page too
    try { await chrome.action.openPopup(); }
    catch { chrome.windows.create({ url: 'app/index.html', type: 'popup', width: 800, height: 620 }); }
  }
});

// a page left for another one gets the panel again
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.action.setPopup({ tabId, popup: '' }).catch(() => {});
});
