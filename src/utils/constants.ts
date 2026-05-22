export const EXTENSION_VERSION = '1.0.0';
export const PROTOCOL_SOURCE = 'chathub-replica';

export const STORAGE_KEYS = {
  clientId: 'clientId',
  options: 'options',
  promptLibrary: 'promptLibrary',
  shortcutConfig: 'shortcutConfig',
  customConfig: 'customConfig',
  cachedConfig: 'cachedConfig',
  lastWelcomeVersion: 'lastWelcomeVersion',
  promptOptimizationUsage: 'promptOptimizationUsage',
  pendingContext: 'chathub:pending-context',
  chainPresets: 'chathub:chain-presets',
} as const;

export const CHATS_LIMIT = 6;
export const PROMPT_OPTIMIZATION_MAX_LENGTH = 500;
export const PROMPT_OPTIMIZATION_DAILY_LIMIT = 20;
export const CHAT_LOAD_TIMEOUT = 10_000;
export const CAPTURE_START_TIMEOUT = 10_000;
export const CAPTURE_STEP_TIMEOUT = 5_000;
export const CAPTURE_END_TIMEOUT = 5_000;
export const CAPTURE_DESKTOP_MAX_WIDTH = 1000;
export const CAPTURE_MOBILE_MAX_WIDTH = 430;

export enum ThemeMode {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

export enum Language {
  System = 'system',
  English = 'en',
  ChineseSimplified = 'zh-CN',
  ChineseTraditional = 'zh-TW',
  Japanese = 'ja',
  Korean = 'ko',
  Spanish = 'es',
  French = 'fr',
  German = 'de',
  Russian = 'ru',
  Arabic = 'ar',
  PortugueseBR = 'pt-BR',
  PortuguesePT = 'pt-PT',
}

export enum ScreenshotFormat {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
}

export enum AppErrorType {
  LoadFailed = 'loadFailed',
  Timeout = 'timeout',
  SendFailed = 'sendFailed',
  Unknown = 'unknown',
}

export const DEFAULT_INTERNATIONAL_LAYOUT: string[][] = [
  ['ChatGPT'],
  ['Gemini'],
  ['Grok'],
];

export const DEFAULT_CHINESE_LAYOUT: string[][] = [
  ['Kimi'],
  ['DouBao'],
  ['Qwen'],
];
