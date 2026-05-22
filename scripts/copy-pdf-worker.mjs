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
