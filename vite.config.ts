import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    hmr: {
      port: 5181,
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      input: {
        chatHub: path.resolve(__dirname, 'chatHub.html'),
      },
    },
  },
});
