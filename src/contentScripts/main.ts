// Main content script (ISOLATED world). Runs in iframes embedded in the ChatHub page.
// Receives messages from parent via window.postMessage and drives the AI platform UI:
// fill input, click send button, coordinate long-screenshot scrolling.

import { addPostMessageListener, sendToParent } from '../utils/messaging';
import {
  ActionEngine,
  detectBrowser,
  fillInput,
  findInputElement,
  isInExtensionFrame,
  resolveSelector,
  triggerSend,
  wait,
} from '../utils/dom';
import { detectScrollContainer, getAllElementsIncludingShadow, getOffsetParent, getRectInfo } from '../utils/screenshot';
import { AppErrorType } from '../utils/constants';
import type { ChatAppConfig } from '../types';

const isFirefox = detectBrowser() === 'Firefox';

let config: ChatAppConfig | null = null;

const captureState: {
  scrollContainer?: HTMLElement;
  containerInfo?: ReturnType<typeof getRectInfo>;
  scrollPosition?: { left: number; top: number };
  reverseScrollY?: boolean;
  hiddenStyleMap?: Map<Element, string>;
} = {};

function resetCaptureState() {
  captureState.scrollContainer = undefined;
  captureState.containerInfo = undefined;
  captureState.scrollPosition = undefined;
  captureState.reverseScrollY = undefined;
  captureState.hiddenStyleMap = undefined;
}

async function loadConfig() {
  try {
    config = await sendToParent<ChatAppConfig>('getConfig');
  } catch (err) {
    console.error('[content] failed to get config', err);
  }
}

async function awaitReady() {
  if (!config) return;
  const tick = async () => {
    if (!config) return;
    const el = findInputElement(config.inputSelector);
    if (el) {
      if (config.readyActions) {
        try { await ActionEngine.run(config.readyActions); } catch (err) { console.warn(err); }
      }
      sendToParent('contentReady').catch(() => {});
      return;
    }
    setTimeout(tick, 200);
  };
  tick();
}

async function sendText(text: string) {
  if (!config) {
    console.error('[content] no config loaded');
    return;
  }
  try {
    if (config.inputActions) {
      try { await ActionEngine.run(config.inputActions); } catch (err) { console.warn('input actions failed', err); }
    }
    const input = findInputElement(config.inputSelector);
    if (!input) throw new Error('Cannot find input element');

    await fillInput(input, text, isFirefox ? config.firefoxInputMethod : config.inputMethod);
    await wait(300);

    if (config.sendActions) {
      try { await ActionEngine.run(config.sendActions); } catch (err) { console.warn('send actions failed', err); }
    }

    if (config.sendButtonSelector) {
      const btn = resolveSelector(config.sendButtonSelector) as HTMLElement | null;
      if (!btn) throw new Error('Cannot find send button');
      await triggerSend(btn, 'click');
    } else {
      await triggerSend(input, 'enter');
    }
    sendToParent('contentReady').catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    sendToParent('contentError', { type: AppErrorType.SendFailed, extra: msg }).catch(() => {});
    sendToParent('logError', {
      error: { message: msg, stack: (err as Error).stack },
      extra: { chatAppId: config.id, contentUrl: location.href, action: 'sendText' },
    }).catch(() => {});
  }
}

async function captureStart() {
  endCapture();
  if (!config) return null;
  const el = config.scrollContainerSelector
    ? (resolveSelector(config.scrollContainerSelector) as HTMLElement | null)
    : detectScrollContainer();
  if (!el) return null;

  captureState.scrollContainer = el;
  const info = getRectInfo(el);
  if (info.scrollHeight === 0 || info.scrollWidth === 0) {
    resetCaptureState();
    return null;
  }
  captureState.containerInfo = info;
  captureState.scrollPosition = { left: el.scrollLeft, top: el.scrollTop };
  captureState.reverseScrollY =
    window.getComputedStyle(el).getPropertyValue('flex-direction') === 'column-reverse';

  triggerScroll({ left: 0, top: 0 });
  await wait(500);

  // Hide fixed/sticky overlays that would smear the stitched screenshot.
  const allElements = getAllElementsIncludingShadow();
  const hiddenMap = new Map<Element, string>();
  captureState.hiddenStyleMap = hiddenMap;
  const candidates: Element[] = [];
  for (const e of allElements) {
    if (e.contains(el)) continue;
    if (el.contains(e)) {
      const pos = window.getComputedStyle(e).position;
      if (pos === 'absolute') {
        const offsetParent = getOffsetParent(e);
        if (!el.contains(offsetParent)) candidates.push(e);
      } else if (pos === 'fixed' || pos === 'sticky') {
        candidates.push(e);
      }
    } else {
      candidates.push(e);
    }
  }
  const seen = new Set<Element>();
  const final: Element[] = [];
  for (const e of candidates) {
    let p: Node | null = e.parentNode;
    let nested = false;
    while (p && p !== document) {
      if (p instanceof Element && seen.has(p)) { nested = true; break; }
      p = p instanceof ShadowRoot ? p.host : p.parentNode;
    }
    if (!nested) { seen.add(e); final.push(e); }
  }
  final.forEach(e => {
    const style = e.getAttribute('style') || '';
    hiddenMap.set(e, style);
    e.setAttribute('style', `${style};visibility:hidden!important;opacity:0!important;`);
  });
  await wait(500);
  return info;
}

function triggerScroll(pos: { left: number; top: number }): { left: number; top: number } {
  const el = captureState.scrollContainer;
  if (!el) throw new Error('capture not initialized');
  let offsetY = 0;
  if (captureState.reverseScrollY) {
    const info = captureState.containerInfo;
    if (!info) throw new Error('capture info missing');
    offsetY = info.scrollHeight - info.clientHeight;
  }
  el.scrollTo({ left: pos.left, top: pos.top - offsetY, behavior: 'instant' as ScrollBehavior });
  return { left: el.scrollLeft, top: el.scrollTop + offsetY };
}

function endCapture() {
  const el = captureState.scrollContainer;
  const sp = captureState.scrollPosition;
  const hiddenMap = captureState.hiddenStyleMap;
  try {
    if (el && sp) el.scrollTo({ left: sp.left, top: sp.top, behavior: 'instant' as ScrollBehavior });
  } catch (err) {
    console.warn('restore scroll failed', err);
  }
  hiddenMap?.forEach((style, e) => {
    try { e.setAttribute('style', style); } catch {}
  });
  resetCaptureState();
}

if (isInExtensionFrame()) {
  loadConfig().then(() => awaitReady());

  addPostMessageListener(async (action, data) => {
    switch (action) {
      case 'sendText':
        await sendText((data as { text: string }).text);
        return null;
      case 'newChatPreprocess':
        if (config?.newChatActions) {
          try { await ActionEngine.run(config.newChatActions); } catch (err) { console.warn(err); }
        }
        return null;
      case 'getLocationHref':
        return window.location.href;
      case 'captureStart':
        return (await captureStart()) ?? null;
      case 'triggerScroll':
        return triggerScroll(data as { left: number; top: number });
      case 'captureEnd':
        endCapture();
        return null;
      default:
        return undefined;
    }
  });
}

export {};
