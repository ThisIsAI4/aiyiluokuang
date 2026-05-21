import { PROTOCOL_SOURCE } from './constants';
import type { ProtocolMessage } from '../types';

declare global {
  interface Window {
    __SCH_WINDOW__?: Window;
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function sendToParent<R = unknown>(action: string, data?: unknown, timeout = 3000): Promise<R> {
  return new Promise((resolve, reject) => {
    const id = makeId();
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(`[postMessage] timeout: ${action}`));
    }, timeout);

    const handler = (event: MessageEvent) => {
      const msg = event.data as ProtocolMessage<R> | undefined;
      if (!msg || msg.source !== PROTOCOL_SOURCE || msg.type !== 'response' || msg.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.data as R);
    };
    window.addEventListener('message', handler);

    const payload: ProtocolMessage = {
      source: PROTOCOL_SOURCE,
      type: 'request',
      action,
      id,
      data,
    };
    const target = window.__SCH_WINDOW__ || window.parent;
    target.postMessage(payload, '*');
  });
}

export function sendToIframe<R = unknown>(
  iframe: HTMLIFrameElement,
  action: string,
  data?: unknown,
  timeout = 3000,
): Promise<R> {
  return new Promise((resolve, reject) => {
    if (!iframe.contentWindow) {
      reject(new Error('[postMessage] iframe contentWindow not available'));
      return;
    }
    const id = makeId();
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(`[postMessage] timeout: ${action}`));
    }, timeout);

    const handler = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const msg = event.data as ProtocolMessage<R> | undefined;
      if (!msg || msg.source !== PROTOCOL_SOURCE || msg.type !== 'response' || msg.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.data as R);
    };
    window.addEventListener('message', handler);

    const payload: ProtocolMessage = { source: PROTOCOL_SOURCE, type: 'request', action, id, data };
    iframe.contentWindow.postMessage(payload, '*');
  });
}

export type RequestHandler = (action: string, data: unknown, source?: MessageEventSource | null) => Promise<unknown> | unknown;

/**
 * Listens for cross-window RPC requests.
 * Handlers that don't recognize an action MUST return `undefined` — the listener
 * will then skip replying so another listener (e.g. a panel-scoped one) can answer.
 * Handlers that handled the request should return a real value (use `null` instead
 * of `undefined` for a "void OK" response).
 */
export function addPostMessageListener(
  handler: RequestHandler,
  filter?: (source: MessageEventSource | null) => boolean,
) {
  const listener = async (event: MessageEvent) => {
    const msg = event.data as ProtocolMessage | undefined;
    if (!msg || msg.source !== PROTOCOL_SOURCE || msg.type !== 'request') return;
    if (filter && !filter(event.source)) return;
    try {
      const data = await handler(msg.action, msg.data, event.source);
      if (data === undefined) return; // not handled — let other listeners reply
      if (event.source && 'postMessage' in event.source) {
        const reply: ProtocolMessage = {
          source: PROTOCOL_SOURCE,
          type: 'response',
          action: msg.action,
          id: msg.id,
          data,
        };
        (event.source as Window).postMessage(reply, '*');
      }
    } catch (err) {
      if (event.source && 'postMessage' in event.source) {
        const reply: ProtocolMessage = {
          source: PROTOCOL_SOURCE,
          type: 'response',
          action: msg.action,
          id: msg.id,
          error: err instanceof Error ? err.message : String(err),
        };
        (event.source as Window).postMessage(reply, '*');
      }
    }
  };
  window.addEventListener('message', listener);
  return listener;
}

export function removePostMessageListener(listener: (e: MessageEvent) => void) {
  window.removeEventListener('message', listener);
}

export function sendRuntimeMessage<R = unknown>(action: string, data?: unknown): Promise<R> {
  return chrome.runtime.sendMessage({ source: PROTOCOL_SOURCE, action, data });
}

export function addRuntimeListener(
  handler: (action: string, data: unknown) => Promise<unknown> | unknown,
) {
  const listener = (
    msg: { source?: string; action?: string; data?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (!msg || msg.source !== PROTOCOL_SOURCE || !msg.action) return;
    Promise.resolve(handler(msg.action, msg.data))
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  };
  chrome.runtime.onMessage.addListener(listener);
  return listener;
}
