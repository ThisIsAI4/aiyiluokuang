#!/usr/bin/env node
// Build the Firefox extension into dist-firefox/.
//
// Pipeline:
//   1. Pre-builds (priority.js, pdf-worker) — reuse existing scripts
//   2. Vite build — chatHub.html (React UI) only
//   3. esbuild — background.ts (IIFE, no ESM)
//   4. esbuild — content scripts (IIFE)
//   5. Copy assets (icons, priority.js, pdf.worker) to correct paths
//   6. Generate manifest.json

import { build as esbuild } from 'esbuild';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json' with { type: 'json' };

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
// Step 1: Pre-builds (shared with Chrome build)
// ---------------------------------------------------------------------------
console.log('[firefox] Step 1/6: Pre-builds...');
execSync('npm run build:priority', { cwd: ROOT, stdio: 'inherit' });
execSync('npm run build:pdf-worker', { cwd: ROOT, stdio: 'inherit' });

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
  logLevel: 'info',
});

await esbuild({
  entryPoints: [path.join(ROOT, 'src/contentScripts/extractor.ts')],
  outfile: path.join(OUT, 'extractor.js'),
  bundle: true,
  format: 'iife',
  target: 'firefox112',
  platform: 'browser',
  logLevel: 'info',
});

// ---------------------------------------------------------------------------
// Step 5: Copy assets — layout mirrors Chrome dist/ for consistent paths
//
//   dist-firefox/
//   ├── icons/            ← from public/icons/
//   ├── priority.js       ← from public/
//   ├── pdf.worker.min.mjs
//   ├── assets/           ← Vite output
//   └── ...
// ---------------------------------------------------------------------------
console.log('[firefox] Step 5/6: Copy assets...');
cpSync(path.join(ROOT, 'public/icons'), path.join(OUT, 'icons'), { recursive: true });
cpSync(path.join(ROOT, 'public/priority.js'), path.join(OUT, 'priority.js'));
cpSync(path.join(ROOT, 'public/pdf.worker.min.mjs'), path.join(OUT, 'pdf.worker.min.mjs'));

// ---------------------------------------------------------------------------
// Step 6: Generate manifest.json
// ---------------------------------------------------------------------------
console.log('[firefox] Step 6/6: Generate manifest.json...');
const manifest = {
  manifest_version: 3,
  name: 'ChatHub Replica',
  description: pkg.description,
  version: pkg.version,
  default_locale: 'en',
  homepage_url: 'https://github.com/yourname/chathub-replica',

  browser_specific_settings: {
    gecko: {
      id: 'chathub-replica@example.com',
      strict_min_version: '112.0',
    },
  },

  icons: {
    16: 'icons/logo-16.png',
    32: 'icons/logo-32.png',
    48: 'icons/logo-48.png',
    128: 'icons/logo-128.png',
  },
  action: {
    default_icon: 'icons/logo-48.png',
  },
  options_page: 'chatHub.html',

  background: {
    scripts: ['background.js'],
  },

  content_scripts: [],

  permissions: [
    'storage',
    'declarativeNetRequest',
    'scripting',
    'tabs',
    'contextMenus',
    'notifications',
  ],
  host_permissions: ['<all_urls>', 'file:///*'],

  web_accessible_resources: [
    {
      resources: [
        'contentScripts/main.js',
        'priority.js',
        'extractor.js',
        'pdf.worker.min.mjs',
        'assets/*',
      ],
      matches: ['<all_urls>', 'file:///*'],
    },
  ],
};

writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('[firefox] ✓ Build complete →', OUT);
