import type { ShortcutAction, ShortcutBinding, ShortcutConfig, SendKeyMode } from '../types';
import { STORAGE_KEYS } from './constants';
import { getStorage } from './storage';

export const DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutAction, ShortcutBinding> = {
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

export const ALL_SHORTCUT_ACTIONS = Object.keys(DEFAULT_SHORTCUT_BINDINGS) as ShortcutAction[];
export const PATTERN_ACTIONS: ShortcutAction[] = ['insertPrompt', 'switchLayout', 'switchPlatformTab'];
export const FIXED_KEY_ACTIONS: ShortcutAction[] = [
  'focusInput', 'newChat', 'optimizePrompt', 'closeChat', 'reloadChat', 'enterFullscreen',
];
export const INTENT_SCOPED_ACTIONS: ShortcutAction[] = ['closeChat', 'reloadChat', 'enterFullscreen'];

let activeBindings: Record<ShortcutAction, ShortcutBinding> = { ...DEFAULT_SHORTCUT_BINDINGS };
let sendKeyMode: SendKeyMode = 'enter';

function checkBinding(
  binding: ShortcutBinding,
  ev: KeyboardEvent,
  cmdOrCtrl: boolean,
  alt: boolean,
  shift: boolean,
): true | RegExpMatchArray | null {
  if (binding.disabled) return null;
  if (!!binding.cmdOrCtrl !== cmdOrCtrl) return null;
  if (!!binding.alt !== alt) return null;
  if (!!binding.shift !== shift) return null;
  if (binding.code) return ev.code === binding.code ? true : null;
  if (binding.codePattern) return ev.code.match(binding.codePattern);
  return null;
}

let cachedMatchers: { action: ShortcutAction; check: (ev: KeyboardEvent, c: boolean, a: boolean, s: boolean) => true | RegExpMatchArray | null }[] = [];

function rebuildMatchers() {
  cachedMatchers = (Object.keys(activeBindings) as ShortcutAction[]).map(action => ({
    action,
    check: (ev, c, a, s) => checkBinding(activeBindings[action], ev, c, a, s),
  }));
}

rebuildMatchers();

export function applyShortcutConfig(cfg: ShortcutConfig) {
  activeBindings = { ...DEFAULT_SHORTCUT_BINDINGS };
  const map = cfg.shortcuts || {};
  for (const action of ALL_SHORTCUT_ACTIONS) {
    const user = map[action];
    if (!user) continue;
    const def = DEFAULT_SHORTCUT_BINDINGS[action];
    if (user.disabled) {
      activeBindings[action] = { ...def, disabled: true };
      continue;
    }
    if (def.codePattern) {
      activeBindings[action] = {
        ...def,
        cmdOrCtrl: user.cmdOrCtrl ?? def.cmdOrCtrl,
        alt: user.alt ?? def.alt,
        shift: user.shift ?? def.shift,
      };
    } else {
      activeBindings[action] = {
        cmdOrCtrl: user.cmdOrCtrl ?? def.cmdOrCtrl,
        alt: user.alt ?? def.alt,
        shift: user.shift ?? def.shift,
        code: user.code ?? def.code,
      };
    }
  }
  sendKeyMode = cfg.sendKeyMode || 'enter';
  rebuildMatchers();
}

export async function loadShortcutConfig(): Promise<ShortcutConfig> {
  const stored = await getStorage<ShortcutConfig>(STORAGE_KEYS.shortcutConfig);
  const cfg: ShortcutConfig = stored || { sendKeyMode: 'enter', shortcuts: {} };
  applyShortcutConfig(cfg);
  return cfg;
}

export const getSendKeyMode = () => sendKeyMode;
export const getActiveShortcutBindings = () => activeBindings;

export function matchShortcut(ev: KeyboardEvent): { action: ShortcutAction; matchObj?: RegExpMatchArray } | null {
  const cmdOrCtrl = ev.metaKey || ev.ctrlKey;
  const alt = ev.altKey;
  const shift = ev.shiftKey;
  for (const m of cachedMatchers) {
    const result = m.check(ev, cmdOrCtrl, alt, shift);
    if (result) {
      return { action: m.action, matchObj: typeof result === 'object' ? result : undefined };
    }
  }
  return null;
}

export function formatShortcut(action: ShortcutAction, digit?: number): string {
  const b = activeBindings[action];
  if (!b || b.disabled) return '';
  const isMac = navigator.userAgent.toLowerCase().includes('mac');
  const out: string[] = [];
  if (b.cmdOrCtrl) out.push(isMac ? '⌘' : 'Ctrl');
  if (b.alt) out.push(isMac ? '⌥' : 'Alt');
  if (b.shift) out.push(isMac ? '⇧' : 'Shift');
  if (b.code) out.push(b.code.replace('Key', '').replace('Digit', ''));
  else if (b.codePattern && digit !== undefined) out.push(String(digit));
  return out.join(isMac ? '' : '+');
}
