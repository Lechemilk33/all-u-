/**
 * Service worker: runs the auditor in the active tab when the icon is clicked.
 *
 * `activeTab` rather than a blanket host permission is deliberate. It grants
 * access to one tab, only on an explicit click, so the install carries no
 * "read all your data on every website" warning — which is the single biggest
 * reason people abandon an extension install page.
 *
 * `chrome.scripting.executeScript` runs in the extension's isolated world, so
 * the page's own Content-Security-Policy does not apply. That is the capability
 * the bookmarklet cannot have: a strict CSP blocks an injected script outright,
 * and a large share of the sites most worth auditing set one.
 */

const RESTRICTED = /^(chrome|edge|about|devtools|chrome-extension|moz-extension|view-source):/i;
const WEBSTORE = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

async function notifyCannotRun(tabId: number, reason: string): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (message: string) => {
        // eslint-disable-next-line no-alert
        window.alert(message);
      },
      args: [reason],
    });
  } catch {
    // Even the notice cannot run on a restricted page; the badge is the fallback.
    await chrome.action.setBadgeText({ tabId, text: '—' });
    await chrome.action.setTitle({ tabId, title: reason });
  }
}

/** Runs the auditor in one tab. Shared by the toolbar click and the message API. */
export async function auditTab(tab: chrome.tabs.Tab): Promise<{ ok: boolean; error?: string }> {
  {
    if (typeof tab.id !== 'number') return { ok: false, error: 'No tab.' };

    const url = tab.url ?? '';
    if (RESTRICTED.test(url) || WEBSTORE.test(url)) {
      const message =
        'Curbcut cannot audit browser pages or the Chrome Web Store. Open a normal web page and try again.';
      await notifyCannotRun(tab.id, message);
      return { ok: false, error: message };
    }

    await chrome.action.setBadgeText({ tabId: tab.id, text: '…' });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#1b4dd1' });

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: ['audit.js'],
      });
      await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#a01521' });
      await chrome.action.setTitle({ tabId: tab.id, title: `Curbcut could not run here: ${reason}` });
      return { ok: false, error: reason };
    }
  }
}

chrome.action.onClicked.addListener((tab) => {
  void auditTab(tab);
});

/**
 * Message entry point, so the audit can be triggered by something other than a
 * toolbar click — a future popup, a keyboard command, or a test harness.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if ((message as { type?: string })?.type !== 'curbcut:audit-active-tab') return undefined;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    sendResponse(tab ? await auditTab(tab) : { ok: false, error: 'No active tab.' });
  })();
  return true;
});

// A fresh navigation invalidates the previous result, so clear the badge.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') void chrome.action.setBadgeText({ tabId, text: '' });
});

// Exposed for the end-to-end test, which drives the same path a click does.
// Harmless in production: the service worker's globals are not reachable from
// any page, and this adds no permission or listener of its own.
(globalThis as unknown as { __curbcutAuditTab: typeof auditTab }).__curbcutAuditTab = auditTab;
