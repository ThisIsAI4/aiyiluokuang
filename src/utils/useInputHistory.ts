import { useCallback, useRef } from 'react';
import { getStorage, setStorage } from './storage';

const STORAGE_KEY = 'inputHistory';
const MAX_HISTORY = 100;

/**
 * Manages input history with ArrowUp/ArrowDown navigation + Ctrl+R fuzzy search.
 * History is persisted to chrome.storage.local and deduplicated.
 *
 * Arrow key navigation model:
 *   index = -1  → "live editing" (not navigating)
 *   index >= 0  → browsing history entry at that offset (0 = newest)
 */
export function useInputHistory() {
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const draftRef = useRef(''); // saved current input when navigation starts

  const load = useCallback(async () => {
    const stored = await getStorage<string[]>(STORAGE_KEY);
    if (stored) historyRef.current = stored;
  }, []);

  const push = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const h = historyRef.current;
    // Skip duplicate of the most recent entry
    if (h[0] === trimmed) {
      indexRef.current = -1;
      draftRef.current = '';
      return;
    }
    historyRef.current = [trimmed, ...h.filter(t => t !== trimmed)].slice(0, MAX_HISTORY);
    indexRef.current = -1;
    draftRef.current = '';
    await setStorage(STORAGE_KEY, historyRef.current);
  }, []);

  /** Returns text to display, or null if navigation should be a no-op. */
  const navigate = useCallback((direction: 'up' | 'down', currentText: string): string | null => {
    const h = historyRef.current;
    if (h.length === 0) return null;

    if (direction === 'up') {
      if (indexRef.current === -1) {
        // Entering history: save draft, jump to newest
        draftRef.current = currentText;
        indexRef.current = 0;
      } else if (indexRef.current < h.length - 1) {
        indexRef.current += 1;
      } else {
        return null; // already at oldest
      }
      return h[indexRef.current];
    }

    // direction === 'down'
    if (indexRef.current === -1) return null; // not navigating
    if (indexRef.current === 0) {
      // Back to live editing
      indexRef.current = -1;
      return draftRef.current;
    }
    indexRef.current -= 1;
    return h[indexRef.current];
  }, []);

  /** Reset navigation state (e.g. after submit). */
  const reset = useCallback(() => {
    indexRef.current = -1;
    draftRef.current = '';
  }, []);

  /** Fuzzy search history by query string. Returns matches ranked by relevance. */
  const search = useCallback((query: string): string[] => {
    const q = query.trim().toLowerCase();
    const h = historyRef.current;
    if (!q) return h.slice(); // empty query → return all
    return h
      .filter(item => item.toLowerCase().includes(q))
      .sort((a, b) => {
        const la = a.toLowerCase();
        const lb = b.toLowerCase();
        // Exact prefix match wins
        const aStarts = la.startsWith(q) ? 0 : 1;
        const bStarts = lb.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        // Then by position of first match
        return la.indexOf(q) - lb.indexOf(q);
      });
  }, []);

  return { load, push, navigate, reset, search };
}
