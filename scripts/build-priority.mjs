#!/usr/bin/env node
// Pre-build the MAIN-world priority content script as a self-contained IIFE.
// Output is placed in public/priority.js so Vite copies it to dist/ verbatim.

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(root, 'src/contentScripts/priority.ts')],
  outfile: path.join(root, 'public/priority.js'),
  bundle: true,
  format: 'iife',
  target: 'chrome100',
  platform: 'browser',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});
