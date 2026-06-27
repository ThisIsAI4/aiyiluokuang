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

/** Multi-match version of `resolveSelector`. Used by chain harvest to pick the
 * latest of several answer nodes. Returns visible-order DOM matches. */
export function resolveAll(ref: SelectorRef): Element[] {
  if (!ref) return [];
  if (typeof ref === 'string') return ref ? Array.from(document.querySelectorAll(ref)) : [];
  if (Array.isArray(ref)) {
    for (const sel of ref) {
      const hits = Array.from(document.querySelectorAll(sel));
      if (hits.length) return hits;
    }
    return [];
  }
  if (ref.inShadowDom) {
    const root = ref.shadowRootSelector ? document.querySelector(ref.shadowRootSelector) : undefined;
    const one = findInShadow(ref.selector, root || undefined);
    return one ? [one] : [];
  }
  return Array.from(document.querySelectorAll(ref.selector));
}

const FALLBACK_INPUT_SELECTORS = ['div[contenteditable="true"]', 'div[contenteditable=""]', 'div[contenteditable]', 'textarea'];

function getAllElementsIncludingShadow(root: Element | ShadowRoot = document.body): Element[] {
  const result: Element[] = [];
  const stack: (Element | ShadowRoot)[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node instanceof Element) {
      result.push(node);
      if (node.shadowRoot) {
        stack.push(node.shadowRoot);
      }
    }
    if ('children' in node) {
      stack.push(...Array.from((node as Element | ShadowRoot).children));
    }
  }
  return result;
}

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
    // Also search inside shadow roots for Web Component based UIs.
    getAllElementsIncludingShadow().forEach(el => {
      if (el.matches(sel) && el instanceof HTMLElement && !collected.includes(el)) collected.push(el);
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
    case 'text': setValue(); break;
    case 'input': setValue(); break;
    case 'paste': paste(); break;
    case 'pasteAndText':
      paste();
      focusAndSelect(el);
      await wait(100);
      setValue();
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
      case 'ensureToggleOn':
        return this.ensureToggleOn(action.params);
      case 'selectByText':
        return this.selectByText(action.params);
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

  /**
   * Idempotent toggle. Locates a control by CSS selector or visible text, decides
   * whether it is already "on", and clicks only when it is off. Because readyActions
   * re-runs on every page load and these sites persist toggle state, a blind click
   * would flip an already-enabled toggle back off — hence the active-state check.
   * Fails safe: if the control never appears, it times out and does nothing.
   */
  static async ensureToggleOn(params: Extract<ChatAction, { type: 'ensureToggleOn' }>['params']) {
    const { selector, buttonText, activeSelector, activeClass, activeAttr, activeAttrValue, timeout = 8000, includeNonSemantic = false } = params;

    const locate = (): HTMLElement | null => {
      if (selector) return resolveSelector(selector) as HTMLElement | null;
      if (buttonText) return findClickableByText(buttonText, undefined, { includeNonSemantic });
      return null;
    };

    const toggle = await waitForCondition(locate, timeout);
    if (!toggle) return;

    const marker = { activeSelector, activeClass, activeAttr, activeAttrValue };
    if (isToggleActive(toggle, marker)) return;

    // Click the toggle (or its closest clickable ancestor).
    const clickable = (toggle.closest('button,[role=button],[role=switch],[role=checkbox],a') as HTMLElement) || toggle;
    clickable.click();

    // Only retry with a full pointer cycle when the caller gave an explicit active
    // marker — then a failed re-check reliably means "still off, click didn't take".
    // Without a marker we can't trust the re-check, and a blind second click could
    // toggle an already-on control back off, so we stop after the single click.
    const hasExplicitMarker = !!(activeSelector || activeClass || activeAttr);
    if (!hasExplicitMarker) return;
    await wait(250);
    if (!isToggleActive(toggle, marker)) {
      await triggerSend(clickable, 'click');
    }
  }

  /**
   * Idempotent menu selection by visible text — e.g. pick a model from a switcher.
   * Skips the whole interaction when the current selection already shows the target
   * label, so re-running on every load is a no-op once the model is set. Fails safe.
   */
  static async selectByText(params: Extract<ChatAction, { type: 'selectByText' }>['params']) {
    const { trigger, triggerText, optionText, optionScope, currentLabel, currentText, timeout = 8000, menuDelay = 400, includeNonSemantic = false } = params;
    const wants = Array.isArray(optionText) ? optionText : [optionText];
    const findOpts = { includeNonSemantic };
    const tag = '[selectByText]';

    // Already on the desired option? Bail before touching the menu.
    if (currentLabel) {
      const labelEl = resolveSelector(currentLabel) as HTMLElement | null;
      if (labelEl && textMatchesAny(labelEl.textContent, currentText ?? wants)) return;
    }

    const openMenu = (): HTMLElement | null => {
      if (trigger) return resolveSelector(trigger) as HTMLElement | null;
      if (triggerText) return findClickableByText(triggerText, undefined, findOpts);
      return null;
    };
    const triggerEl = await waitForCondition(openMenu, timeout);
    if (!triggerEl) {
      console.warn(tag, 'trigger not found within', timeout, 'ms — triggerText:', triggerText, 'includeNonSemantic:', includeNonSemantic);
      return;
    }
    // Many switchers display the current selection in the trigger itself (DouBao's
    // 快速/思考/专家 pill, Qwen's model name). If it already shows the target, we're
    // done — don't open the menu on every refresh.
    if (textMatchesAny(triggerEl.textContent, wants)) return;
    console.log(tag, 'clicking trigger:', triggerEl.textContent?.trim().substring(0, 40));
    (triggerEl.closest('button,[role=button],a') as HTMLElement || triggerEl).click();
    await wait(menuDelay);

    const scope = optionScope ? (document.querySelector(optionScope) as HTMLElement | null) : null;
    const option = await waitForCondition(() => findClickableByText(wants, scope ?? undefined, findOpts), timeout);
    if (!option) {
      console.warn(tag, 'option not found within', timeout, 'ms — optionText:', optionText);
      return;
    }
    console.log(tag, 'clicking option:', option.textContent?.trim().substring(0, 40));
    (option.closest('[role=option],[role=menuitem],[role=menuitemradio],button,a,li') as HTMLElement || option).click();
  }
}

/** Poll `fn` until it returns a truthy value or the timeout elapses. */
async function waitForCondition<T>(fn: () => T | null, timeout: number): Promise<T | null> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeout) return null;
    await wait(200);
  }
}

const normalizeText = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function textMatchesAny(text: string | null | undefined, targets: string | string[]): boolean {
  const list = (Array.isArray(targets) ? targets : [targets]).map(normalizeText).filter(Boolean);
  const t = normalizeText(text);
  if (!t) return false;
  const tokens = t.split(' ');
  // Avoid raw substring matching ("Research" must NOT match target "Search"). A label
  // matches a target when it equals it, starts with it (e.g. "深度思考 (R1)" ⊇ "深度思考",
  // "Search the web" ⊇ "Search"), or contains it as a whole space-token ("Web Search").
  return list.some(target => t === target || t.startsWith(target) || tokens.includes(target));
}

const CLICKABLE_SELECTOR =
  'button,[role=button],[role=switch],[role=checkbox],[role=option],[role=menuitem],[role=menuitemradio],[role=radio],[role=tab],a,li';

/**
 * Find a clickable element whose visible text matches one of `texts`. These sites
 * ship hashed/obfuscated class names, so the human-readable label is the only stable
 * anchor. Prefers a semantically-clickable element (button/role/li) with an exact
 * label; falls back to the *shortest* containing one. With `includeNonSemantic`, also
 * matches plain div/span elements (some switchers — e.g. DouBao's 快速/思考/专家 pill —
 * are div-based, not buttons); a synthetic click on the matched leaf still bubbles to
 * the framework's handler. Searches through shadow roots (z.ai uses web components).
 */
function findClickableByText(
  texts: string | string[],
  scope?: Element,
  opts: { includeNonSemantic?: boolean } = {},
): HTMLElement | null {
  const { includeNonSemantic = false } = opts;
  const list = (Array.isArray(texts) ? texts : [texts]).map(normalizeText).filter(Boolean);
  if (!list.length) return null;
  const root = scope ?? document.body;
  const all = getAllElementsIncludingShadow(root).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && isVisible(el),
  );
  const clickables = all.filter(el => el.matches(CLICKABLE_SELECTOR));

  // Prefer the shortest label among matches; for non-semantic ties (identical text in
  // nested wrappers) prefer the leaf-most element (fewest descendants).
  const byShortestText = (els: HTMLElement[]) =>
    [...els].sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
  const byLeafmost = (els: HTMLElement[]) =>
    [...els].sort(
      (a, b) =>
        a.querySelectorAll('*').length - b.querySelectorAll('*').length ||
        (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
    )[0];

  // 1. Semantic clickable, exact text.
  const exact = clickables.filter(el => list.some(t => normalizeText(el.textContent) === t));
  if (exact.length) return byShortestText(exact);

  // 2. Non-semantic exact (div/span-based switchers and menus).
  if (includeNonSemantic) {
    const nonSemantic = all.filter(el => list.some(t => normalizeText(el.textContent) === t));
    if (nonSemantic.length) return byLeafmost(nonSemantic);
  }

  // 3. Semantic clickable, partial text (e.g. "深度思考 (R1)" ⊇ "深度思考").
  const partial = clickables.filter(el => textMatchesAny(el.textContent, list));
  if (partial.length) return byShortestText(partial);

  // 4. Non-semantic partial, leaf-most only (e.g. a div reading "专家模式" for "专家").
  // Restricted to near-leaf elements so we don't match a whole menu wrapper.
  if (includeNonSemantic) {
    const partialLeaf = all.filter(
      el => el.querySelectorAll('*').length <= 2 && textMatchesAny(el.textContent, list),
    );
    if (partialLeaf.length) return byLeafmost(partialLeaf);
  }

  return null;
}

/** Heuristic active-state detection for an idempotent toggle. */
function isToggleActive(
  toggle: HTMLElement,
  opts: { activeSelector?: string; activeClass?: string; activeAttr?: string; activeAttrValue?: string },
): boolean {
  const { activeSelector, activeClass, activeAttr, activeAttrValue } = opts;
  if (activeSelector) return !!document.querySelector(activeSelector);

  // Probe the toggle and its nearest clickable ancestor (the active marker often
  // lives on the button wrapper, not the inner label/icon).
  const probes = [toggle, toggle.closest('button,[role=button],[role=switch],[role=checkbox],a') as HTMLElement | null].filter(
    Boolean,
  ) as HTMLElement[];

  return probes.some(el => {
    if (activeClass && el.classList.contains(activeClass)) return true;
    if (activeAttr) return el.getAttribute(activeAttr) === (activeAttrValue ?? 'true');
    if (activeClass || activeAttr) return false;
    // Default heuristics when the caller gives no explicit marker.
    if (el.getAttribute('aria-pressed') === 'true') return true;
    if (el.getAttribute('aria-checked') === 'true') return true;
    const state = el.getAttribute('data-state');
    if (state === 'on' || state === 'active' || state === 'checked' || state === 'open') return true;
    return /(?:^|\s)(?:active|selected|enabled|checked|is-on|on)(?:\s|$)/.test(el.className);
  });
}
