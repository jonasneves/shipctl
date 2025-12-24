// shipctl background service worker

const NATIVE_HOST_NAME = 'io.shipctl.host';

// Open side panel when extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

// Native messaging handler
function sendNativeMessage(payload) {
  return new Promise((resolve) => {
    if (!chrome.runtime.sendNativeMessage) {
      resolve({ ok: false, error: 'Native messaging not available' });
      return;
    }

    chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload, (response) => {
      const err = chrome.runtime.lastError?.message;
      if (err) {
        resolve({ ok: false, error: err });
      } else {
        resolve(response || { ok: false, error: 'No response' });
      }
    });
  });
}

// Message handler for content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'NATIVE_MESSAGE') {
    sendNativeMessage(message.payload || {})
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'OPEN_TAB') {
    chrome.tabs.create({ url: message.url });
    sendResponse({ ok: true });
    return;
  }
});

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('shipctl installed');
    // Initialize default storage
    chrome.storage.local.set({
      projects: [],
      settings: {
        githubToken: '',
        defaultProfile: 'development',
      },
    });
  }
});
