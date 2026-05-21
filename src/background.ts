import { ConfigManager } from './platforms/configManager';
import { ensureClientId } from './utils/storage';
import { PROTOCOL_SOURCE } from './utils/constants';
import type { ChatAppConfig } from './types';
// MAIN-world priority script is pre-bundled by scripts/build-priority.mjs as an IIFE.
// Vite copies public/priority.js verbatim to dist/priority.js — accessible from extension root.
const PRIORITY_SCRIPT_URL = 'priority.js';
// @ts-expect-error -- CRXJS ?script suffix returns the compiled URL.
import mainScriptUrl from './contentScripts/main.ts?script';
const MAIN_SCRIPT_URL = mainScriptUrl as string;

const EXTENSION_HOSTNAME = new URL(chrome.runtime.getURL('')).hostname;

const chromeMajor = parseInt(
  (navigator.userAgent.toLowerCase().match(/chrome\/(\d+)/) || ['', '0'])[1],
  10,
);

function buildHeaderRule(initiatorDomains: string[], resourceTypes?: chrome.declarativeNetRequest.ResourceType[]) {
  const rule: chrome.declarativeNetRequest.Rule = {
    id: 0,
    priority: 1,
    action: {
      type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [
        { header: 'Sec-Fetch-Dest', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: 'document' },
        { header: 'Sec-Fetch-Site', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: 'same-origin' },
      ],
      responseHeaders: [
        { header: 'X-Frame-Options', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
        { header: 'Content-Security-Policy', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
      ],
    },
    condition: { initiatorDomains } as chrome.declarativeNetRequest.RuleCondition,
  };
  if (resourceTypes) (rule.condition as any).resourceTypes = resourceTypes;
  // Chrome < 101 uses `domains` instead of `initiatorDomains`
  if (chromeMajor !== 0 && chromeMajor < 101) {
    (rule.condition as any).domains = (rule.condition as any).initiatorDomains;
    delete (rule.condition as any).initiatorDomains;
  }
  return rule;
}

function buildAllRules(apps: ChatAppConfig[]): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  // Own pages can iframe everything
  rules.push(buildHeaderRule([EXTENSION_HOSTNAME]));
  // Perplexity requires document-level rule (no sub_frame restriction)
  const perplexity = apps.filter(a => a.id === 'Perplexity');
  const others = apps.filter(a => a.id !== 'Perplexity');
  if (others.length) {
    rules.push(buildHeaderRule(
      others.map(a => new URL(a.url).hostname),
      ['sub_frame' as chrome.declarativeNetRequest.ResourceType],
    ));
  }
  if (perplexity.length) {
    rules.push(buildHeaderRule(perplexity.map(a => new URL(a.url).hostname)));
  }
  apps.forEach(a => {
    a.networkRules?.forEach(r => rules.push(r));
  });
  return rules.map((r, idx) => ({ ...r, id: idx + 1, priority: 1 }));
}

async function syncDynamicRules() {
  const bundle = await ConfigManager.getCurrentConfig();
  const rules = buildAllRules(bundle.chatApps);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(r => r.id),
    addRules: rules,
  });
}

const PRIORITY_SCRIPT = PRIORITY_SCRIPT_URL;
const MAIN_SCRIPT = MAIN_SCRIPT_URL;

let registering = false;
async function registerContentScripts() {
  if (registering) return;
  registering = true;
  try {
    const bundle = await ConfigManager.getCurrentConfig();
    const matches = bundle.chatApps.map(a => a.url + '*');
    try {
      const existing = await chrome.scripting.getRegisteredContentScripts();
      if (existing.length) {
        await chrome.scripting.unregisterContentScripts({ ids: existing.map(s => s.id) });
      }
    } catch (err) {
      console.error('[background] unregister existing scripts failed', err);
    }
    await chrome.scripting.registerContentScripts([
      {
        id: 'priority-script',
        matches,
        js: [PRIORITY_SCRIPT],
        allFrames: true,
        runAt: 'document_start',
        world: 'MAIN' as chrome.scripting.ExecutionWorld,
      },
      {
        id: 'main-content-script',
        matches,
        js: [MAIN_SCRIPT],
        allFrames: true,
        runAt: 'document_idle',
      },
    ]);
  } finally {
    registering = false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureClientId().catch(console.warn);
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('chatHub.html') });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.source !== PROTOCOL_SOURCE) return;
  if (msg.action === 'reloadConfigs') {
    (async () => {
      try {
        await Promise.all([syncDynamicRules(), registerContentScripts()]);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  }
  if (msg.action === 'getConfigInfo') {
    ConfigManager.getConfigInfo().then(sendResponse);
    return true;
  }
  if (msg.action === 'resetConfig') {
    (async () => {
      try {
        await ConfigManager.resetToBuiltin();
        await Promise.all([syncDynamicRules(), registerContentScripts()]);
        sendResponse({ success: true, message: 'Reset to builtin config' });
      } catch (err) {
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  }
  if (msg.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(
      { format: (msg.data?.format as 'jpeg' | 'png') || 'png', quality: msg.data?.quality ?? 70 },
      url => sendResponse({ url }),
    );
    return true;
  }
});

(async () => {
  await Promise.all([syncDynamicRules(), registerContentScripts()]);
})().catch(console.error);
