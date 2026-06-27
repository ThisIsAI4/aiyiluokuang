import type { ChatAppConfig } from '../types';
import { resolveAll } from '../utils/dom';

// Generic assistant-message selectors observed across major AI chat UIs. The
// lowest (most recent) visible match with real text wins. This is the fallback
// used when the platform has no explicit `answerSelector` and the user did not
// select anything.
const GENERIC_ANSWER_SELECTORS = [
  '[data-message-author-role="assistant"]', // ChatGPT
  '[data-testid^="bot-message"]',           // common bot-turn test ids
  '.font-claude-message',                   // Claude
  'message-content',                        // Gemini web component
  '.model-response-text',                   // Gemini legacy
  '.markdown',                              // rendered answer (many sites)
  '.prose',                                 // Tailwind Typography
  '.assistant-message',
];

// Visibility via computed style only (not getBoundingClientRect size): jsdom has
// no layout so size is always 0×0, and real chat UIs hide stale answer templates
// with display:none / visibility:hidden / opacity:0 — all of which computed style
// reports correctly in both jsdom and browsers.
function answerText(el: Element): string | null {
  if (!(el instanceof HTMLElement)) return null;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return null;
  if (parseFloat(cs.opacity || '1') === 0) return null;
  const text = (el.innerText || el.textContent || '').trim();
  return text ? text : null;
}

/** Most recent answer = last visible, non-empty element in DOCUMENT order. Using
 *  compareDocumentPosition (not visual position) because chat containers may use
 *  flex column-reverse, where visual order inverts DOM order. */
function lastAnswer(els: Element[]): HTMLElement | null {
  let best: HTMLElement | null = null;
  for (const el of els) {
    if (!answerText(el)) continue;
    if (!best || (best.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      best = el as HTMLElement;
    }
  }
  return best;
}

/**
 * Chain-mode harvest. Selection always wins (power-user override). Otherwise the
 * platform's explicit `answerSelector` is tried, then a generic heuristic. Returns
 * '' only when every path fails — the orchestrator treats '' as "do not advance".
 */
export function harvestAnswer(config: ChatAppConfig | null): string {
  const selection = window.getSelection()?.toString().trim();
  if (selection) return selection;

  if (config?.answerSelector) {
    const last = lastAnswer(resolveAll(config.answerSelector));
    if (last) return answerText(last)!;
  }

  const candidates: Element[] = [];
  for (const sel of GENERIC_ANSWER_SELECTORS) {
    document.querySelectorAll(sel).forEach(el => candidates.push(el));
  }
  const last = lastAnswer(candidates);
  return last ? answerText(last)! : '';
}
