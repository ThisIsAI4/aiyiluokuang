import { beforeEach } from 'vitest';

// Minimal chrome.* API stub for unit tests that import modules touching `chrome`.
// Tests that need a richer fake reassign individual methods locally.
const sessionStore = new Map<string, unknown>();

(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  storage: {
    session: {
      async get(key: string) {
        return { [key]: sessionStore.get(key) };
      },
      async set(items: Record<string, unknown>) {
        for (const [k, v] of Object.entries(items)) sessionStore.set(k, v);
      },
      async remove(key: string) {
        sessionStore.delete(key);
      },
    },
    local: {
      async get() { return {}; },
      async set() { /* no-op for tests */ },
    },
  },
  runtime: {
    getURL: (p: string) => `chrome-extension://test/${p}`,
    id: 'test',
  },
} as unknown as typeof chrome;

// Reset between tests
beforeEach(() => { sessionStore.clear(); });
