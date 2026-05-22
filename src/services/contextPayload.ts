import { STORAGE_KEYS } from '../utils/constants';

export type ContextPayload = {
  kind: 'selection' | 'article' | 'pdf';
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  charCount: number;
  truncated: boolean;
  createdAt: number;
};

export const PENDING_TTL_MS = 30 * 60 * 1000;
const KEY = STORAGE_KEYS.pendingContext;

export async function setPending(p: ContextPayload): Promise<void> {
  await chrome.storage.session.set({ [KEY]: p });
}

export async function peekPending(): Promise<ContextPayload | null> {
  const obj = await chrome.storage.session.get(KEY);
  const p = obj[KEY] as ContextPayload | undefined;
  if (!p) return null;
  if (Date.now() - p.createdAt > PENDING_TTL_MS) {
    await chrome.storage.session.remove(KEY);
    return null;
  }
  return p;
}

export async function consumePending(): Promise<ContextPayload | null> {
  const p = await peekPending();
  if (p) await chrome.storage.session.remove(KEY);
  return p;
}
