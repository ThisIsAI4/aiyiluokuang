import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.resolve(__dirname, 'dist-firefox');

// Vite config for the Firefox extension UI only.
// Background service worker and content scripts are built separately
// via esbuild (see scripts/build-firefox.mjs) because Firefox loads
// content scripts as classic (non-ESM) scripts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      input: {
        chatHub: path.resolve(__dirname, 'chatHub.html'),
      },
    },
  },
});
