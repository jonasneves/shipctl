// Background service worker for ShipCTL extension
// Opens side panel when extension icon is clicked

// OAuth Configuration
const OAUTH_PROXY_URL = 'https://oauth.neevs.io';
const GITHUB_CLIENT_ID = 'Ov23liYGP51S3C7hcc8C';
const GITHUB_SCOPES = 'repo workflow read:user';

// Enable side panel to open when clicking the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Native messaging host for local backend control
const NATIVE_HOST_NAME = 'io.neevs.serverless_llm';

function sendNativeMessage(payload) {
  return new Promise((resolve) => {
    if (chrome.runtime.sendNativeMessage) {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload, (response) => {
        const err = chrome.runtime.lastError?.message;
        if (err) resolve({ ok: false, error: err });
        else resolve(response);
      });
      return;
    }

    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      let settled = false;
      let receivedMessage = false;
      let disconnectTimer = null;

      const finish = (response) => {
        if (settled) return;
        settled = true;
        if (disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
        }
        try {
          port.disconnect();
        } catch {}
        resolve(response);
      };

      port.onMessage.addListener((message) => {
        receivedMessage = true;
        finish(message);
      });
      port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message;
        if (receivedMessage) return;

        // In practice the native host can exit quickly after replying; Chrome may fire onDisconnect
        // before onMessage, so wait briefly before reporting an error.
        disconnectTimer = setTimeout(() => {
          if (receivedMessage) return;
          finish({ ok: false, error: err || 'Native host disconnected' });
        }, 50);
      });

      port.postMessage(payload);
    } catch (e) {
      resolve({ ok: false, error: e?.message || String(e) });
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'GITHUB_OAUTH') {
    handleGitHubOAuth().then(sendResponse).catch(err => {
      console.error('[background] OAuth error:', err.message);
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'HEALTH_CHECK') {
    handleHealthCheck(message.url, message.timeout).then(sendResponse);
    return true;
  }

  if (message.type !== 'native_backend') return;

  (async () => {
    const payload = message.payload || {};
    const response = await sendNativeMessage(payload);
    if (!response.ok) console.error('[background] Native host error:', response.error);
    sendResponse(response);
  })();

  return true;
});

async function handleHealthCheck(url, timeout = 5000) {
  const start = Date.now();
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeout),
    });
    const latency = Date.now() - start;
    return { status: response.ok ? 'ok' : 'down', latency };
  } catch {
    return { status: 'down' };
  }
}

async function handleGitHubOAuth() {
  if (!chrome.identity || !chrome.identity.launchWebAuthFlow) {
    throw new Error('OAuth not available. Reload the extension.');
  }

  const extensionId = chrome.runtime.id;
  const state = btoa(JSON.stringify({ provider: 'github', extensionId }));

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${encodeURIComponent(GITHUB_SCOPES)}&redirect_uri=${encodeURIComponent(OAUTH_PROXY_URL + '/callback')}&state=${state}`;

  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  });

  const url = new URL(redirectUrl);
  const code = url.searchParams.get('code');

  if (!code) {
    throw new Error('No authorization code received');
  }

  const tokenResponse = await fetch(`${OAUTH_PROXY_URL}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, provider: 'github', client_id: GITHUB_CLIENT_ID })
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    throw new Error(tokenData.error);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get user info');
  }

  const userData = await userResponse.json();

  return {
    access_token: tokenData.access_token,
    username: userData.login
  };
}
