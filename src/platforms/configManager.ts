import { STORAGE_KEYS } from '../utils/constants';
import { getStorage, setStorage, removeStorage } from '../utils/storage';
import { BUILTIN_BUNDLE } from './configs';
import type { AppConfigBundle, ChatAppConfig } from '../types';

class ConfigManagerImpl {
  async getBaseConfig(): Promise<AppConfigBundle> {
    const builtin = BUILTIN_BUNDLE;
    try {
      const cached = await getStorage<AppConfigBundle>(STORAGE_KEYS.cachedConfig);
      if (cached) {
        const cachedV = Number(cached.version);
        const builtinV = Number(builtin.version);
        if (Number.isNaN(cachedV) || builtinV > cachedV) {
          await setStorage(STORAGE_KEYS.cachedConfig, builtin);
          return builtin;
        }
        return cached;
      }
    } catch (err) {
      console.warn('[ConfigManager] failed to read cached config:', err);
    }
    return builtin;
  }

  async getCustomConfig(): Promise<ChatAppConfig[]> {
    try {
      return (await getStorage<ChatAppConfig[]>(STORAGE_KEYS.customConfig)) || [];
    } catch {
      return [];
    }
  }

  async saveCustomConfig(custom: ChatAppConfig[]): Promise<void> {
    await setStorage(STORAGE_KEYS.customConfig, custom);
  }

  async clearCustomConfig(): Promise<void> {
    await removeStorage(STORAGE_KEYS.customConfig);
  }

  async getCurrentConfig(): Promise<AppConfigBundle> {
    const base = await this.getBaseConfig();
    const custom = await this.getCustomConfig();
    if (!custom.length) return base;

    const customIds = custom.map(c => c.id);
    const remaining = base.chatApps.filter(c => !customIds.includes(c.id));
    return {
      ...base,
      chatApps: [...custom, ...remaining],
      chatGroups: [{ id: 'custom', chatAppIds: customIds }, ...base.chatGroups],
    };
  }

  async resetToBuiltin(): Promise<void> {
    await removeStorage(STORAGE_KEYS.cachedConfig);
  }

  async getConfigInfo() {
    const current = await this.getCurrentConfig();
    const cached = await getStorage<AppConfigBundle>(STORAGE_KEYS.cachedConfig);
    const custom = await this.getCustomConfig();
    return {
      currentVersion: current.version,
      isUsingCache: !!cached,
      builtinVersion: BUILTIN_BUNDLE.version,
      customAppCount: custom.length,
    };
  }
}

export const ConfigManager = new ConfigManagerImpl();
