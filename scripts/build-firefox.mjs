#!/usr/bin/env node
// Build the Firefox extension into dist-firefox/.
//
// Pipeline:
//   1. esbuild — priority.ts → priority.js (IIFE, Firefox target)
//   2. Vite build — chatHub.html (React UI) only
//   3. esbuild — background.ts (IIFE, no ESM)
//   4. esbuild — content scripts (IIFE)
//   5. Copy assets (icons, pdf.worker) to correct paths
//   6. Generate manifest.json from manifest.firefox.mjs

import { build as esbuild } from 'esbuild';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import manifestConfig from '../manifest.firefox.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT = path.join(ROOT, 'dist-firefox');

// ---------------------------------------------------------------------------
// esbuild plugin: replace crxjs ?script imports with a static URL string.
// ---------------------------------------------------------------------------
const crxScriptPlugin = {
  name: 'replace-crx-script-import',
  setup(build) {
    build.onResolve({ filter: /\?script$/ }, () => ({
      path: 'crx-script-url',
      namespace: 'crx-script-url',
    }));
    build.onLoad({ filter: /.*/, namespace: 'crx-script-url' }, () => ({
      contents: 'export default "contentScripts/main.js";',
      loader: 'js',
    }));
  },
};

// ---------------------------------------------------------------------------
// Step 0: Clean output
// ---------------------------------------------------------------------------
if (existsSync(OUT)) {
  rmSync(OUT, { recursive: true });
}
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Step 1: Build priority.ts directly for Firefox (no intermediate public/)
// ---------------------------------------------------------------------------
console.log('[firefox] Step 1/6: Priority script...');
await esbuild({
  entryPoints: [path.join(ROOT, 'src/contentScripts/priority.ts')],
  outfile: path.join(OUT, 'priority.js'),
  bundle: true,
  format: 'iife',
  target: 'firefox112',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});

// ---------------------------------------------------------------------------
// Step 2: Vite build — React UI only
// ---------------------------------------------------------------------------
console.log('[firefox] Step 2/6: Vite build (UI)...');
execSync('npx vite build --config vite.config.firefox.ts', { cwd: ROOT, stdio: 'inherit' });

// ---------------------------------------------------------------------------
// Step 3: esbuild — background.ts → background.js (IIFE)
// ---------------------------------------------------------------------------
console.log('[firefox] Step 3/6: Background service worker...');
await esbuild({
  entryPoints: [path.join(ROOT, 'src/background.ts')],
  outfile: path.join(OUT, 'background.js'),
  bundle: true,
  format: 'iife',
  target: 'firefox112',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
  plugins: [crxScriptPlugin],
  logLevel: 'info',
});

// ---------------------------------------------------------------------------
// Step 4: esbuild — content scripts (IIFE)
// ---------------------------------------------------------------------------
console.log('[firefox] Step 4/6: Content scripts...');
await esbuild({
  entryPoints: [path.join(ROOT, 'src/contentScripts/main.ts')],
  outfile: path.join(OUT, 'contentScripts/main.js'),
  bundle: true,
  format: 'iife',
  target: 'firefox112',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});

await esbuild({
  entryPoints: [path.join(ROOT, 'src/contentScripts/extractor.ts')],
  outfile: path.join(OUT, 'extractor.js'),
  bundle: true,
  format: 'iife',
  target: 'firefox112',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});

// ---------------------------------------------------------------------------
// Step 5: Copy assets — layout mirrors Chrome dist/ for consistent paths
//
//   dist-firefox/
//   ├── icons/            ← from public/icons/
//   ├── pdf.worker.min.mjs ← from node_modules (direct, no public/ intermediate)
//   ├── assets/           ← Vite output
//   └── ...
// ---------------------------------------------------------------------------
console.log('[firefox] Step 5/6: Copy assets...');
cpSync(path.join(ROOT, 'public/icons'), path.join(OUT, 'icons'), { recursive: true });
cpSync(path.join(ROOT, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'), path.join(OUT, 'pdf.worker.min.mjs'));

// ---------------------------------------------------------------------------
// Step 6: Generate manifest.json from config
// ---------------------------------------------------------------------------
console.log('[firefox] Step 6/6: Generate manifest.json...');
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifestConfig, null, 2));
console.log('[firefox] ✓ Build complete →', OUT);
