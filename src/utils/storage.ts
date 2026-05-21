import { STORAGE_KEYS } from './constants';

export async function getStorage<T = unknown>(key: string): Promise<T | undefined> {
  return new Promise(resolve => {
    chrome.storage.local.get(key, items => resolve(items[key] as T));
  });
}

export async function setStorage(key: string, value: unknown): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

export async function removeStorage(key: string): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.remove(key, () => resolve());
  });
}

export async function ensureClientId(): Promise<string> {
  let id = await getStorage<string>(STORAGE_KEYS.clientId);
  if (!id) {
    id = self.crypto.randomUUID();
    await setStorage(STORAGE_KEYS.clientId, id);
  }
  return id;
}
