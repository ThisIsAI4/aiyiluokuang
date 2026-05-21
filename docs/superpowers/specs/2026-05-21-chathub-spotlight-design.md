# ChatHub Replica v1.1 — Spotlight Update

**Date:** 2026-05-21
**Status:** Approved (brainstorming → spec)
**Scope:** One coherent feature pack covering 易用性 (U1+U2) + 趣味性 (F2). Security wins are bundled as side effects of the design choices.

---

## 1. Why

ChatHub Replica today is a strong single-screen multi-AI panel: send one prompt to N platforms, compare. Looking at the broader AI-hub plugin landscape (Sider, Merlin, Monica, Poe, ChatHub.gg), the most-requested usability gaps are:

- Bringing **arbitrary web content into the panel** (selection / article / PDF) without copy-paste friction.
- A **playful side-by-side mode beyond "fan-out"** — chaining models so one's answer feeds the next.

This spec adds three capabilities, minimally invasive on the existing architecture:

| Code | Capability | Value axis |
|------|------------|------------|
| U1 | Right-click "Send to ChatHub" on selected text | Usability |
| U2 | Right-click "Summarize this page / PDF" with main-content extraction | Usability |
| F2 | Half-automatic chain mode: A's selected answer becomes B's input | Fun |

The right-click flow is **prefill-only, never auto-send** — which makes U1+U2 a privacy win versus competing extensions that auto-fire to AI servers.

---

## 2. Decisions Locked

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chain automation level | **Half-auto** (user clicks "next", harvests selection from iframe) | Robust against platform DOM drift; no per-platform `outputSelector` maintenance. |
| Entry point for U1+U2 | **Right-click context menu** | Smallest UI footprint; no page-injected floating buttons, no Side Panel rebuild. |
| Content extraction | **Readability.js + pdfjs-dist** | Readability handles complex articles; pdf.js handles arxiv-style remote PDFs and (with user opt-in) local file:// PDFs. |
| Right-click flow | **Prefill only, no auto-send** | User reviews chip showing "X chars from {source}" before sending. Privacy + transparency. |
| Harvest signal in chain | **User text selection inside the iframe** | Robust, zero per-platform configuration. Falls back gracefully when selection is empty. |
| Local PDF support | **Yes, via `file:///*` host_permissions** | Requires user to manually enable "Allow access to file URLs" in chrome://extensions. Documented in README; first-failure toast guides user. |
| Default chain template | `{原 prompt}\n\n上一步（{平台 A}）的关键回答：\n{harvested}` | Editable per-chain. Saved presets allowed. |
| Git isolation | **Option A**: `git init` baseline → feature branch | Project is currently not a git repo. |

---

## 3. Architecture

```
[Existing — unchanged in shape]
src/background.ts                     SW: DNR + content-script registration + RPC routing
src/contentScripts/priority.ts        MAIN world: focus-killer, autofocus, shortcuts
src/contentScripts/main.ts            ISOLATED world: sendText, action engine, capture
src/pages/ChatHub.tsx                 Main view: header + grid + input
src/components/ChatPanel.tsx          One iframe panel + RPC bridge
src/store/index.ts                    zustand store

[New — added by this spec]
src/services/contextPayload.ts        Type + storage.session read/write
src/services/chainOrchestrator.ts     Chain state machine (idle/running/waiting/done/aborted)
src/contentScripts/extractor.ts       On-demand executeScript: Readability + pdf.js + selection
src/components/ContextPreviewChip.tsx Chip above input bar showing source + char count
src/components/ChainModeBar.tsx       Header control: toggle, status badge, primary button
src/components/ChainEditor.tsx        Drawer: chain order + template + presets
src/components/AnswerHarvestButton.tsx Per-panel overlay button in chain mode

[Modified]
src/contentScripts/main.ts            +1 RPC action: harvestSelection
src/pages/ChatHub.tsx                 Mount-time pending-context check; chain-mode wiring
src/components/ChatPanel.tsx          Imperative handle for harvestSelection; chain step badge
manifest.config.ts                    +permissions: contextMenus, scripting, notifications
                                      +host_permissions: file:///*
README.md                             Setup step for file:// access; new permissions explanation
```

### Module boundaries

Each new module has one job and a narrow interface:

- **`contextPayload`**: serialize/deserialize `ContextPayload` to `chrome.storage.session`. No DOM, no UI.
- **`chainOrchestrator`**: pure state machine over zustand store. Knows `start`, `next`, `abort`, `reset`. Does not own React refs; talks to panels via the existing `sendToIframe` helper.
- **`extractor`**: stateless; takes a tab, returns a `ContextPayload | { error }`. Branches on `document.contentType` and `getSelection()`.
- **UI components**: presentational; read store state, dispatch actions.

A reader should be able to understand each module without reading the others.

---

## 4. Data Flow

### 4.1 Right-click → prefill (U1 / U2)

```
User right-clicks page or selection
  → background.ts contextMenus listener
  → chrome.scripting.executeScript({ files: ["extractor.js"], target: { tabId } })
  → extractor branches:
      contentType === "application/pdf"  → dynamic import pdfjs-dist → fetch URL → extract pages
      window.getSelection().length > 0    → kind="selection"
      otherwise                            → Readability(document.cloneNode(true)).parse()
                                            → fallback to innerText[:4000] if Readability returns < 200 chars
  → returns ContextPayload (text capped at 8000 chars; truncated flag set)
  → background.setPending(payload)  // chrome.storage.session, 30-min TTL
  → background opens or focuses chatHub.html
  → ChatHub.tsx onMount: consumePending() (read-and-delete)
      payload exists  → render ContextPreviewChip + prefill input field
      no payload      → normal startup
  → User reviews, edits if needed, clicks "全部发送" → existing sendText flow
  → After first send, input is cleared and chip dismissed
```

**Privacy invariant:** `ContextPayload.text` is never sent to any AI platform without an explicit user click on the existing send button.

### 4.2 Chain mode (F2)

```
User toggles "链模式" in header → ChainModeBar replaces NormalHeader
  → User opens ChainEditor → defines ordered steps + template → saves
  → chainOrchestrator state: { status: "idle", steps, currentStep: -1, template }

User types prompt → "发起链 ▶"
  → orchestrator.start(prompt)
  → sends prompt to step 0 panel only (other panels show inactive style)
  → status="waiting_user", currentStep=0

User reads step 0 answer → selects text in iframe → clicks "下一步 ▶"
  → orchestrator.next()
  → sendToIframe(panel0, "harvestSelection") → main.ts: window.getSelection().toString()
  → returns harvestedText (30s timeout → "重试" / "跳过本步")
  → if empty: toast "请先在面板中选中要传递的文本"; status unchanged
  → if non-empty: assemble template variables {prompt, harvested, prevPlatform}
  → send to step 1 panel
  → status="waiting_user", currentStep=1

Repeat until currentStep === steps.length - 1
  → status="done"
  → UI offers "重启" / "导出全链截图" (reuses existing capture service)
```

---

## 5. Component Contracts

### 5.1 `src/services/contextPayload.ts`

```ts
export type ContextPayload = {
  kind: "selection" | "article" | "pdf";
  text: string;            // truncated to 8000 chars
  sourceUrl: string;
  sourceTitle: string;
  charCount: number;       // pre-truncation length, displayed in chip
  truncated: boolean;
  createdAt: number;       // ms epoch
};

const KEY = "chathub:pending-context";
const TTL_MS = 30 * 60 * 1000;

export async function setPending(p: ContextPayload): Promise<void>;
export async function consumePending(): Promise<ContextPayload | null>;  // read + delete
export async function peekPending(): Promise<ContextPayload | null>;     // read only
```

### 5.2 `src/contentScripts/extractor.ts`

Compiled to `extractor.js` and listed in `web_accessible_resources` for `chrome.scripting.executeScript`.

```ts
type ExtractorRequest = { kind: "selection" | "auto" };
type ExtractorResult = ContextPayload | { error: string };

async function run(req: ExtractorRequest): Promise<ExtractorResult>;
```

Branches:
1. If `document.contentType === "application/pdf"` and `req.kind === "auto"` → load pdfjs (`await import("pdfjs-dist")`), `getDocument(window.location.href)`, extract first 50 pages of text content, join with `\n\n`.
2. Else if `window.getSelection().toString().trim().length > 0` → `kind: "selection"`.
3. Else → `new Readability(document.cloneNode(true)).parse()`; if the result's `textContent.length < 200`, fallback to `document.body.innerText.slice(0, 4000)`.

All paths build a `ContextPayload`, truncate `text` to 8000 chars (set `truncated: true` if so), and return.

### 5.3 `src/contentScripts/main.ts` — new RPC action

```ts
case "harvestSelection": {
  const text = window.getSelection()?.toString() ?? "";
  reply({ id, ok: true, text });
  break;
}
```

No selector configuration, no per-platform changes.

### 5.4 `src/services/chainOrchestrator.ts`

```ts
type ChainStatus = "idle" | "running" | "waiting_user" | "done" | "aborted";

type ChainStep = { platformId: string };

type ChainState = {
  status: ChainStatus;
  steps: ChainStep[];
  currentStep: number;          // -1 when idle
  originalPrompt: string;
  template: string;
  history: { step: number; injectedText: string }[];
};

start(prompt: string, steps: ChainStep[]): Promise<void>;
next(): Promise<void>;           // harvest from current → assemble → send to next
abort(): void;
reset(): void;
```

Lives in zustand. Pure logic; no React refs. Communicates with panels via `sendToIframe`.

### 5.5 `src/components/ContextPreviewChip.tsx`

Presentational. Props: `{ ctx: ContextPayload, onDismiss: () => void }`.

```
[📰 来自 "如何让 AI 接龙更好玩 - 小红书" · 3,142 字 · 已截断到 8,000 ✕]
```

- ✕ → `onDismiss()` → clear local UI state (chip + prefilled input). Storage was already cleared by `consumePending` at mount.
- Click chip text → `chrome.tabs.create({ url: ctx.sourceUrl })`
- Hover → tooltip with first 500 chars of `ctx.text`

### 5.6 `src/components/ChainModeBar.tsx`

Header control region. Subscribes to `chainOrchestrator` state.

- "链模式" toggle (Switch)
- Chain summary: "GPT → Claude → Gemini"
- "编辑链 ✏️" → opens `ChainEditor`
- Status badge: "idle / 步骤 2/3 等待选区 / 完成 ✓ / 已中断"
- Primary button: shape-shifts by status — `idle: "发起链 ▶"`, `waiting_user: "下一步 ▶"`, `done: "重启"`, `aborted: "恢复" / "清空"`

### 5.7 `src/components/ChainEditor.tsx`

Drawer with:
- Drag-to-reorder list of currently visible bundle platforms
- Textarea for chain template (default value spelled out in §2; placeholder hints `{prompt} {harvested} {prevPlatform}`)
- Save-as-named-preset to `chrome.storage.local["chainPresets"]` (array of `{name, steps, template}`)
- Load preset / delete preset

Validation: none on the template; free-text is intentional. Empty steps array is rejected.

### 5.8 `src/components/AnswerHarvestButton.tsx`

Tiny overlay button on the panel matching `currentStep`. Click = call `chainOrchestrator.next()`. Pure UI sugar; ChainModeBar's primary button does the same thing — this just sits closer to the user's reading focus.

### 5.9 `src/components/ChatPanel.tsx` — additions

- Imperative handle method `harvestSelection(): Promise<string>` (wraps existing RPC call).
- New prop `chainBadge?: { step: number; total: number; active: boolean }` → renders top-left badge "STEP 2/3" when in chain mode.

### 5.10 `src/pages/ChatHub.tsx` — additions

```tsx
const pendingCtx = useAsync(consumePending);
const chainMode = useStore(s => s.chainMode);

return (
  <Layout>
    <Header>
      {chainMode ? <ChainModeBar /> : <NormalHeader />}
    </Header>
    <Grid>{panels.map(p => <ChatPanel chainBadge={...} {...p} />)}</Grid>
    {pendingCtx && <ContextPreviewChip ctx={pendingCtx} onDismiss={...} />}
    <InputBar
      prefilledText={pendingCtx?.text}
      sendButtonLabel={chainMode ? "发起链 ▶" : "全部发送"}
      onSend={chainMode ? chain.start : sendToAll}
    />
  </Layout>
);
```

### 5.11 `src/background.ts` — additions

```ts
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "chathub-send-selection",
    title: "发到 ChatHub「%s」",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "chathub-summarize-page",
    title: "用 ChatHub 总结当前页",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const kind = info.menuItemId === "chathub-send-selection" ? "selection" : "auto";
  // Note: chrome.scripting.executeScript does NOT support `args` together with
  // `files`. Resolve in plan phase by one of:
  //   (a) Compile a tiny inline `func` that does `await import(chrome.runtime.getURL("extractor.js")).run(kind)`.
  //   (b) Stash `kind` in `chrome.storage.session` first, then inject `files: ["extractor.js"]`
  //       and have extractor read it back.
  // Either is fine; (a) keeps the request body in flight, (b) is simpler to debug.
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k: string) => (window as any).__chathubExtract(k),  // tentative; finalize in plan
    args: [kind],
  });
  if (!result || "error" in result) {
    notifyFailure(result?.error ?? "提取失败");
    return;
  }
  await setPending(result);
  await openOrFocusChatHub();
});
```

`openOrFocusChatHub` checks for an existing tab with the chathub URL; focuses or creates accordingly.

### 5.12 `manifest.config.ts` — additions

```ts
permissions: [...existing, "contextMenus", "scripting", "notifications"],
host_permissions: [...existing, "file:///*"],
web_accessible_resources: [
  ...existing,
  { resources: ["extractor.js", "pdf.worker.min.js"], matches: ["<all_urls>"] },
],
```

---

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| Readability returns < 200 chars | Fallback to `document.body.innerText.slice(0, 4000)`, kind="article" |
| pdf.js dynamic import fails | Toast "PDF 解析失败，请改用选区右键" |
| PDF is encrypted / scanned image | Same as above; pdf.js will throw, we catch |
| `file://` injection fails (user has not opted in) | One-time guided notification: "本地 PDF 需在 chrome://extensions 启用「允许访问文件 URL」" |
| `harvestSelection` returns empty string | Toast "请先在面板中选中要传递的文本"; status unchanged; user can retry |
| `harvestSelection` postMessage 30s timeout | Show "跳过本步" / "重试" controls |
| User closes a panel mid-chain | `chainOrchestrator` transitions to `aborted`; ChainModeBar shows "链已中断 [恢复] [清空]" |
| `setPending` storage write fails | Fallback to in-memory pass-through (same tab transition only) |
| pending payload older than 30 min | `consumePending` returns null; user must retrigger |

---

## 7. Security & Privacy Posture

| Mechanism | Today | After v1.1 |
|-----------|-------|-----------|
| Auto-exfiltration of content | None (user clicks send) | None (right-click only prefills; user must still click send) |
| Pending payload storage | n/a | `chrome.storage.session` (cleared at browser restart), 30-min TTL, consume-and-delete |
| Chain transit text | n/a | Memory-only (zustand); cleared on abort or page navigation |
| Tab monitoring | None | None (extractor only runs when user explicitly right-clicks) |
| pdf.js worker | n/a | Bundled locally; no network calls |
| Local PDF access | None | Opt-in via user enabling "Allow access to file URLs" |

**Explicitly out of scope to avoid scope creep / supply-chain risk:**
- No automatic background summarization
- No cloud sync of prompts or chain history
- No remote chain-template marketplace
- No API key encryption (separate S2 spec for v1.2)

---

## 8. Performance Budget

| Metric | Target |
|--------|--------|
| Main bundle gz delta | < 50 KB |
| pdfjs-dist | Lazy-loaded, only fetched on first PDF right-click; ~150 KB gz |
| Right-click → ChatHub prefill (article) | < 500 ms |
| Right-click → ChatHub prefill (PDF, < 50 pages) | < 2 s |
| Chain harvest round-trip | < 200 ms |

---

## 9. Acceptance Criteria

1. **U1**: On a 小红书 / 微信公众号 article page, select a paragraph → right-click → "发到 ChatHub「...」" → opens ChatHub with input field prefilled, **not auto-sent**, chip displays char count and source.
2. **U2-html**: On a Wikipedia article, right-click empty area → "用 ChatHub 总结当前页" → input prefilled with article body (no nav/sidebar/ads), chip shows "已截断" if applicable.
3. **U2-pdf-remote**: On an arxiv PDF URL, right-click → input prefilled with first ~50 pages of text, capped at 8000 chars.
4. **U2-pdf-local**: After enabling "Allow access to file URLs" in chrome://extensions, same flow works on `file:///path/to.pdf`. Without enabling, a one-time guided toast appears.
5. **F2**: Define chain `[GPT, Claude, Gemini]`, type prompt, click "发起链 ▶" → only GPT receives. Select text in GPT panel, click "下一步 ▶" → Claude receives template-assembled text. Repeat to Gemini. Final state shows "完成 ✓".
6. **F2 errors**: If user clicks "下一步 ▶" with empty selection, toast appears, no state change. If user closes a panel mid-chain, status becomes `aborted`.
7. **Regression**: Existing "全部发送" / Layout presets / Prompt Library / long screenshot / 9-action shortcuts all continue working.
8. **Bundle**: Main bundle gz delta < 50 KB. PDF path does not contribute to main bundle.
9. **i18n**: All new user-facing strings have EN + zh-CN entries in `src/locales/`.
10. **README**: Documents file:// permission opt-in step and new manifest permissions (`contextMenus`, `scripting`, `notifications`, `file:///*`).

---

## 10. Out of Scope (deferred)

- Auto-detected `outputSelector` per platform for fully-automatic chain
- Two-stage extraction (selection-as-question + page-as-context)
- Chain DAG / parallel branches (more than linear N steps)
- Remote chain-template marketplace
- API key encryption at rest (separate spec)
- Chat history with full-text search (separate spec)
- Translation / TTS / image-gen integrations

---

## 11. Testing Strategy

- **Unit tests** (Vitest, new): `contextPayload` round-trip, Readability fallback branch, chain template assembly, orchestrator state transitions.
- **Manual QA checklist**: `docs/manual-qa-spotlight.md` — 5 representative platforms × 3 web-page types × 1 PDF, plus the 10 acceptance criteria.
- **No browser e2e**: extension e2e is high-cost / brittle; not justified for v1.1.

---

## 12. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| pdfjs-dist worker setup is fiddly under MV3 (importScripts, Trusted Types, worker URL) | High | Spike during plan phase; have plain `Readability + selection-only` as fallback if worker integration blocks. |
| Some platforms strip our content script (rare) → harvestSelection RPC silently fails | Medium | 30s timeout → user sees retry/skip; document known-broken platforms in QA checklist. |
| Local file:// permission confuses non-technical users | Medium | One-time inline toast + README screenshot. |
| Readability returns garbage on JS-rendered SPAs | Medium | innerText fallback always available; user can reselect text manually. |

---

## 13. Git Setup

Project is currently not a git repository. Before implementation:

```bash
cd chathub-replica
git init
git add -A
git commit -m "baseline: ChatHub Replica v1.0 functional snapshot"
git checkout -b feature/spotlight-update
```

All v1.1 work lands on `feature/spotlight-update`. Each module from §3 is a separate commit when feasible.
