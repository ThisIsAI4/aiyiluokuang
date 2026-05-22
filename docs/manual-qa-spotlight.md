# Manual QA Checklist — Spotlight Update (v1.1.0)

## A. Right-click "Send to ChatHub" (U1)

- [ ] Select text on any web page → right-click → "Send to ChatHub" → ChatHub input bar pre-filled with selected text
- [ ] Input bar shows `ContextPreviewChip` with correct source title and char count
- [ ] **Never auto-sends** — must press Enter / send button explicitly
- [ ] Clicking chip opens source page in new tab
- [ ] Dismissing chip removes context from input bar
- [ ] Chip tooltip shows first 500 chars of context on hover
- [ ] Works on pages with complex DOM (iframes, shadow DOM)

## B. Right-click "Summarize this page / PDF" (U2)

### HTML Pages
- [ ] Right-click on news article → "Summarize this page" → input bar pre-filled with extracted article body
- [ ] Uses Readability for article extraction (not raw innerHTML)
- [ ] Falls back to `innerText` if Readability fails
- [ ] Content truncated to 8,000 chars with "已截断" suffix shown
- [ ] **Never auto-sends**

### PDF Pages
- [ ] Right-click on online PDF → "Summarize this PDF" → input bar pre-filled with extracted text
- [ ] First ~50 pages extracted, truncated to 8,000 chars
- [ ] Right-click on local `file://` PDF → shows notification toast: "Local PDFs require enabling 'Allow access to file URLs'"
- [ ] After enabling `file:///*` permission in chrome://extensions → local PDF summarization works
- [ ] Extraction failure shows `notifications` toast with localized error message

## C. Chain Mode (F2)

- [ ] Click header "链模式 / Chain mode" toggle → mode activates
- [ ] Click "Edit chain" → ChainEditor drawer opens with platform list
- [ ] Can drag-reorder platforms in chain sequence
- [ ] Can save/load/delete named chain presets
- [ ] Template textarea shows default template with `{prompt}`, `{prevPlatform}`, `{harvested}`
- [ ] Custom template persists per preset
- [ ] **Start chain**: type prompt → click "发起链 / Start chain" → sends to first platform only
- [ ] Status badge shows "Step 1/N — select text & next"
- [ ] Select answer text in first panel → "Next ▶" button appears
- [ ] Click "Next ▶" → harvests selected text, assembles with template, sends to next platform
- [ ] Status updates to "Step 2/N" after each successful handoff
- [ ] **Abort**: click "中断 / Abort" → chain stops, status shows "Aborted"
- [ ] **Restart**: click "重启 / Restart" → starts over from step 1 with same initial prompt
- [ ] Chain completes → status shows "Done ✓"
- [ ] Empty chain steps → shows "Configure the chain order first" error
- [ ] No text selected when clicking Next → shows "Please select text first" error
- [ ] No initial prompt when starting → shows "Type an initial prompt first" error

## D. Regression

- [ ] All 30 built-in platforms load in iframes without console errors
- [ ] Synchronous multi-send works (type prompt → Enter sends to all visible platforms)
- [ ] Screenshot (single) works on each panel
- [ ] Long screenshot works across multi-iframe panels
- [ ] Prompt library CRUD works
- [ ] Custom platforms add/edit/delete works
- [ ] Keyboard shortcuts configurable and functional
- [ ] Theme toggle (System/Light/Dark) works
- [ ] Language switch (EN / zh-CN) works
- [ ] Layout presets create/switch/delete works
- [ ] Per-platform reload, fullscreen, new-chat works
- [ ] No new CSP / X-Frame-Options errors in console

## E. Build Budget

- [ ] `npm run build` completes without errors
- [ ] `dist/extractor.js` exists
- [ ] `dist/pdf.worker.min.mjs` exists
- [ ] `dist/priority.js` exists
- [ ] `dist/chatHub.html` exists
- [ ] Total gzipped JS delta vs v1.0 baseline < 50 KB
- [ ] `npx tsc -b --noEmit` passes with zero errors
- [ ] `npm test` passes (if tests exist)
