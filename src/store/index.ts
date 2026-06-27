import { create } from 'zustand';
import { STORAGE_KEYS, ThemeMode, Language } from '../utils/constants';
import { getStorage, setStorage } from '../utils/storage';
import type {
  AppOptions, LayoutPreset, PromptItem, ShortcutConfig, ChatAppConfig, AppConfigBundle,
} from '../types';
import { ConfigManager } from '../platforms/configManager';

const DEFAULT_OPTIONS: AppOptions = {
  layoutPresets: [
    { id: 'default', name: 'Default', appIdGroups: [['ChatGPT'], ['Gemini'], ['Grok']] },
  ],
  activeLayoutPresetId: 'default',
  colMaxCount: 0,
  themeMode: ThemeMode.System,
  language: Language.System,
  primaryColor: '#00d992',
  chainAutoAdvance: false,
};

interface AppStore {
  ready: boolean;
  options: AppOptions;
  bundle: AppConfigBundle | null;
  promptLibrary: PromptItem[];
  shortcutConfig: ShortcutConfig;
  customConfigs: ChatAppConfig[];
  init: () => Promise<void>;
  updateOptions: (patch: Partial<AppOptions>) => Promise<void>;
  setActiveLayout: (id: string) => Promise<void>;
  addLayout: (preset: LayoutPreset) => Promise<void>;
  updateLayout: (id: string, patch: Partial<LayoutPreset>) => Promise<void>;
  removeLayout: (id: string) => Promise<void>;
  setPromptLibrary: (items: PromptItem[]) => Promise<void>;
  setShortcutConfig: (cfg: ShortcutConfig) => Promise<void>;
  setCustomConfigs: (cfg: ChatAppConfig[]) => Promise<void>;
  reloadBundle: () => Promise<void>;
  // Chain mode (F2)
  chainMode: boolean;
  setChainMode: (on: boolean) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  chainMode: false,
  options: DEFAULT_OPTIONS,
  bundle: null,
  promptLibrary: [],
  shortcutConfig: { sendKeyMode: 'enter', shortcuts: {} },
  customConfigs: [],
  setChainMode(on) { set({ chainMode: on }); },

  async init() {
    const [storedOptions, prompts, shortcut, custom, bundle] = await Promise.all([
      getStorage<AppOptions>(STORAGE_KEYS.options),
      getStorage<PromptItem[]>(STORAGE_KEYS.promptLibrary),
      getStorage<ShortcutConfig>(STORAGE_KEYS.shortcutConfig),
      getStorage<ChatAppConfig[]>(STORAGE_KEYS.customConfig),
      ConfigManager.getCurrentConfig(),
    ]);
    set({
      ready: true,
      options: { ...DEFAULT_OPTIONS, ...(storedOptions || {}) },
      promptLibrary: prompts || [],
      shortcutConfig: shortcut || { sendKeyMode: 'enter', shortcuts: {} },
      customConfigs: custom || [],
      bundle,
    });
  },

  async updateOptions(patch) {
    const current = get().options;
    const next: AppOptions = {
      ...current,
      ...patch,
      layoutPresets: patch.layoutPresets ?? current.layoutPresets,
    };
    set({ options: next });
    await setStorage(STORAGE_KEYS.options, next);
  },

  async setActiveLayout(id) {
    await get().updateOptions({ activeLayoutPresetId: id });
  },

  async addLayout(preset) {
    const presets = [...get().options.layoutPresets, preset];
    await get().updateOptions({ layoutPresets: presets, activeLayoutPresetId: preset.id });
  },

  async updateLayout(id, patch) {
    const presets = get().options.layoutPresets.map(p => p.id === id ? { ...p, ...patch } : p);
    await get().updateOptions({ layoutPresets: presets });
  },

  async removeLayout(id) {
    const presets = get().options.layoutPresets.filter(p => p.id !== id);
    const nextActive = presets[0]?.id || '';
    await get().updateOptions({ layoutPresets: presets, activeLayoutPresetId: nextActive });
  },

  async setPromptLibrary(items) {
    set({ promptLibrary: items });
    await setStorage(STORAGE_KEYS.promptLibrary, items);
  },

  async setShortcutConfig(cfg) {
    set({ shortcutConfig: cfg });
    await setStorage(STORAGE_KEYS.shortcutConfig, cfg);
  },

  async setCustomConfigs(cfg) {
    set({ customConfigs: cfg });
    await ConfigManager.saveCustomConfig(cfg);
    const bundle = await ConfigManager.getCurrentConfig();
    set({ bundle });
  },

  async reloadBundle() {
    const bundle = await ConfigManager.getCurrentConfig();
    set({ bundle });
  },
}));
