#!/usr/bin/env node
// Package the built Chrome extension into distributable artifacts.
//
// Outputs (in release/):
//   <name>-<version>.zip — unpacked extension + install guide (load via dev mode)
//   <name>-<version>.crx — signed CRX3 package (for Chromium browsers that allow it)
//   extension.pem        — signing key, auto-generated on first run, KEEP PRIVATE
//
// Prerequisites:
//   - `npm run build` has produced dist/
//   - `crx3` (devDependency) and `python3` on PATH
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
const INSTALL_GUIDE = `
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
const DIST = path.join(ROOT, 'dist');
const RELEASE = path.join(ROOT, 'release');

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const base = `${pkg.name}-${pkg.version}`;
const zipPath = path.join(RELEASE, `${base}.zip`);
const crxPath = path.join(RELEASE, `${base}.crx`);
const pemPath = path.join(RELEASE, 'extension.pem');

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------
if (!existsSync(path.join(DIST, 'manifest.json'))) {
  console.error('✗ dist/manifest.json not found — run `npm run build` first.');
  process.exit(1);
}
for (const bin of ['crx3', 'python3']) {
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore' });
  } catch {
    const hint = bin === 'crx3' ? ' Run `npm install` to install devDependencies.' : '';
    console.error(`✗ '${bin}' not found on PATH.${hint}`);
    process.exit(1);
  }
}
mkdirSync(RELEASE, { recursive: true });
rmSync(zipPath, { force: true });
rmSync(crxPath, { force: true });

const staged = mkdtempSync(path.join(tmpdir(), 'chathub-stage-'));
const work = mkdtempSync(path.join(tmpdir(), 'chathub-pack-'));
try {
  // -------------------------------------------------------------------------
  // Clean staging copy of dist — drop build cache, signing keys, OS noise
  // -------------------------------------------------------------------------
  cpSync(DIST, staged, { recursive: true });
  rmSync(path.join(staged, '.vite'), { recursive: true, force: true });
  for (const name of readdirSync(staged)) {
    if (name.endsWith('.pem') || name === '.DS_Store') {
      rmSync(path.join(staged, name), { force: true });
    }
  }

  writeFileSync(path.join(work, GUIDE_NAME), `${INSTALL_GUIDE.trim()}\n`, 'utf8');

  console.log(`📦 Packaging ${base}\n`);

  // -------------------------------------------------------------------------
  // Step 1/2: ZIP — clean extension + install guide at the root
  // -------------------------------------------------------------------------
  console.log('[pack] Step 1/2: ZIP (unpacked extension + install guide)...');
  execFileSync('python3', ['-c', PY_MAKE_ZIP, staged, path.join(work, GUIDE_NAME), GUIDE_NAME, zipPath], {
    stdio: 'inherit',
  });

  // -------------------------------------------------------------------------
  // Step 2/2: CRX3 — signed, pure extension (no guide); key persisted for a
  // stable extension ID so future versions upgrade in place.
  // -------------------------------------------------------------------------
  console.log('[pack] Step 2/2: CRX3 (signed, stable key)...');
  execFileSync('crx3', ['-o', crxPath, '-p', pemPath, path.join(staged, 'manifest.json')], {
    stdio: 'inherit',
  });
} finally {
  rmSync(staged, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
const rel = (p) => path.relative(ROOT, p);
console.log('\n✓ Packaging complete:');
console.log(`  ${rel(zipPath)}   ← send this to friends`);
console.log(`  ${rel(crxPath)}   ← for Chromium browsers that allow local .crx`);
console.log(`  ${rel(pemPath)}   ← signing key (KEEP PRIVATE, never commit)`);
