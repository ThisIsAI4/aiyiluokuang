import type { ChatAction, InputMethod, SelectorRef } from '../types';

export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function detectBrowser(): 'Chrome' | 'Edge' | 'Firefox' | 'Safari' | 'Other' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg')) return 'Edge';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  return 'Other';
}

export function isInExtensionFrame(): boolean {
  const origins = (window.location as any).ancestorOrigins as DOMStringList | undefined;
  if (!origins || origins.length === 0) return false;
  const first = origins[0];
  return (
    first.startsWith('chrome-extension://') ||
    first.startsWith('extension://') ||
    first.startsWith('moz-extension://')
  );
}

export function findInShadow(selector: string, root?: Element | ShadowRoot): Element | null {
  const stack: (Element | ShadowRoot | null)[] = [root || document.body];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if ('shadowRoot' in node && (node as Element).shadowRoot) {
      const sr = (node as Element).shadowRoot!;
      const hit = sr.querySelector(selector);
      if (hit) return hit;
      stack.push(...Array.from(sr.children));
    }
    if ('children' in node) {
      stack.push(...Array.from((node as Element).children));
    }
  }
  return null;
}

export function resolveSelector(ref: SelectorRef | undefined): Element | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref ? document.querySelector(ref) : null;
  if (Array.isArray(ref)) {
    for (const sel of ref) {
      const hit = document.querySelector(sel);
      if (hit) return hit;
    }
    return null;
  }
  if (ref.inShadowDom) {
    const root = ref.shadowRootSelector ? document.querySelector(ref.shadowRootSelector) : undefined;
    return findInShadow(ref.selector, root || undefined);
  }
  return document.querySelector(ref.selector);
}

const FALLBACK_INPUT_SELECTORS = ['div[contenteditable="true"]', 'div[contenteditable=""]', 'div[contenteditable]', 'textarea'];

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const cs = window.getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none') return false;
  if (parseFloat(cs.opacity || '1') === 0) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  return true;
}

/**
 * Pick the chat input element.
 * For platforms without an explicit `inputSelector`, we collect candidates and prefer
 * a *visible*, focusable one near the bottom of the viewport. This avoids hidden
 * helper textareas (e.g. Semi Design's auto-resize shadow textarea) and tucked-away
 * editors elsewhere on the page.
 */
export function findInputElement(ref: SelectorRef | undefined): HTMLElement | null {
  if (ref !== undefined) return resolveSelector(ref) as HTMLElement | null;
  const collected: HTMLElement[] = [];
  for (const sel of FALLBACK_INPUT_SELECTORS) {
    document.querySelectorAll(sel).forEach(el => {
      if (el instanceof HTMLElement && !collected.includes(el)) collected.push(el);
    });
  }
  const visible = collected.filter(isVisible);
  const pool = visible.length ? visible : collected;
  if (!pool.length) return null;
  // Heuristic: prefer the element nearest the bottom (chat inputs sit there).
  pool.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
  return pool[0];
}

export function focusAndSelect(el: HTMLElement) {
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
  } else if (el instanceof HTMLDivElement && el.hasAttribute('contenteditable')) {
    document.execCommand('selectAll');
  }
}

/**
 * React (and many other frameworks) intercept `.value` writes by overriding the
 * setter on the *instance*. To make a React-controlled input pick up programmatic
 * changes, we have to invoke the *prototype's* native setter directly — then
 * dispatch a synthetic `input` event. Without this, ChatGPT/ProseMirror works
 * (uses execCommand) but Z.ai/QwenChat/DouBao/etc react-controlled inputs ignore
 * `.value = "..."` and onChange never fires, so the Send button stays disabled.
 */
function reactSafeSetValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  const nativeSetter = descriptor?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  else el.value = value;
}

export async function fillInput(el: HTMLElement, text: string, method?: InputMethod) {
  const isFormElement = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

  const setText = () => {
    if (isFormElement) reactSafeSetValue(el, text);
    else (el as any).innerText = text;
  };
  const setValue = () => {
    if (isFormElement) reactSafeSetValue(el, text);
    else (el as any).innerText = text;
  };
  const paste = () => {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  };
  const exec = () => {
    const ok = document.execCommand('insertText', false, text);
    // execCommand is deprecated and a no-op on some inputs (Chrome may refuse on
    // certain frameworks). For form fields, fall back to the React-safe setter.
    if (!ok && isFormElement) reactSafeSetValue(el, text);
  };

  focusAndSelect(el);
  switch (method) {
    case 'text': setText(); break;
    case 'input': setValue(); break;
    case 'paste': paste(); break;
    case 'pasteAndText':
      paste();
      focusAndSelect(el);
      await wait(100);
      setText();
      break;
    default: exec(); break;
  }
  // input + change events let frameworks update their controlled-input state.
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  if (isFormElement) el.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function triggerSend(el: HTMLElement, mode: 'click' | 'mousedown' | 'enter') {
  if (mode === 'click' || mode === 'mousedown') {
    if (mode === 'click') {
      // Some frameworks listen on pointer/mouse cycles, not click events.
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      if (typeof (el as HTMLElement).click === 'function') {
        try { (el as HTMLElement).click(); } catch {}
      }
    } else {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    }
    return;
  }
  el.focus();
  const init: KeyboardEventInit = {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true, composed: true,
  };
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keypress', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

export class ActionEngine {
  static async run(actions: ChatAction[]) {
    for (const a of actions) await this.exec(a);
  }

  static async exec(action: ChatAction) {
    switch (action.type) {
      case 'clickButtonByText':
        return this.clickButtonByText(action.params.text);
      case 'findAndSetDataId':
        return this.findAndSetDataId(action.params.selector, action.params.dataId);
      case 'findParentAndSetDataId':
        return this.findParentAndSetDataId(action.params.selector, action.params.dataId);
      case 'findLastAndSetDataId':
        return this.findLastAndSetDataId(action.params.selector, action.params.rootSelector, action.params.dataId);
      case 'waitForElement':
        return this.waitForElement(action.params.selector, action.params.timeout);
      case 'wait':
        return wait(action.params.duration);
      case 'triggerClick':
        return this.triggerClick(action.params.selector);
      default:
        console.warn('[ActionEngine] unknown action', action);
    }
  }

  static async clickButtonByText(text: string) {
    const buttons = document.querySelectorAll('button');
    const target = Array.from(buttons).find(b => b.textContent?.includes(text));
    target?.click();
  }

  static async findAndSetDataId(selector: string | string[], dataId: string) {
    const list = typeof selector === 'string' ? [selector] : selector;
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el) { el.setAttribute('data-id', dataId); return; }
    }
  }

  static async findParentAndSetDataId(selector: string | string[], dataId: string) {
    const list = typeof selector === 'string' ? [selector] : selector;
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el?.parentElement) { el.parentElement.setAttribute('data-id', dataId); return; }
    }
  }

  static async findLastAndSetDataId(selector: string, rootSelector: string, dataId: string) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const all = root.querySelectorAll(selector);
    if (all.length) all[all.length - 1].setAttribute('data-id', dataId);
  }

  static async waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
    const start = Date.now();
    return new Promise(resolve => {
      const tick = () => {
        const el = document.querySelector(selector);
        if (el) { resolve(el); return; }
        if (Date.now() - start > timeout) { resolve(null); return; }
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  static async triggerClick(selector: string) {
    const el = document.querySelector(selector) as HTMLElement | null;
    el?.click();
  }
}
