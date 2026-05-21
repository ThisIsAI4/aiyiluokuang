# ChatHub Spotlight Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click "Send to ChatHub" (U1) + page/PDF summarization (U2) + half-automatic chain mode (F2) to ChatHub Replica, prefill-only with no auto-send.

**Architecture:** New service modules (`contextPayload`, `chainOrchestrator`, `chainTemplate`) wrap pure logic for testability. An on-demand content script (`extractor.ts`) handles Readability + lazy pdf.js. UI components (`ContextPreviewChip`, `ChainModeBar`, `ChainEditor`, `AnswerHarvestButton`) bolt onto existing `ChatHub.tsx` and `ChatPanel.tsx`. `main.ts` content script gains one new RPC action (`harvestSelection`).

**Tech Stack:** Vite + CRXJS 2.x, React 18, TypeScript 5.6, antd 5, zustand 5, `@mozilla/readability` 0.5+, `pdfjs-dist` 4.5+. New: Vitest 2 + jsdom 25 for unit tests.

**Branch:** `feature/spotlight-update` (already created off `main` baseline `22e9f48`).

**Spec:** `docs/superpowers/specs/2026-05-21-chathub-spotlight-design.md`

---

## File Structure

```
NEW
src/services/contextPayload.ts             Pure: serialize/store/consume pending payload
src/services/chainOrchestrator.ts          Pure: chain state machine (zustand slice)
src/utils/chainTemplate.ts                 Pure: template-variable assembly
src/contentScripts/extractor.ts            On-demand inject; Readability + lazy pdf.js
src/components/ContextPreviewChip.tsx      Chip above input bar showing source
src/components/ChainModeBar.tsx            Header control: toggle + status + primary button
src/components/ChainEditor.tsx             Drawer: chain order + template + presets
src/components/AnswerHarvestButton.tsx     Per-panel "next ▶" overlay
src/services/__tests__/contextPayload.test.ts
src/services/__tests__/chainOrchestrator.test.ts
src/utils/__tests__/chainTemplate.test.ts
src/contentScripts/__tests__/extractor.test.ts
vitest.config.ts                           jsdom env, paths, coverage settings
docs/manual-qa-spotlight.md                Manual QA checklist (4 platforms × 3 page types + chain)

MODIFIED
src/contentScripts/main.ts                 +1 RPC case: harvestSelection
src/components/ChatPanel.tsx               +harvestSelection imperative handle, +chainBadge prop
src/pages/ChatHub.tsx                      Mount pending-context check, chain-mode rendering
src/store/index.ts                         +chainMode + chainState slice
src/utils/constants.ts                     +pendingContext, chainPresets storage keys
src/background.ts                          +contextMenus + extractor dispatch + openOrFocusChatHub
manifest.config.ts                         +contextMenus, +notifications permissions; +file:///*; +WAR entries
vite.config.ts                             extractor.ts rollup input + pdf worker copy
package.json                               deps + scripts
src/locales/en.ts, src/locales/zh-CN.ts    new strings
README.md                                  file:// opt-in instructions
```

---

## Task 1: Test infrastructure (Vitest + jsdom)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/utils/__tests__/.gitkeep` (so the dir exists; later tasks add real tests)

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev vitest@^2.1.0 jsdom@^25.0.0
```

Expected: `package.json` devDependencies updated, no peer-dep warnings.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
    restoreMocks: true,
    setupFiles: ['src/test/setup.ts'],
  },
});
```

- [ ] **Step 3: Create `src/test/setup.ts` with chrome API stub**

```ts
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
```

- [ ] **Step 4: Wire scripts in `package.json`**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Verify infra**

Run: `npm test`
Expected: PASS with "No test files found" message (acceptable — infra works, real tests come next tasks).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json package-lock.json
git commit -m "test: add vitest + jsdom infrastructure with chrome.storage stub"
```

---

## Task 2: Install runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Readability + pdf.js**

```bash
npm install @mozilla/readability@^0.5.0 pdfjs-dist@^4.5.136
npm install --save-dev @types/dom-mediacapture-record
```

Expected: `dependencies` gains both packages.

- [ ] **Step 2: Verify pdfjs-dist worker file exists**

Run: `ls node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
Expected: file exists. (Used later by vite.config.ts to copy into dist.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @mozilla/readability and pdfjs-dist runtime deps"
```

---

## Task 3: ContextPayload service (TDD)

**Files:**
- Create: `src/services/contextPayload.ts`
- Create: `src/services/__tests__/contextPayload.test.ts`
- Modify: `src/utils/constants.ts`

- [ ] **Step 1: Add storage keys to constants**

Edit `src/utils/constants.ts`, add inside `STORAGE_KEYS`:

```ts
  pendingContext: 'chathub:pending-context',
  chainPresets: 'chathub:chain-presets',
```

- [ ] **Step 2: Write the failing test**

Create `src/services/__tests__/contextPayload.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  setPending, consumePending, peekPending, PENDING_TTL_MS,
  type ContextPayload,
} from '../contextPayload';

const sample = (over: Partial<ContextPayload> = {}): ContextPayload => ({
  kind: 'article',
  text: 'hello world',
  sourceUrl: 'https://example.com/a',
  sourceTitle: 'Example',
  charCount: 11,
  truncated: false,
  createdAt: Date.now(),
  ...over,
});

describe('contextPayload', () => {
  it('round-trips a payload through storage', async () => {
    const p = sample();
    await setPending(p);
    const got = await peekPending();
    expect(got).toEqual(p);
  });

  it('consumePending deletes after read', async () => {
    await setPending(sample());
    expect(await consumePending()).not.toBeNull();
    expect(await peekPending()).toBeNull();
  });

  it('returns null when payload is older than TTL', async () => {
    const stale = sample({ createdAt: Date.now() - PENDING_TTL_MS - 1 });
    await setPending(stale);
    expect(await consumePending()).toBeNull();
  });

  it('returns null when nothing is stored', async () => {
    expect(await consumePending()).toBeNull();
    expect(await peekPending()).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- contextPayload`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/services/contextPayload.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- contextPayload`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/contextPayload.ts src/services/__tests__/contextPayload.test.ts src/utils/constants.ts
git commit -m "feat: add contextPayload service with TTL-bounded session storage"
```

---

## Task 4: Chain template assembly (TDD)

**Files:**
- Create: `src/utils/chainTemplate.ts`
- Create: `src/utils/__tests__/chainTemplate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/chainTemplate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assembleChainPrompt, DEFAULT_CHAIN_TEMPLATE } from '../chainTemplate';

describe('chainTemplate', () => {
  it('substitutes {prompt} {harvested} {prevPlatform}', () => {
    const out = assembleChainPrompt(
      'Tmpl: {prompt} / {harvested} / from {prevPlatform}',
      { prompt: 'Why?', harvested: 'Because.', prevPlatform: 'GPT' },
    );
    expect(out).toBe('Tmpl: Why? / Because. / from GPT');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(
      assembleChainPrompt('keep {unknown} as-is', { prompt: 'x', harvested: 'y', prevPlatform: 'z' }),
    ).toBe('keep {unknown} as-is');
  });

  it('replaces multiple occurrences of the same variable', () => {
    expect(
      assembleChainPrompt('{prompt} -> {prompt}', { prompt: 'q', harvested: '', prevPlatform: '' }),
    ).toBe('q -> q');
  });

  it('default template includes both prompt and harvested', () => {
    const out = assembleChainPrompt(DEFAULT_CHAIN_TEMPLATE, {
      prompt: 'P', harvested: 'H', prevPlatform: 'GPT',
    });
    expect(out).toContain('P');
    expect(out).toContain('H');
    expect(out).toContain('GPT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- chainTemplate`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/utils/chainTemplate.ts`**

```ts
export type ChainVars = {
  prompt: string;
  harvested: string;
  prevPlatform: string;
};

export const DEFAULT_CHAIN_TEMPLATE =
  '{prompt}\n\n上一步（{prevPlatform}）的关键回答：\n{harvested}';

export function assembleChainPrompt(template: string, vars: ChainVars): string {
  return template
    .replaceAll('{prompt}', vars.prompt)
    .replaceAll('{harvested}', vars.harvested)
    .replaceAll('{prevPlatform}', vars.prevPlatform);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- chainTemplate`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/chainTemplate.ts src/utils/__tests__/chainTemplate.test.ts
git commit -m "feat: add chainTemplate.assemble with safe replaceAll semantics"
```

---

## Task 5: Extractor — selection + Readability + fallback (TDD)

**Files:**
- Create: `src/contentScripts/extractor.ts`
- Create: `src/contentScripts/__tests__/extractor.test.ts`

The PDF path is added in Task 6 (no unit test — manual QA).

- [ ] **Step 1: Write the failing test**

Create `src/contentScripts/__tests__/extractor.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { run } from '../extractor';

function setBody(html: string, title = 'Test'): void {
  document.title = title;
  document.body.innerHTML = html;
  Object.defineProperty(document, 'contentType', { value: 'text/html', configurable: true });
}

beforeEach(() => {
  setBody('');
  window.getSelection()?.removeAllRanges();
});

describe('extractor', () => {
  it('returns kind=selection when text is selected', async () => {
    setBody('<p id="x">Hello world body</p>');
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('x')!);
    window.getSelection()!.addRange(range);
    const out = await run('auto');
    expect('text' in out && out.kind).toBe('selection');
    expect('text' in out && out.text).toContain('Hello world body');
  });

  it('forces kind=selection when kind=selection requested even with no selection (falls back to error)', async () => {
    setBody('<article>plenty of body text here for the article</article>');
    const out = await run('selection');
    expect('error' in out).toBe(true);
  });

  it('uses Readability for articles', async () => {
    setBody(
      '<article><h1>Title</h1>' +
      Array.from({ length: 20 }, (_, i) => `<p>Paragraph ${i} with enough text to count as content.</p>`).join('') +
      '</article>',
      'Big article',
    );
    const out = await run('auto');
    expect('text' in out && out.kind).toBe('article');
    expect('text' in out && out.text.length).toBeGreaterThan(200);
    expect('text' in out && out.sourceTitle).toBe('Big article');
  });

  it('falls back to innerText when Readability yields too little', async () => {
    setBody('<div>tiny</div>');
    const out = await run('auto');
    expect('text' in out && out.kind).toBe('article');
    expect('text' in out && out.text).toContain('tiny');
  });

  it('truncates to 8000 chars and marks truncated', async () => {
    const big = 'x'.repeat(9000);
    setBody(`<article>${big}</article>`);
    const out = await run('auto');
    expect('text' in out && out.text.length).toBe(8000);
    expect('truncated' in out && out.truncated).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- extractor`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/contentScripts/extractor.ts` (HTML paths only)**

```ts
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
  const fallback = (document.body.innerText || '').trim().slice(0, FALLBACK_INNERTEXT_MAX);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- extractor`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/contentScripts/extractor.ts src/contentScripts/__tests__/extractor.test.ts
git commit -m "feat: extractor selection + Readability + innerText fallback"
```

---

## Task 6: Extractor — PDF path with lazy pdf.js

**Files:**
- Modify: `src/contentScripts/extractor.ts`

This path is not unit-tested (jsdom can't fully emulate pdf.js worker). It is covered by manual QA (Task 19).

- [ ] **Step 1: Replace stub `extractPdf` with real implementation**

In `src/contentScripts/extractor.ts`, replace the stub:

```ts
async function extractPdf(): Promise<ExtractorResult> {
  try {
    const pdfjs = await import('pdfjs-dist');
    // Worker URL is provided by the extension; configured in Task 11 via vite copy.
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

    const url = window.location.href;
    const loadingTask = pdfjs.getDocument({ url, isEvalSupported: false });
    const doc = await loadingTask.promise;
    const maxPages = Math.min(doc.numPages, 50);
    const chunks: string[] = [];
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ');
      chunks.push(pageText);
      if (chunks.join('\n\n').length >= 8000) break;
    }
    const text = chunks.join('\n\n').trim();
    if (!text) return { error: '此 PDF 似乎是扫描件或加密文件，无法提取文本' };
    return basePayload(text, 'pdf');
  } catch (err) {
    return { error: 'PDF 解析失败：' + (err instanceof Error ? err.message : 'unknown') };
  }
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npm test -- extractor`
Expected: PASS (the existing 5 tests don't touch `application/pdf`).

- [ ] **Step 3: Commit**

```bash
git add src/contentScripts/extractor.ts
git commit -m "feat: extractor PDF path with lazy pdfjs-dist import"
```

---

## Task 7: harvestSelection RPC action in main.ts

**Files:**
- Modify: `src/contentScripts/main.ts`

- [ ] **Step 1: Add the case to the dispatcher**

In `src/contentScripts/main.ts`, inside the `addPostMessageListener` switch (between `'getLocationHref'` and `'captureStart'`):

```ts
      case 'harvestSelection': {
        const text = window.getSelection()?.toString() ?? '';
        return { text };
      }
```

- [ ] **Step 2: Build to catch typing issues**

Run: `npm run build`
Expected: build succeeds, dist/ produced.

- [ ] **Step 3: Commit**

```bash
git add src/contentScripts/main.ts
git commit -m "feat: add harvestSelection RPC action to content script"
```

---

## Task 8: Store extension — chain slice

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: Extend AppStore type with chain state**

In `src/store/index.ts`, modify the `AppStore` interface (add at the bottom of the interface, before `init`):

```ts
  // Chain mode (F2)
  chainMode: boolean;
  setChainMode: (on: boolean) => void;
```

And modify the `useAppStore` create body to include initial state and setter:

```ts
  chainMode: false,
  setChainMode(on) { set({ chainMode: on }); },
```

(Place near the other initial-state lines.)

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: add chainMode toggle to app store"
```

---

## Task 9: chainOrchestrator service (TDD)

**Files:**
- Create: `src/services/chainOrchestrator.ts`
- Create: `src/services/__tests__/chainOrchestrator.test.ts`

The orchestrator owns chain state (separate zustand store, narrow surface). It does not import `sendToIframe` directly; the dispatcher function is injected so we can test without an iframe.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/chainOrchestrator.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createChainStore, type ChainDispatcher,
} from '../chainOrchestrator';

const steps = [{ platformId: 'GPT' }, { platformId: 'Claude' }, { platformId: 'Gemini' }];

function makeDispatcher(): ChainDispatcher & { sent: { platformId: string; text: string }[]; harvest: Map<string, string> } {
  const sent: { platformId: string; text: string }[] = [];
  const harvest = new Map<string, string>();
  const d = {
    sent,
    harvest,
    async sendToPlatform(platformId: string, text: string) { sent.push({ platformId, text }); },
    async harvestFromPlatform(platformId: string) { return harvest.get(platformId) ?? ''; },
    async platformName(platformId: string) { return platformId; },
  };
  return d as ChainDispatcher & typeof d;
}

describe('chainOrchestrator', () => {
  let dispatcher: ReturnType<typeof makeDispatcher>;
  let store: ReturnType<typeof createChainStore>;

  beforeEach(() => {
    dispatcher = makeDispatcher();
    store = createChainStore(dispatcher);
  });

  it('starts and sends only the first step', async () => {
    await store.getState().start('Why?', steps);
    expect(store.getState().status).toBe('waiting_user');
    expect(store.getState().currentStep).toBe(0);
    expect(dispatcher.sent).toEqual([{ platformId: 'GPT', text: 'Why?' }]);
  });

  it('next harvests current panel and feeds into next', async () => {
    dispatcher.harvest.set('GPT', 'Because reasons.');
    await store.getState().start('Why?', steps);
    await store.getState().next();
    expect(store.getState().currentStep).toBe(1);
    expect(dispatcher.sent[1].platformId).toBe('Claude');
    expect(dispatcher.sent[1].text).toContain('Why?');
    expect(dispatcher.sent[1].text).toContain('Because reasons.');
    expect(dispatcher.sent[1].text).toContain('GPT');
  });

  it('next with empty harvest does NOT advance', async () => {
    dispatcher.harvest.set('GPT', '   '); // whitespace-only
    await store.getState().start('Why?', steps);
    await store.getState().next();
    expect(store.getState().currentStep).toBe(0);
    expect(store.getState().lastError).toMatch(/选中/);
    expect(dispatcher.sent).toHaveLength(1);
  });

  it('reaches done after final step', async () => {
    dispatcher.harvest.set('GPT', 'A1');
    dispatcher.harvest.set('Claude', 'A2');
    await store.getState().start('Q', steps);
    await store.getState().next();
    await store.getState().next();
    expect(store.getState().status).toBe('done');
    expect(store.getState().currentStep).toBe(2);
    expect(dispatcher.sent.map(s => s.platformId)).toEqual(['GPT', 'Claude', 'Gemini']);
  });

  it('abort transitions to aborted from any active state', async () => {
    await store.getState().start('Q', steps);
    store.getState().abort();
    expect(store.getState().status).toBe('aborted');
  });

  it('reset returns to idle', async () => {
    await store.getState().start('Q', steps);
    store.getState().reset();
    expect(store.getState().status).toBe('idle');
    expect(store.getState().currentStep).toBe(-1);
  });

  it('rejects start with empty steps', async () => {
    await expect(store.getState().start('Q', [])).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- chainOrchestrator`
Expected: FAIL.

- [ ] **Step 3: Implement `src/services/chainOrchestrator.ts`**

```ts
import { create, type StoreApi } from 'zustand';
import { assembleChainPrompt, DEFAULT_CHAIN_TEMPLATE } from '../utils/chainTemplate';

export type ChainStatus = 'idle' | 'running' | 'waiting_user' | 'done' | 'aborted';

export type ChainStep = { platformId: string };

export type ChainState = {
  status: ChainStatus;
  steps: ChainStep[];
  currentStep: number;
  originalPrompt: string;
  template: string;
  history: { step: number; injectedText: string }[];
  lastError: string | null;
  start: (prompt: string, steps: ChainStep[], template?: string) => Promise<void>;
  next: () => Promise<void>;
  abort: () => void;
  reset: () => void;
};

export type ChainDispatcher = {
  sendToPlatform: (platformId: string, text: string) => Promise<void>;
  harvestFromPlatform: (platformId: string) => Promise<string>;
  platformName: (platformId: string) => Promise<string> | string;
};

const initialState = {
  status: 'idle' as ChainStatus,
  steps: [] as ChainStep[],
  currentStep: -1,
  originalPrompt: '',
  template: DEFAULT_CHAIN_TEMPLATE,
  history: [] as { step: number; injectedText: string }[],
  lastError: null as string | null,
};

export function createChainStore(d: ChainDispatcher): StoreApi<ChainState> {
  return create<ChainState>((set, get) => ({
    ...initialState,

    async start(prompt, steps, template) {
      if (steps.length === 0) throw new Error('chain steps cannot be empty');
      set({
        ...initialState,
        status: 'waiting_user',
        steps,
        currentStep: 0,
        originalPrompt: prompt,
        template: template ?? DEFAULT_CHAIN_TEMPLATE,
        history: [{ step: 0, injectedText: prompt }],
      });
      await d.sendToPlatform(steps[0].platformId, prompt);
    },

    async next() {
      const s = get();
      if (s.status !== 'waiting_user') return;
      if (s.currentStep >= s.steps.length - 1) return;

      const fromId = s.steps[s.currentStep].platformId;
      const harvested = (await d.harvestFromPlatform(fromId)).trim();
      if (!harvested) {
        set({ lastError: '请先在面板中选中要传递的文本' });
        return;
      }

      const prevName = await d.platformName(fromId);
      const nextStep = s.currentStep + 1;
      const toId = s.steps[nextStep].platformId;
      const text = assembleChainPrompt(s.template, {
        prompt: s.originalPrompt,
        harvested,
        prevPlatform: String(prevName),
      });
      await d.sendToPlatform(toId, text);

      const newHistory = [...s.history, { step: nextStep, injectedText: text }];
      const reachedEnd = nextStep === s.steps.length - 1;
      set({
        currentStep: nextStep,
        history: newHistory,
        status: reachedEnd ? 'done' : 'waiting_user',
        lastError: null,
      });
    },

    abort() {
      if (get().status === 'idle') return;
      set({ status: 'aborted' });
    },

    reset() {
      set({ ...initialState });
    },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- chainOrchestrator`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/chainOrchestrator.ts src/services/__tests__/chainOrchestrator.test.ts
git commit -m "feat: chain orchestrator state machine with TDD coverage"
```

---

## Task 10: Wire chain store singleton into the app

**Files:**
- Create: `src/services/chainStore.ts` (singleton wrapper bound to real iframe RPC)
- Modify: `src/components/ChatPanel.tsx`

`ChainDispatcher` impl talks to `ChatPanel` via imperative handles. We add `harvestSelection` to the existing handle and look panels up by `platformId`.

- [ ] **Step 1: Extend `ChatPanel` imperative handle**

Read `src/components/ChatPanel.tsx` first to locate the `useImperativeHandle` block. Modify it to additionally expose `harvestSelection`:

```ts
useImperativeHandle(ref, () => ({
  sendText: async (text: string) => { /* existing */ },
  // existing methods …
  harvestSelection: async (): Promise<string> => {
    const reply = await sendToIframe<{ text: string }>(iframeRef.current!, 'harvestSelection');
    return reply?.text ?? '';
  },
}));
```

And update the `ChatPanelHandle` type (in the same file or its `types.ts`) to add:

```ts
harvestSelection(): Promise<string>;
```

- [ ] **Step 2: Create `src/services/chainStore.ts`**

```ts
import { createChainStore, type ChainDispatcher } from './chainOrchestrator';

type PanelRegistry = {
  resolve(platformId: string): {
    sendText(text: string): Promise<void>;
    harvestSelection(): Promise<string>;
  } | null;
  platformName(platformId: string): string;
};

let registry: PanelRegistry | null = null;

export function bindPanelRegistry(r: PanelRegistry): void {
  registry = r;
}

const dispatcher: ChainDispatcher = {
  async sendToPlatform(platformId, text) {
    const p = registry?.resolve(platformId);
    if (!p) throw new Error(`panel not found: ${platformId}`);
    await p.sendText(text);
  },
  async harvestFromPlatform(platformId) {
    const p = registry?.resolve(platformId);
    if (!p) return '';
    return p.harvestSelection();
  },
  platformName(platformId) {
    return registry?.platformName(platformId) ?? platformId;
  },
};

export const chainStore = createChainStore(dispatcher);
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: PASS. (No runtime usage yet; wiring in Task 14.)

- [ ] **Step 4: Commit**

```bash
git add src/services/chainStore.ts src/components/ChatPanel.tsx
git commit -m "feat: chain store singleton + ChatPanel.harvestSelection handle"
```

---

## Task 11: vite + manifest — pdf worker, extractor entry, permissions

**Files:**
- Modify: `vite.config.ts`
- Modify: `manifest.config.ts`
- Create: `scripts/copy-pdf-worker.mjs`
- Modify: `package.json` (build script chain)

- [ ] **Step 1: Create the pdf worker copy script**

`scripts/copy-pdf-worker.mjs`:

```js
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const src = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
const dest = 'public/pdf.worker.min.mjs';
if (!existsSync(src)) {
  console.error('[copy-pdf-worker] source missing:', src);
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('[copy-pdf-worker] copied', src, '->', dest);
```

- [ ] **Step 2: Add `extractor.ts` as an additional rollup input**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    hmr: { port: 5181 },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      input: {
        chatHub: path.resolve(__dirname, 'chatHub.html'),
        extractor: path.resolve(__dirname, 'src/contentScripts/extractor.ts'),
      },
      output: {
        // Stable filename so chrome.scripting.executeScript can reference it.
        entryFileNames: chunk =>
          chunk.name === 'extractor' ? 'extractor.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
```

- [ ] **Step 3: Update manifest permissions and WAR**

Edit `manifest.config.ts`:

```ts
  permissions: ['storage', 'declarativeNetRequest', 'scripting', 'tabs', 'contextMenus', 'notifications'],
  host_permissions: ['<all_urls>', 'file:///*'],
  web_accessible_resources: [
    defineDynamicResource({
      matches: ['http://*/*', 'https://*/*'],
      use_dynamic_url: false,
    }),
    {
      resources: ['extractor.js', 'pdf.worker.min.mjs', 'assets/*'],
      matches: ['<all_urls>', 'file:///*'],
    },
  ],
```

- [ ] **Step 4: Update build script to include pdf worker copy**

In `package.json`, change the `build` script:

```json
"build:pdf-worker": "node scripts/copy-pdf-worker.mjs",
"build": "npm run build:priority && npm run build:pdf-worker && tsc -b --noEmit && vite build",
```

- [ ] **Step 5: Build and verify outputs**

Run: `npm run build`
Expected: `dist/extractor.js` and `dist/pdf.worker.min.mjs` both exist.

```bash
ls dist/extractor.js dist/pdf.worker.min.mjs
```

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts manifest.config.ts scripts/copy-pdf-worker.mjs package.json
git commit -m "build: emit extractor.js + copy pdf worker; add file:// + contextMenus perms"
```

---

## Task 12: ContextPreviewChip component

**Files:**
- Create: `src/components/ContextPreviewChip.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { CloseOutlined, FilePdfOutlined, FileTextOutlined, HighlightOutlined } from '@ant-design/icons';
import type { ContextPayload } from '../services/contextPayload';

const KIND_ICON: Record<ContextPayload['kind'], React.ReactNode> = {
  selection: <HighlightOutlined />,
  article: <FileTextOutlined />,
  pdf: <FilePdfOutlined />,
};

type Props = {
  ctx: ContextPayload;
  onDismiss: () => void;
};

export function ContextPreviewChip({ ctx, onDismiss }: Props) {
  const preview = ctx.text.slice(0, 500) + (ctx.text.length > 500 ? '…' : '');
  const charLabel = ctx.charCount.toLocaleString();
  return (
    <Tooltip title={<pre style={{ maxWidth: 480, whiteSpace: 'pre-wrap' }}>{preview}</pre>}>
      <Tag
        icon={KIND_ICON[ctx.kind]}
        closable
        closeIcon={<CloseOutlined onClick={onDismiss} />}
        style={{ margin: '4px 0', padding: '4px 10px', cursor: 'pointer' }}
        onClick={e => {
          if ((e.target as HTMLElement).closest('.anticon-close')) return;
          chrome.tabs.create({ url: ctx.sourceUrl });
        }}
      >
        来自 “{ctx.sourceTitle}” · {charLabel} 字{ctx.truncated ? ' · 已截断到 8,000' : ''}
      </Tag>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContextPreviewChip.tsx
git commit -m "feat: ContextPreviewChip with source link + dismiss + hover preview"
```

---

## Task 13: ChainEditor drawer

**Files:**
- Create: `src/components/ChainEditor.tsx`

- [ ] **Step 1: Implement the drawer**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, Button, Select, Input, List, Space, message } from 'antd';
import { DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { DEFAULT_CHAIN_TEMPLATE } from '../utils/chainTemplate';
import { STORAGE_KEYS } from '../utils/constants';

export type ChainPreset = {
  id: string;
  name: string;
  platformIds: string[];
  template: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialPlatformIds: string[];
  initialTemplate: string;
  onConfirm: (platformIds: string[], template: string) => void;
};

export function ChainEditor({ open, onClose, initialPlatformIds, initialTemplate, onConfirm }: Props) {
  const bundle = useAppStore(s => s.bundle);
  const [platformIds, setPlatformIds] = useState<string[]>(initialPlatformIds);
  const [template, setTemplate] = useState<string>(initialTemplate || DEFAULT_CHAIN_TEMPLATE);
  const [presets, setPresets] = useState<ChainPreset[]>([]);
  const [presetName, setPresetName] = useState('');

  useEffect(() => { setPlatformIds(initialPlatformIds); }, [initialPlatformIds, open]);
  useEffect(() => { setTemplate(initialTemplate || DEFAULT_CHAIN_TEMPLATE); }, [initialTemplate, open]);

  useEffect(() => {
    if (!open) return;
    chrome.storage.local.get(STORAGE_KEYS.chainPresets).then(obj => {
      const list = (obj[STORAGE_KEYS.chainPresets] as ChainPreset[] | undefined) ?? [];
      setPresets(list);
    });
  }, [open]);

  const availableOptions = useMemo(
    () => (bundle?.chatApps ?? []).map(a => ({ value: a.id, label: a.name ?? a.id })),
    [bundle],
  );

  function move(i: number, dir: -1 | 1): void {
    const j = i + dir;
    if (j < 0 || j >= platformIds.length) return;
    const next = [...platformIds];
    [next[i], next[j]] = [next[j], next[i]];
    setPlatformIds(next);
  }

  async function savePreset() {
    if (!presetName.trim()) { message.warning('请填入预设名'); return; }
    if (platformIds.length === 0) { message.warning('链至少包含一个平台'); return; }
    const next: ChainPreset[] = [
      ...presets.filter(p => p.name !== presetName.trim()),
      { id: `p_${Date.now()}`, name: presetName.trim(), platformIds, template },
    ];
    await chrome.storage.local.set({ [STORAGE_KEYS.chainPresets]: next });
    setPresets(next);
    setPresetName('');
    message.success('已保存预设');
  }

  function loadPreset(p: ChainPreset) {
    setPlatformIds(p.platformIds);
    setTemplate(p.template);
  }

  async function deletePreset(id: string) {
    const next = presets.filter(p => p.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.chainPresets]: next });
    setPresets(next);
  }

  function confirm() {
    if (platformIds.length === 0) { message.warning('链至少包含一个平台'); return; }
    onConfirm(platformIds, template);
    onClose();
  }

  return (
    <Drawer title="编辑接龙链" open={open} onClose={onClose} width={480}
      extra={<Button type="primary" onClick={confirm}>确定</Button>}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 8 }}>链顺序（从上到下依次接龙）：</div>
          <List
            bordered
            dataSource={platformIds}
            renderItem={(id, i) => (
              <List.Item
                actions={[
                  <Button key="up" icon={<ArrowUpOutlined />} size="small" onClick={() => move(i, -1)} />,
                  <Button key="dn" icon={<ArrowDownOutlined />} size="small" onClick={() => move(i, 1)} />,
                  <Button key="rm" icon={<DeleteOutlined />} size="small" danger onClick={() =>
                    setPlatformIds(platformIds.filter((_, j) => j !== i))} />,
                ]}
              >
                {i + 1}. {availableOptions.find(o => o.value === id)?.label ?? id}
              </List.Item>
            )}
          />
        </div>

        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="添加平台到链…"
          value={[]}
          options={availableOptions.filter(o => !platformIds.includes(o.value))}
          onChange={(vals: string[]) => setPlatformIds([...platformIds, ...vals])}
        />

        <div>
          <div style={{ marginBottom: 8 }}>链模板（可用变量：{'{prompt} {harvested} {prevPlatform}'}）</div>
          <Input.TextArea
            rows={4}
            value={template}
            onChange={e => setTemplate(e.target.value)}
            placeholder={DEFAULT_CHAIN_TEMPLATE}
          />
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>命名预设</div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={presetName}
              placeholder="例如：评审链"
              onChange={e => setPresetName(e.target.value)}
            />
            <Button onClick={savePreset}>保存预设</Button>
          </Space.Compact>
        </div>

        {presets.length > 0 && (
          <List
            size="small"
            header="已保存预设"
            dataSource={presets}
            renderItem={p => (
              <List.Item actions={[
                <Button key="load" size="small" onClick={() => loadPreset(p)}>加载</Button>,
                <Button key="del" size="small" danger onClick={() => deletePreset(p.id)}>删除</Button>,
              ]}>
                <strong>{p.name}</strong> — {p.platformIds.join(' → ')}
              </List.Item>
            )}
          />
        )}
      </Space>
    </Drawer>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChainEditor.tsx
git commit -m "feat: ChainEditor drawer with reorder + template + named presets"
```

---

## Task 14: ChainModeBar + AnswerHarvestButton

**Files:**
- Create: `src/components/ChainModeBar.tsx`
- Create: `src/components/AnswerHarvestButton.tsx`

- [ ] **Step 1: Implement ChainModeBar**

```tsx
import React, { useState } from 'react';
import { Switch, Button, Tag, Space, message } from 'antd';
import { PlayCircleOutlined, RightOutlined, RedoOutlined, StopOutlined, EditOutlined } from '@ant-design/icons';
import { useStore } from 'zustand';
import { chainStore } from '../services/chainStore';
import { useAppStore } from '../store';
import { ChainEditor } from './ChainEditor';
import { DEFAULT_CHAIN_TEMPLATE } from '../utils/chainTemplate';

type Props = {
  inputValue: string;
  onStartChain: () => void; // ChatHub passes inputValue and triggers start
};

export function ChainModeBar({ inputValue, onStartChain }: Props) {
  const chainMode = useAppStore(s => s.chainMode);
  const setChainMode = useAppStore(s => s.setChainMode);
  const chain = useStore(chainStore);
  const [editorOpen, setEditorOpen] = useState(false);
  const bundle = useAppStore(s => s.bundle);

  const platformNames = chain.steps.map(s => bundle?.chatApps.find(a => a.id === s.platformId)?.name ?? s.platformId);

  const statusBadge = (() => {
    switch (chain.status) {
      case 'idle': return <Tag>idle</Tag>;
      case 'waiting_user': return <Tag color="processing">步骤 {chain.currentStep + 1}/{chain.steps.length} 等待选区</Tag>;
      case 'running': return <Tag color="processing">运行中</Tag>;
      case 'done': return <Tag color="success">完成 ✓</Tag>;
      case 'aborted': return <Tag color="error">已中断</Tag>;
    }
  })();

  const primary = (() => {
    if (chain.status === 'idle') {
      return <Button type="primary" icon={<PlayCircleOutlined />} onClick={onStartChain}>发起链</Button>;
    }
    if (chain.status === 'waiting_user') {
      return <Button type="primary" icon={<RightOutlined />} onClick={async () => {
        await chain.next();
        if (chainStore.getState().lastError) message.warning(chainStore.getState().lastError!);
      }}>下一步</Button>;
    }
    if (chain.status === 'done') {
      return <Button icon={<RedoOutlined />} onClick={() => chain.reset()}>重启</Button>;
    }
    return <Button icon={<RedoOutlined />} onClick={() => chain.reset()}>清空</Button>;
  })();

  return (
    <Space wrap>
      <Switch checked={chainMode} onChange={setChainMode} checkedChildren="链模式" unCheckedChildren="链模式" />
      {chainMode && (
        <>
          {platformNames.length > 0
            ? <span style={{ opacity: 0.85 }}>{platformNames.join(' → ')}</span>
            : <span style={{ opacity: 0.6 }}>（未配置）</span>}
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>编辑链</Button>
          {statusBadge}
          {primary}
          {chain.status === 'waiting_user' && (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => chain.abort()}>中断</Button>
          )}
        </>
      )}
      <ChainEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initialPlatformIds={chain.steps.map(s => s.platformId)}
        initialTemplate={chain.template || DEFAULT_CHAIN_TEMPLATE}
        onConfirm={(ids, template) => {
          // Apply by resetting + re-start needed by ChatHub; we just write into store.
          chainStore.setState({
            steps: ids.map(id => ({ platformId: id })),
            template,
          });
        }}
      />
    </Space>
  );
}
```

- [ ] **Step 2: Implement AnswerHarvestButton**

```tsx
import React from 'react';
import { Button, message } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useStore } from 'zustand';
import { chainStore } from '../services/chainStore';

type Props = {
  platformId: string;
};

export function AnswerHarvestButton({ platformId }: Props) {
  const chain = useStore(chainStore);
  if (chain.status !== 'waiting_user') return null;
  const currentPlatformId = chain.steps[chain.currentStep]?.platformId;
  if (currentPlatformId !== platformId) return null;
  return (
    <Button
      size="small"
      type="primary"
      icon={<RightOutlined />}
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
      onClick={async () => {
        await chain.next();
        const err = chainStore.getState().lastError;
        if (err) message.warning(err);
      }}
    >
      采集选区 → 下一步
    </Button>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChainModeBar.tsx src/components/AnswerHarvestButton.tsx
git commit -m "feat: ChainModeBar status UI + AnswerHarvestButton panel overlay"
```

---

## Task 15: ChatHub.tsx wiring

**Files:**
- Modify: `src/pages/ChatHub.tsx`

ChatHub is the central page that owns input + panels + send-to-all. We add: pending-context check on mount, chain-mode rendering branch, panel registry binding, chain-start hook.

- [ ] **Step 1: Read the current file**

Run: `wc -l src/pages/ChatHub.tsx`
(Engineer reads the file in editor to locate insertion points.)

- [ ] **Step 2: Add imports and pending-context state at top of component**

After existing imports, add:

```ts
import { consumePending, type ContextPayload } from '../services/contextPayload';
import { ContextPreviewChip } from '../components/ContextPreviewChip';
import { ChainModeBar } from '../components/ChainModeBar';
import { chainStore, bindPanelRegistry } from '../services/chainStore';
```

Inside the `ChatHub` component, near other `useState`s:

```ts
const [pendingCtx, setPendingCtx] = useState<ContextPayload | null>(null);
const chainMode = useAppStore(s => s.chainMode);
```

- [ ] **Step 3: Hook the consume on mount**

```ts
useEffect(() => {
  consumePending().then(p => {
    if (p) {
      setPendingCtx(p);
      setInputValue(p.text);
    }
  });
}, []);
```

(`setInputValue` is the existing input state setter; reuse it.)

- [ ] **Step 4: Bind panel registry once panels are stable**

```ts
useEffect(() => {
  bindPanelRegistry({
    resolve(platformId) {
      const ref = panelRefs.current[platformId];
      if (!ref) return null;
      return {
        sendText: t => ref.sendText(t),
        harvestSelection: () => ref.harvestSelection(),
      };
    },
    platformName(platformId) {
      return bundle?.chatApps.find(a => a.id === platformId)?.name ?? platformId;
    },
  });
}, [bundle]);
```

(Where `panelRefs.current[platformId]` already exists in the current page; if not, store handle refs by id when rendering panels.)

- [ ] **Step 5: Render ChainModeBar in header**

Replace the existing header send-region with:

```tsx
<ChainModeBar
  inputValue={inputValue}
  onStartChain={async () => {
    const steps = chainStore.getState().steps;
    if (steps.length === 0) { message.warning('请先在「编辑链」里配置链顺序'); return; }
    if (!inputValue.trim()) { message.warning('请先输入起始 prompt'); return; }
    await chainStore.getState().start(inputValue, steps);
    setInputValue('');
  }}
/>
```

- [ ] **Step 6: Render ContextPreviewChip above input bar**

Above the existing `<InputBar … />` JSX:

```tsx
{pendingCtx && (
  <ContextPreviewChip
    ctx={pendingCtx}
    onDismiss={() => { setPendingCtx(null); setInputValue(''); }}
  />
)}
```

- [ ] **Step 7: Render AnswerHarvestButton overlay inside each panel**

In the panel render loop, wrap or annotate each `<ChatPanel>` with:

```tsx
<div style={{ position: 'relative' }}>
  <AnswerHarvestButton platformId={app.id} />
  <ChatPanel ... />
</div>
```

(Import `AnswerHarvestButton` at the top.)

- [ ] **Step 8: Build to verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/pages/ChatHub.tsx
git commit -m "feat: ChatHub wires pending context + chain mode UI"
```

---

## Task 16: background.ts — context menus + extractor invocation + tab management

**Files:**
- Modify: `src/background.ts`

The implementation uses approach (a) from the spec: an inline `func` that dynamically imports the bundled `extractor.js`. `args` IS supported with `func`.

- [ ] **Step 1: Add imports**

At the top of `src/background.ts`:

```ts
import { setPending } from './services/contextPayload';
```

- [ ] **Step 2: Add context menu registration inside `onInstalled`**

Modify the existing `onInstalled` listener:

```ts
chrome.runtime.onInstalled.addListener(() => {
  ensureClientId().catch(console.warn);
  try {
    chrome.contextMenus.create({
      id: 'chathub-send-selection',
      title: '发到 ChatHub：%s',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'chathub-summarize-page',
      title: '用 ChatHub 总结当前页/PDF',
      contexts: ['page', 'frame'],
    });
  } catch (err) {
    console.warn('[background] contextMenus.create failed', err);
  }
});
```

- [ ] **Step 3: Add the click handler with executeScript dispatch**

After the existing `onInstalled` listener block, add:

```ts
const EXTRACTOR_URL = chrome.runtime.getURL('extractor.js');

async function runExtractor(tabId: number, kind: 'selection' | 'auto') {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: async (extractorUrl: string, k: 'selection' | 'auto') => {
      const mod = await import(/* @vite-ignore */ extractorUrl);
      return mod.run(k);
    },
    args: [EXTRACTOR_URL, kind],
  });
  return result as Awaited<ReturnType<typeof import('./contentScripts/extractor').run>>;
}

async function openOrFocusChatHub() {
  const url = chrome.runtime.getURL('chatHub.html');
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(t => t.url?.startsWith(url));
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true });
    await chrome.tabs.reload(existing.id);
    return;
  }
  await chrome.tabs.create({ url });
}

function notify(title: string, msg: string) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('public/icons/logo-128.png'),
      title,
      message: msg,
    });
  } catch {
    console.warn('[background] notify failed', title, msg);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const kind: 'selection' | 'auto' = info.menuItemId === 'chathub-send-selection' ? 'selection' : 'auto';
  try {
    const result = await runExtractor(tab.id, kind);
    if (!result || 'error' in result) {
      const errMsg = (result && 'error' in result) ? result.error : '内容提取失败';
      if (tab.url?.startsWith('file://') && /Cannot access|file:\/\//.test(errMsg)) {
        notify('ChatHub', '本地 PDF 需在 chrome://extensions 启用「允许访问文件 URL」');
      } else {
        notify('ChatHub', errMsg);
      }
      return;
    }
    await setPending(result);
    await openOrFocusChatHub();
  } catch (err) {
    console.error('[background] extractor dispatch failed', err);
    notify('ChatHub', '内容提取失败：' + (err instanceof Error ? err.message : 'unknown'));
  }
});
```

- [ ] **Step 4: Type-check + build**

Run: `npm run build`
Expected: PASS. `dist/extractor.js` exists from Task 11.

- [ ] **Step 5: Commit**

```bash
git add src/background.ts
git commit -m "feat: contextMenus dispatch -> extractor -> setPending -> openOrFocusChatHub"
```

---

## Task 17: i18n strings

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh-CN.ts`

- [ ] **Step 1: Add strings to en.ts**

Add inside the existing exported translation object:

```ts
  contextChip: {
    fromSource: 'From "{title}" · {count} chars',
    truncatedSuffix: ' · truncated to 8,000',
  },
  chain: {
    toggle: 'Chain mode',
    edit: 'Edit chain',
    start: 'Start chain',
    next: 'Next ▶',
    restart: 'Restart',
    abort: 'Abort',
    clear: 'Clear',
    statusIdle: 'idle',
    statusWaiting: 'Step {current}/{total} — select text & next',
    statusDone: 'Done ✓',
    statusAborted: 'Aborted',
    needSelection: 'Please select text in the panel first.',
    needSteps: 'Configure the chain order first in "Edit chain".',
    needPrompt: 'Type an initial prompt first.',
  },
  extractor: {
    failed: 'Extraction failed',
    localPdfHint: 'Local PDFs require enabling "Allow access to file URLs" in chrome://extensions',
  },
```

- [ ] **Step 2: Add strings to zh-CN.ts**

```ts
  contextChip: {
    fromSource: '来自 “{title}” · {count} 字',
    truncatedSuffix: ' · 已截断到 8,000',
  },
  chain: {
    toggle: '链模式',
    edit: '编辑链',
    start: '发起链',
    next: '下一步 ▶',
    restart: '重启',
    abort: '中断',
    clear: '清空',
    statusIdle: 'idle',
    statusWaiting: '步骤 {current}/{total} — 选中文字后点下一步',
    statusDone: '完成 ✓',
    statusAborted: '已中断',
    needSelection: '请先在面板中选中要传递的文本',
    needSteps: '请先在「编辑链」里配置链顺序',
    needPrompt: '请先输入起始 prompt',
  },
  extractor: {
    failed: '内容提取失败',
    localPdfHint: '本地 PDF 需在 chrome://extensions 启用「允许访问文件 URL」',
  },
```

- [ ] **Step 3: Wire i18n in components (replace hard-coded zh-CN literals)**

In the components written above (`ContextPreviewChip`, `ChainModeBar`, `ChainEditor`, `AnswerHarvestButton`, `ChatHub`), replace hard-coded Chinese strings with `t('chain.start')` etc. using the existing `useTranslation()` hook pattern from `react-i18next` already present in the project.

(For each component: add `const { t } = useTranslation();` and replace string literals.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/zh-CN.ts src/components/ src/pages/ChatHub.tsx
git commit -m "i18n: add EN + zh-CN strings for context chip and chain mode"
```

---

## Task 18: README updates

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a "What's new in v1.1" section before "Build + load"**

Insert this block:

```markdown
## What's new in v1.1 — Spotlight Update

- **Right-click "Send to ChatHub"** on any selected text (any web page). Prefills the ChatHub input bar; never auto-sends.
- **Right-click "Summarize this page / PDF"** on any page. Extracts article body via Readability (or the first ~50 pages of a PDF). Prefills the input bar; never auto-sends.
- **Chain mode (半自动接龙)** in the header: define an ordered chain of platforms (e.g. GPT → Claude → Gemini), send a prompt to step 1, select text in the panel and click "Next ▶" to feed it into step 2. Editable template, named presets, abort/restart controls.

### New permissions

| Permission | Why |
|---|---|
| `contextMenus` | To register the two right-click entries. |
| `notifications` | To surface extraction errors as a one-line toast. |
| `host_permissions: file:///*` | To summarize local PDFs (opt-in; see below). |

### Local PDF setup (one-time)

1. Open `chrome://extensions/`
2. Locate "ChatHub Replica" and click "Details"
3. Toggle **"Allow access to file URLs"** ON
4. Right-clicking a local PDF should now produce a summary.

Until this is enabled, right-clicking a local PDF shows a one-shot toast pointing here.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README — v1.1 spotlight features and file:// opt-in"
```

---

## Task 19: Manual QA checklist

**Files:**
- Create: `docs/manual-qa-spotlight.md`

- [ ] **Step 1: Write the checklist**

```markdown
# Manual QA — Spotlight Update

> Run after `npm run build` and loading `dist/` as an unpacked extension in Chrome.

## A. Right-click prefill (U1 + U2)

1. **Selection (U1)** — Wikipedia article, select one paragraph → right-click → "发到 ChatHub：…"
   - [ ] ChatHub tab opens
   - [ ] Chip shows source title and char count
   - [ ] Input bar contains the selected text
   - [ ] Nothing was auto-sent

2. **Article (U2-html)** — A 小红书 post → right-click empty area → "用 ChatHub 总结当前页/PDF"
   - [ ] Input bar contains the post body, NOT nav/sidebar/related posts
   - [ ] Chip "truncated" appears for very long posts

3. **PDF remote (U2-pdf-remote)** — Open an arxiv abstract PDF URL → right-click empty area
   - [ ] Input bar contains the first ~50 pages of text (capped at 8000 chars)

4. **PDF local (U2-pdf-local)** — Open `file:///some.pdf` (after enabling "Allow access to file URLs")
   - [ ] Same as above
   - [ ] Disabling the permission → right-click shows a notification pointing to chrome://extensions

5. **Privacy** — After (1), verify:
   - [ ] Pressing Cmd+R on the ChatHub tab does NOT re-prefill (consume-on-read)
   - [ ] Closing the chip clears the input

## B. Chain mode (F2)

6. **Setup** — Toggle "链模式" on, click "编辑链" → reorder to [GPT, Claude, Gemini] → save as preset "三国杀"
   - [ ] Preset appears in the list
   - [ ] Reloading the page and reopening shows the preset

7. **Happy path** — Type "用一句话概括什么是熵" → 发起链
   - [ ] Only GPT receives
   - [ ] Other panels show inactive style (or unchanged)

8. **Step transitions** — Select 1-2 sentences in GPT's answer → 下一步
   - [ ] Claude's input receives template-assembled text
   - [ ] Step badge updates to "2/3"

9. **Final step** — Repeat in Claude → 下一步
   - [ ] Gemini receives
   - [ ] Status becomes "完成 ✓"

10. **Empty selection** — On step 2, click 下一步 without selecting
    - [ ] Toast "请先在面板中选中要传递的文本"
    - [ ] Status unchanged

11. **Abort** — Mid-chain, click "中断"
    - [ ] Status becomes "已中断"
    - [ ] "清空" returns to idle

## C. Regression

12. - [ ] "全部发送" (non-chain mode) still works across all platforms
13. - [ ] Layout presets / Prompt Library / 长截图 / 9 keyboard shortcuts unchanged
14. - [ ] Custom platform create/edit/delete unaffected

## D. Build budget

15. After `npm run build`, run `du -sh dist/assets/*.js | sort -h`
    - [ ] Main chunk gz delta < 50 KB vs. baseline `main` branch
    - [ ] `pdf.worker.min.mjs` is in dist root but NOT statically imported by main chunk
```

- [ ] **Step 2: Commit**

```bash
git add docs/manual-qa-spotlight.md
git commit -m "docs: manual QA checklist for spotlight update"
```

---

## Task 20: Final build + bundle budget verification

**Files:**
- None modified

- [ ] **Step 1: Clean build**

```bash
rm -rf dist node_modules/.vite
npm run build
```

Expected: PASS.

- [ ] **Step 2: Check dist contents**

```bash
ls dist/extractor.js dist/pdf.worker.min.mjs dist/chatHub.html dist/priority.js
```

Expected: all four exist.

- [ ] **Step 3: Check bundle sizes**

```bash
du -sh dist/assets/*.js
du -sh dist/pdf.worker.min.mjs
```

Compare main entry chunk size to `git checkout main && npm run build && du -sh dist/assets/*.js` (then switch back). Acceptable if delta < 50 KB gzipped (use `gzip -c file.js | wc -c` for accurate gz size).

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all suites PASS.

- [ ] **Step 5: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 6: Tag a milestone commit**

```bash
git tag v1.1.0-spotlight
git log --oneline main..HEAD
```

Expected: linear commit history showing each task's commit.

---

## Notes for the executing engineer

- **Always run `npm test` before each commit** in tasks that touched testable code.
- **Read `docs/superpowers/specs/2026-05-21-chathub-spotlight-design.md`** before starting — it has the full architectural rationale and edge cases.
- **If a step's code conflicts with the file's current state**, prefer the spec's intent and adjust. Document any deviation in the commit message.
- **Do not skip manual QA (Task 19)**. The extractor PDF path and chain mode harvest both depend on real browser semantics and have no unit coverage.
- **The hook system in this repo** rebuilds priority.js as IIFE — do not remove that step from the build pipeline.
