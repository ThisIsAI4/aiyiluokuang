#!/usr/bin/env node
// Package the built extension(s) into distributable artifacts.
//
// Usage:
//   node scripts/pack.mjs            # Chrome only (default)
//   node scripts/pack.mjs chrome     # Chrome
//   node scripts/pack.mjs firefox    # Firefox
//   node scripts/pack.mjs all        # Both
//
// Outputs (in release/):
//   chathub-replica-<version>.zip          — Chrome unpacked extension + install guide
//   chathub-replica-<version>.crx          — signed CRX3 package (Chrome only)
//   chathub-replica-firefox-<version>.zip  — Firefox unpacked extension + install guide
//   extension.pem                          — Chrome signing key, auto-generated on
//                                            first run, KEEP PRIVATE
//
// Prerequisites:
//   - `npm run build` has produced dist/            (Chrome)
//   - `npm run build:firefox` has produced dist-firefox/  (Firefox)
//   - `crx3` (devDependency) and `python3` on PATH  (crx3 only needed for Chrome)
//
// Why python3 for the ZIP: macOS `zip` does not set the UTF-8 flag on non-ASCII
// filenames, so the Chinese install-guide name garbles on Windows. Python's
// zipfile sets the flag, so the filename round-trips on every platform.
//
// Why a staging dir: dist/ may carry build cache (.vite/) and stray signing
// keys (*.pem); we copy only the real extension into a clean dir so neither the
// ZIP nor the CRX ever leak private keys or cache files.

import { execSync, execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GUIDE_NAME = '安装说明.txt';
const INSTALL_GUIDE_CHROME = `
========================================
  ChatHub Replica 浏览器扩展 · 安装说明
========================================

【这是什么】
一个把主流 AI 聊天网站聚合到同一个面板的浏览器扩展。

【支持的浏览器】
Google Chrome、Microsoft Edge 以及其他基于 Chromium 的浏览器。
（新版 Chrome 不再允许直接安装 .crx，请严格按下面的步骤操作。）

【安装步骤】
1. 把这个压缩包（.zip）解压成一个文件夹。
   解压后，文件夹里应该能看到 manifest.json 文件。

2. 打开浏览器，在地址栏输入后回车：
   · Chrome 用户：chrome://extensions/
   · Edge 用户：  edge://extensions/

3. 打开页面右上角的「开发者模式」开关。

4. 点击左上角「加载已解压的扩展程序」按钮。

5. 在弹出的对话框里，选中第 1 步解压出来的那个文件夹。

6. 安装完成。点浏览器右上角的扩展图标即可使用。

【常见问题】
· 浏览器提示「请勿关闭开发者模式」——正常现象，保持开启即可。
· 找不到扩展图标——点浏览器右上角的拼图图标 🧩，把 ChatHub Replica
  固定 📌 到工具栏。
· 装上后没反应——在扩展页面把这个扩展的开关关掉再打开一次。

【如何更新到新版本】
收到新版的压缩包后，解压覆盖原来的文件夹，然后在扩展页面
点击 ChatHub Replica 的「重新加载」按钮 🔄 即可。

有问题请联系分享给你这个扩展的朋友。
`;

const INSTALL_GUIDE_FIREFOX = `
========================================
  ChatHub Replica 浏览器扩展 · Firefox 安装说明
========================================

【这是什么】
一个把主流 AI 聊天网站聚合到同一个面板的浏览器扩展（Firefox 版）。

【重要提示】
这个扩展没有经过 Mozilla 官方签名。Firefox 默认只允许安装已签名的
扩展，所以需要通过下面的「临时加载」方式安装。

【安装步骤】
1. 把这个压缩包（.zip）解压成一个文件夹。
   解压后，文件夹里应该能看到 manifest.json 文件。

2. 在 Firefox 地址栏输入 about:debugging 后回车。

3. 点击左侧「此 Firefox」(This Firefox)。

4. 点击「临时加载附加组件…」(Load Temporary Add-on…) 按钮。

5. 在弹出的对话框里，选中第 1 步解压出来的文件夹中的 manifest.json 文件。

6. 安装完成。点浏览器右上角的扩展图标即可使用。

【注意事项】
· 临时加载的扩展在 Firefox 完全退出后会消失，需要按上面的步骤重新加载。
· 若希望持久安装，需要使用 Firefox Developer Edition / Nightly / ESR，
  并把 about:config 中的 xpinstall.signatures.required 设为 false；
  或将扩展提交到 Mozilla 扩展商店 (AMO) 进行官方签名。

【如何更新到新版本】
收到新版的压缩包后，解压覆盖原来的文件夹，然后在 about:debugging
页面点击 ChatHub Replica 的「重新加载」按钮 🔄 即可。

有问题请联系分享给你这个扩展的朋友。
`;

// python3 one-shot: zip a directory, then append one extra file at the zip root.
// zipfile sets the UTF-8 flag on non-ASCII names, fixing Windows filename garble.
const PY_MAKE_ZIP = `
import os, sys, zipfile
src, extra, arcname, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        dirs.sort(); files.sort()
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, src))
    if extra:
        z.write(extra, arcname)
`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE = path.join(ROOT, 'release');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Copy a build dir into a clean temp dir, stripping build cache, signing keys,
// and OS noise so they never end up inside the archive.
function stageClean(srcDir) {
  const staged = mkdtempSync(path.join(tmpdir(), 'chathub-stage-'));
  cpSync(srcDir, staged, { recursive: true });
  rmSync(path.join(staged, '.vite'), { recursive: true, force: true });
  for (const name of readdirSync(staged)) {
    if (name.endsWith('.pem') || name === '.DS_Store') {
      rmSync(path.join(staged, name), { force: true });
    }
  }
  return staged;
}

// Write the install guide to a temp file and return its path. Caller owns cleanup.
function writeGuideFile(text) {
  const dir = mkdtempSync(path.join(tmpdir(), 'chathub-guide-'));
  writeFileSync(path.join(dir, GUIDE_NAME), `${text.trim()}\n`, 'utf8');
  return path.join(dir, GUIDE_NAME);
}

// ZIP a staged dir, appending the install guide at the archive root.
function makeZip(stagedDir, guidePath, outPath) {
  rmSync(outPath, { force: true });
  execFileSync('python3', ['-c', PY_MAKE_ZIP, stagedDir, guidePath, GUIDE_NAME, outPath], {
    stdio: 'inherit',
  });
}

function requireBin(bin) {
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore' });
  } catch {
    const hint = bin === 'crx3' ? ' Run `npm install` to install devDependencies.' : '';
    console.error(`✗ '${bin}' not found on PATH.${hint}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Chrome: unpacked ZIP + signed CRX3 (stable signing key for in-place upgrades)
// ---------------------------------------------------------------------------
function packChrome() {
  const DIST = path.join(ROOT, 'dist');
  if (!existsSync(path.join(DIST, 'manifest.json'))) {
    console.error('✗ dist/manifest.json not found — run `npm run build` first.');
    process.exit(1);
  }
  requireBin('crx3');
  requireBin('python3');

  const base = `${pkg.name}-${pkg.version}`;
  const zipPath = path.join(RELEASE, `${base}.zip`);
  const crxPath = path.join(RELEASE, `${base}.crx`);
  const pemPath = path.join(RELEASE, 'extension.pem');
  mkdirSync(RELEASE, { recursive: true });
  rmSync(crxPath, { force: true });

  const staged = stageClean(DIST);
  const guide = writeGuideFile(INSTALL_GUIDE_CHROME);
  try {
    console.log('📦 Packaging Chrome\n');
    console.log('[pack:chrome] ZIP (unpacked extension + install guide)...');
    makeZip(staged, guide, zipPath);
    console.log('[pack:chrome] CRX3 (signed, stable key)...');
    execFileSync('crx3', ['-o', crxPath, '-p', pemPath, path.join(staged, 'manifest.json')], {
      stdio: 'inherit',
    });
  } finally {
    rmSync(staged, { recursive: true, force: true });
    rmSync(path.dirname(guide), { recursive: true, force: true });
  }
  return { zipPath, crxPath, pemPath };
}

// ---------------------------------------------------------------------------
// Firefox: unpacked ZIP only. No CRX/XPI — an unsigned Firefox extension can
// only load temporarily via about:debugging (see the install guide); producing
// an installable .xpi would require AMO signing, out of scope here.
// ---------------------------------------------------------------------------
function packFirefox() {
  const DIST = path.join(ROOT, 'dist-firefox');
  if (!existsSync(path.join(DIST, 'manifest.json'))) {
    console.error('✗ dist-firefox/manifest.json not found — run `npm run build:firefox` first.');
    process.exit(1);
  }
  requireBin('python3');

  const zipPath = path.join(RELEASE, `${pkg.name}-firefox-${pkg.version}.zip`);
  mkdirSync(RELEASE, { recursive: true });

  const staged = stageClean(DIST);
  const guide = writeGuideFile(INSTALL_GUIDE_FIREFOX);
  try {
    console.log('📦 Packaging Firefox\n');
    console.log('[pack:firefox] ZIP (unpacked extension + install guide)...');
    makeZip(staged, guide, zipPath);
  } finally {
    rmSync(staged, { recursive: true, force: true });
    rmSync(path.dirname(guide), { recursive: true, force: true });
  }
  return { zipPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const target = process.argv[2] || 'chrome';
if (!['chrome', 'firefox', 'all'].includes(target)) {
  console.error(`✗ Unknown target '${target}'. Use: chrome | firefox | all`);
  process.exit(1);
}

const results = [];
if (target === 'chrome' || target === 'all') results.push(packChrome());
if (target === 'firefox' || target === 'all') results.push(packFirefox());

const rel = (p) => path.relative(ROOT, p);
console.log('\n✓ Packaging complete:');
for (const { zipPath, crxPath, pemPath } of results) {
  console.log(`  ${rel(zipPath)}   ← send this to friends`);
  if (crxPath) console.log(`  ${rel(crxPath)}   ← for Chromium browsers that allow local .crx`);
  if (pemPath) console.log(`  ${rel(pemPath)}   ← signing key (KEEP PRIVATE, never commit)`);
}
