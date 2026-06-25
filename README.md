# ChatHub Replica

> **Languages:** English | [简体中文](./README.zh-CN.md)

A fully functional MV3 replica of [Simple Chat Hub](https://chathub.aipilot.cc/). It aggregates 30 mainstream AI chat platforms into one panel for synchronous multi-platform chat.

## What's included

### Architecture
- **Manifest V3** Chrome/Edge extension (`src/background.ts` service worker)
- **`declarativeNetRequest`** dynamically strips `X-Frame-Options` and `Content-Security-Policy` so AI platforms can be iframed.
- **Two content scripts** per platform:
  - `priority.js` (MAIN world, `document_start`): kills page focus-stealing, removes `autofocus`, forwards keyboard shortcuts to the parent. Pre-bundled by `scripts/build-priority.mjs` as a self-contained IIFE.
  - `main.ts` (ISOLATED world, `document_idle`): receives `sendText` from the parent, runs declarative actions, fills the input, clicks the send button, and coordinates long-screenshot scrolling.
- **PostMessage RPC** between the extension UI and content scripts (`{source: "chathub-replica", type, action, id, data}`).
- **30 built-in platforms** (16 international + 14 Chinese), each with optional `inputSelector`, `sendButtonSelector`, `inputMethod`, declarative `inputActions`/`sendActions`/`readyActions`/`newChatActions`, `scrollContainerSelector`, and `networkRules`.

### Features
- Synchronous multi-platform send
- Layout presets (named layouts of selected platforms)
- Configurable column count
- Per-platform reload, full-screen, new chat
- **Single & long screenshot** (heuristic scroll-container detection, fixed-element hiding, multi-iframe canvas stitching)
- **Prompt Library** (CRUD persistent prompts)
- **Custom Platforms** (add/edit your own URLs with selectors and advanced JSON config)
- **Configurable keyboard shortcuts** for 9 actions:
  - `focusInput`, `newChat`, `optimizePrompt`, `closeChat`, `reloadChat`, `enterFullscreen`
  - Pattern-based: `insertPrompt #N`, `switchLayout #N`, `switchPlatformTab #N`
- Theme: System / Light / Dark
- i18n: English + 简体中文 (extension supports the full 12-language structure from the original)
- Custom primary color
- Send-key mode: Enter or ⌘/Ctrl+Enter
- Per-platform tweaks (e.g. Grok OneTrust consent auto-dismiss)

### Compared to the original
| | Original Simple Chat Hub 2.4.0 | This Replica |
|---|---|---|
| Manifest | MV3 + dynamic rules + dynamic scripting | ✅ Same |
| Platforms | 30 built-in | ✅ Same 30 |
| Synchronous multi-send | ✅ | ✅ |
| Long screenshot (multi-iframe stitched) | ✅ | ✅ |
| Prompt library | ✅ | ✅ |
| Prompt optimization | Calls `chathub.aipilot.cc/api` (20/day) | ⚠️ Placeholder — bring your own LLM key |
| Custom platforms | ✅ | ✅ |
| 9-action shortcuts | ✅ | ✅ |
| Languages | 12 | EN + zh-CN (structure ready for 12) |
| Remote config sync | Pulls from server periodically | Not wired (built-in config only) |

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

## Build + load

```bash
cd chathub-replica
npm install          # use --registry=https://registry.npmmirror.com if slow
npm run build
```

Then:
1. Open `chrome://extensions/`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` directory
4. Click the extension's toolbar icon to open the ChatHub page

## Project layout

```
chathub-replica/
├─ package.json
├─ vite.config.ts
├─ manifest.config.ts          # typed CRXJS manifest
├─ scripts/
│  └─ build-priority.mjs       # pre-builds priority.ts as IIFE (MAIN world needs no chrome.runtime)
├─ chatHub.html                # main UI entry
├─ public/
│  └─ icons/                   # 16/32/48/128 PNG (placeholder)
├─ _locales/{en,zh_CN}/        # MV3 extension i18n (name/description)
└─ src/
   ├─ background.ts            # SW: DNR rules + content script registration + message routing
   ├─ main.tsx, App.tsx
   ├─ contentScripts/
   │  ├─ priority.ts           # MAIN world: focus/autofocus/shortcuts/Grok consent
   │  └─ main.ts               # ISOLATED: sendText, action engine, capture coordination
   ├─ platforms/
   │  ├─ configs.ts            # 30 built-in platforms
   │  └─ configManager.ts      # base + custom + cached + merged config
   ├─ utils/
   │  ├─ constants.ts          # storage keys, enums, defaults
   │  ├─ messaging.ts          # PostMessage RPC + chrome.runtime helper
   │  ├─ dom.ts                # ActionEngine, fillInput, triggerSend, shadow-DOM resolver
   │  ├─ screenshot.ts         # scroll-container heuristic, canvas helpers, image utils
   │  ├─ shortcuts.ts          # 9 default bindings, matcher, formatter
   │  └─ storage.ts            # chrome.storage.local helpers, clientId
   ├─ services/
   │  └─ capture.ts            # multi-iframe long-screenshot stitching driven from parent
   ├─ store/
   │  └─ index.ts              # zustand store: options, bundle, prompts, shortcuts, custom
   ├─ locales/
   │  ├─ en.ts, zh-CN.ts       # UI i18n bundles
   │  └─ index.ts              # i18next init + auto-detect
   ├─ components/
   │  ├─ ChatPanel.tsx         # one iframe panel + ready signal + RPC bridge
   │  ├─ SettingsDrawer.tsx
   │  ├─ LayoutManager.tsx
   │  ├─ PromptLibraryModal.tsx
   │  ├─ CustomConfigModal.tsx
   │  └─ ShortcutModal.tsx
   └─ pages/
      └─ ChatHub.tsx           # main view: header + layout tabs + iframe grid + input bar
```

## Key implementation notes

### Why two content scripts?
The original strips `HTMLElement.prototype.focus` at `document_start` — that prototype patch only works in MAIN world. But the input-fill / send-button / send-text logic needs `chrome.runtime`, which is only available in ISOLATED world. So the original splits responsibilities, and we do too.

### Why pre-bundle priority.js separately?
CRXJS 2.0.0-beta.28 does not support emitting content scripts as IIFE. MAIN-world scripts loaded via `chrome.scripting.registerContentScripts` execute as classic scripts (no ES modules, no `chrome.runtime.getURL`), so they must be a self-contained IIFE. We use esbuild as a pre-step to produce `public/priority.js`.

### Why does main.ts have no IIFE problem?
ISOLATED-world content scripts loaded by `chrome.scripting` have `chrome.runtime.getURL` available. CRXJS's default `?script` loader pattern works: it emits a tiny loader stub that uses `chrome.runtime.getURL` to import the actual module dynamically.

### How does the "send to all platforms" work?
Each `ChatPanel` exposes a `sendText(text)` imperative handle. The page collects all visible panels and calls `sendText` in parallel, which:
1. Uses `sendToIframe(iframeRef, 'sendText', {text})` → `window.postMessage` to the iframe.
2. The iframe's `main.ts` receives the message, runs `inputActions`, fills the input via the configured `inputMethod`, then either clicks the configured `sendButtonSelector` or dispatches Enter.

### How are platforms auto-configured (thinking model + web search) on every load?
Each platform config can declare `readyActions` — declarative actions the iframe's `main.ts` runs once the chat input appears, on **every** page load and refresh. Two idempotent action types drive the "best thinking model + tools" goal:
- `ensureToggleOn` — finds a toggle by `selector` or visible `buttonText` (array of candidate strings, matched by visible text since these sites ship hashed class names), checks whether it is already active, and clicks **only when off**. This is what keeps web-search / deep-thinking enabled without flipping it back off on the next refresh.
- `selectByText` — opens a model-switcher (`triggerText`) and clicks an option by visible `optionText`; short-circuits via `currentLabel`/`currentText` when the desired model is already selected.

Both fail safe: if a selector or label never matches, they time out and do nothing — the site is left untouched. Selectors/labels for sites beyond the primary set are best-effort and may need live tuning as platforms change their UI.

### How does the long screenshot work?
1. Parent calls `captureStart` on each iframe in parallel — each iframe finds its scroll container (heuristic detection), hides fixed/sticky/absolute overlay elements, and returns its scroll metrics.
2. Parent calculates output canvas dimensions and an aggregated scale ratio.
3. In a loop: parent tells all iframes to `triggerScroll(top)` in parallel, waits, calls `chrome.tabs.captureVisibleTab` (via background), and stitches that frame onto the right slice of the output canvas.
4. After the full height is covered, draws a header banner, calls `captureEnd` on each iframe (restoring scroll position and the previously hidden elements), and opens the result in a new tab.

## Limitations / TODO
- Prompt optimization currently shows a "configure your local LLM key" toast. Wire it to a backend or local API in `services/` and update `ChatHub.tsx`'s optimizePrompt handler.
- Remote config update endpoint is omitted — built-in bundle is the source of truth.
- Only EN + zh-CN UI translations included. Add others under `src/locales/`.
- Icons are 1×1 placeholders — replace under `public/icons/`.
- Some platforms (e.g. ChatGPT, Claude, Gemini) actively detect iframe embedding and may break over time. The `inputActions`/`sendActions` config layer is exactly the workaround vector — extend it as platforms change.
