import type { ScreenshotFormat, ThemeMode, Language } from './utils/constants';

export type InputMethod = 'text' | 'input' | 'paste' | 'pasteAndText' | 'execCommand';

export type SelectorRef =
  | string
  | string[]
  | { selector: string; inShadowDom?: boolean; shadowRootSelector?: string };

export type ChatAction =
  | { type: 'clickButtonByText'; params: { text: string } }
  | { type: 'findAndSetDataId'; params: { selector: string | string[]; dataId: string } }
  | { type: 'findParentAndSetDataId'; params: { selector: string | string[]; dataId: string } }
  | { type: 'findLastAndSetDataId'; params: { selector: string; rootSelector: string; dataId: string } }
  | { type: 'waitForElement'; params: { selector: string; timeout?: number } }
  | { type: 'wait'; params: { duration: number } }
  | { type: 'triggerClick'; params: { selector: string } };

export interface ChatAppConfig {
  id: string;
  url: string;
  inputSelector?: SelectorRef;
  sendButtonSelector?: SelectorRef;
  inputMethod?: InputMethod;
  firefoxInputMethod?: InputMethod;
  inputActions?: ChatAction[];
  sendActions?: ChatAction[];
  readyActions?: ChatAction[];
  newChatActions?: ChatAction[];
  scrollContainerSelector?: SelectorRef;
  networkRules?: chrome.declarativeNetRequest.Rule[];
}

export interface ChatGroup {
  id: string;
  chatAppIds: string[];
}

export interface AppConfigBundle {
  version: string;
  chatApps: ChatAppConfig[];
  chatGroups: ChatGroup[];
}

export interface LayoutPreset {
  id: string;
  name?: string;
  appIdGroups: string[][];
}

export interface AppOptions {
  layoutPresets: LayoutPreset[];
  activeLayoutPresetId: string;
  colMaxCount: number;
  themeMode: ThemeMode;
  language: Language;
  primaryColor: string;
}

export interface PromptItem {
  id: string;
  title: string;
  content: string;
}

export interface ShortcutBinding {
  cmdOrCtrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  code?: string;
  codePattern?: RegExp;
  disabled?: boolean;
}

export type ShortcutAction =
  | 'focusInput'
  | 'newChat'
  | 'optimizePrompt'
  | 'closeChat'
  | 'reloadChat'
  | 'enterFullscreen'
  | 'insertPrompt'
  | 'switchLayout'
  | 'switchPlatformTab';

export type SendKeyMode = 'enter' | 'cmdOrCtrlEnter';

export interface ShortcutConfig {
  sendKeyMode: SendKeyMode;
  shortcuts: Partial<Record<ShortcutAction, ShortcutBinding>>;
}

export interface ProtocolMessage<T = unknown> {
  source: string;
  type: 'request' | 'response';
  action: string;
  id: string;
  data?: T;
  error?: string;
}

export interface CaptureContainerInfo {
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
  pageX: number;
  pageY: number;
}
