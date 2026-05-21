// MAIN world content script, runs at document_start.
// Suppresses page focus stealing, removes autofocus, forwards keyboard shortcuts to parent.

const PROTOCOL_SOURCE = 'chathub-replica';

declare global {
  interface Window {
    __SCH_WINDOW__?: Window;
  }
}

function isInExtensionFrame(): boolean {
  const origins = (window.location as any).ancestorOrigins as DOMStringList | undefined;
  if (!origins || origins.length === 0) return false;
  const first = origins[0];
  return (
    first.startsWith('chrome-extension://') ||
    first.startsWith('extension://') ||
    first.startsWith('moz-extension://')
  );
}

if (isInExtensionFrame()) {
  window.__SCH_WINDOW__ = window.parent;

  // Swallow SecurityError noise from cross-origin frames.
  window.addEventListener('error', e => {
    if (e.error instanceof DOMException && e.error.name === 'SecurityError') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('unhandledrejection', e => {
    if (e.reason instanceof DOMException && e.reason.name === 'SecurityError') {
      e.preventDefault();
    }
  });

  // Disable page-driven focus to prevent input theft.
  HTMLElement.prototype.focus = function () {};

  // Strip existing autofocus attributes immediately and on any future DOM changes.
  document.querySelectorAll('[autofocus]').forEach(el => el.removeAttribute('autofocus'));
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'childList') {
        r.addedNodes.forEach(n => {
          if (n instanceof HTMLElement) {
            if (n.hasAttribute('autofocus')) n.removeAttribute('autofocus');
            n.querySelectorAll('[autofocus]').forEach(c => c.removeAttribute('autofocus'));
          }
        });
      } else if (r.type === 'attributes' && r.attributeName === 'autofocus' && r.target instanceof HTMLElement) {
        r.target.removeAttribute('autofocus');
      }
    }
  }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['autofocus'],
  });

  // Minimal RPC helper for sending requests to the parent (extension UI).
  function postId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
  function sendToParent<T = unknown>(action: string, data?: unknown, timeout = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = postId();
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error(`postMessage timeout: ${action}`));
      }, timeout);
      const handler = (ev: MessageEvent) => {
        const m = ev.data;
        if (!m || m.source !== PROTOCOL_SOURCE || m.type !== 'response' || m.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        m.error ? reject(new Error(m.error)) : resolve(m.data);
      };
      window.addEventListener('message', handler);
      (window.__SCH_WINDOW__ || window.parent).postMessage(
        { source: PROTOCOL_SOURCE, type: 'request', action, id, data }, '*',
      );
    });
  }

  // ----- Shortcut config + matcher (inlined to avoid module imports in MAIN world) -----
  interface Binding {
    cmdOrCtrl?: boolean; alt?: boolean; shift?: boolean;
    code?: string; codePattern?: RegExp; disabled?: boolean;
  }
  const DEFAULT_BINDINGS: Record<string, Binding> = {
    focusInput: { alt: true, code: 'KeyK' },
    newChat: { alt: true, code: 'KeyN' },
    optimizePrompt: { alt: true, code: 'KeyO' },
    closeChat: { alt: true, code: 'KeyW' },
    reloadChat: { alt: true, code: 'KeyR' },
    enterFullscreen: { alt: true, code: 'KeyF' },
    insertPrompt: { alt: true, codePattern: /^Digit(\d)$/ },
    switchLayout: { cmdOrCtrl: true, shift: true, codePattern: /^Digit(\d)$/ },
    switchPlatformTab: { cmdOrCtrl: true, codePattern: /^Digit(\d)$/ },
  };
  let bindings = { ...DEFAULT_BINDINGS };

  function applyConfig(cfg: { sendKeyMode?: string; shortcuts?: Record<string, Partial<Binding>> }) {
    bindings = { ...DEFAULT_BINDINGS };
    const map = cfg.shortcuts || {};
    for (const name of Object.keys(DEFAULT_BINDINGS)) {
      const user = map[name];
      if (!user) continue;
      const def = DEFAULT_BINDINGS[name];
      if (user.disabled) { bindings[name] = { ...def, disabled: true }; continue; }
      bindings[name] = def.codePattern
        ? { ...def, cmdOrCtrl: user.cmdOrCtrl ?? def.cmdOrCtrl, alt: user.alt ?? def.alt, shift: user.shift ?? def.shift }
        : { cmdOrCtrl: user.cmdOrCtrl ?? def.cmdOrCtrl, alt: user.alt ?? def.alt, shift: user.shift ?? def.shift, code: user.code ?? def.code };
    }
  }
  function matchShortcut(ev: KeyboardEvent): { action: string; matchObj?: RegExpMatchArray } | null {
    const cmdOrCtrl = ev.metaKey || ev.ctrlKey;
    const alt = ev.altKey;
    const shift = ev.shiftKey;
    for (const name of Object.keys(bindings)) {
      const b = bindings[name];
      if (b.disabled) continue;
      if (!!b.cmdOrCtrl !== cmdOrCtrl) continue;
      if (!!b.alt !== alt) continue;
      if (!!b.shift !== shift) continue;
      if (b.code) { if (ev.code === b.code) return { action: name }; continue; }
      if (b.codePattern) { const m = ev.code.match(b.codePattern); if (m) return { action: name, matchObj: m }; }
    }
    return null;
  }

  (async () => {
    try {
      const cfg = await sendToParent('getShortcutConfig');
      if (cfg) applyConfig(cfg as any);
    } catch {}

    window.addEventListener('keydown', ev => {
      const hit = matchShortcut(ev);
      if (!hit) return;
      ev.preventDefault();
      ev.stopPropagation();
      sendToParent('shortcutTriggered', {
        action: hit.action,
        matchObj: hit.matchObj ? Array.from(hit.matchObj) : undefined,
      }).catch(() => {});
    }, true);

    window.addEventListener('pointerdown', () => {
      sendToParent('intentObserved', { source: 'iframe-pointer' }).catch(() => {});
    }, true);

    let lastWheel = 0;
    window.addEventListener('wheel', () => {
      const t = Date.now();
      if (t - lastWheel < 200) return;
      lastWheel = t;
      sendToParent('intentObserved', { source: 'iframe-wheel' }).catch(() => {});
    }, { capture: true, passive: true });

    // Per-platform tweaks: dismiss Grok's OneTrust consent banner so it doesn't block the input.
    try {
      const cfg = await sendToParent<{ id?: string }>('getConfig');
      if (cfg?.id === 'Grok') {
        const style = document.createElement('style');
        style.textContent = '#onetrust-consent-sdk { display:none !important; }';
        (document.head || document.documentElement).appendChild(style);
        const waitForBtn = (sel: string) => new Promise<Element>(r => {
          const tick = () => {
            const el = document.querySelector(sel);
            if (el) r(el); else setTimeout(tick, 200);
          };
          tick();
        });
        const btn = (await waitForBtn('#onetrust-accept-btn-handler')) as HTMLElement;
        btn.click();
      }
    } catch {}
  })();
}

export {};
