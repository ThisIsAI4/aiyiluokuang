import { Readability } from '@mozilla/readability';
import type { ContextPayload } from '../services/contextPayload';

export type ExtractorRequest = 'selection' | 'auto';
export type ExtractorResult = ContextPayload | { error: string };

const MAX_CHARS = 8000;
const ARTICLE_MIN_CHARS = 200;
const FALLBACK_INNERTEXT_MAX = 4000;

function truncate(s: string): { text: string; truncated: boolean } {
  if (s.length <= MAX_CHARS) return { text: s, truncated: false };
  return { text: s.slice(0, MAX_CHARS), truncated: true };
}

function basePayload(text: string, kind: ContextPayload['kind']): ContextPayload {
  const { text: t, truncated } = truncate(text);
  return {
    kind,
    text: t,
    sourceUrl: window.location.href,
    sourceTitle: document.title || window.location.hostname,
    charCount: text.length,
    truncated,
    createdAt: Date.now(),
  };
}

async function extractFromSelection(): Promise<ContextPayload | null> {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : '';
  if (!text) return null;
  return basePayload(text, 'selection');
}

async function extractArticle(): Promise<ContextPayload> {
  try {
    const parsed = new Readability(document.cloneNode(true) as Document).parse();
    if (parsed && parsed.textContent && parsed.textContent.length >= ARTICLE_MIN_CHARS) {
      return basePayload(parsed.textContent.trim(), 'article');
    }
  } catch {
    // fall through to innerText fallback
  }
  const bodyText = (document.body.innerText || document.body.textContent || '').trim();
  const fallback = bodyText.slice(0, FALLBACK_INNERTEXT_MAX);
  return basePayload(fallback, 'article');
}

export async function run(req: ExtractorRequest): Promise<ExtractorResult> {
  try {
    if (req === 'selection') {
      const s = await extractFromSelection();
      if (!s) return { error: '请先选中文字再右键' };
      return s;
    }
    // req === 'auto'
    if (document.contentType === 'application/pdf') {
      const pdf = await extractPdf();
      return pdf;
    }
    const sel = await extractFromSelection();
    if (sel) return sel;
    return await extractArticle();
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'extraction failed' };
  }
}

// PDF path filled in Task 6.
async function extractPdf(): Promise<ExtractorResult> {
  return { error: 'PDF path not yet implemented' };
}
