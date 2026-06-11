import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

/**
 * Firefox MV3 manifest.
 *
 * Key differences from Chrome:
 * - `browser_specific_settings.gecko` section (required for Firefox)
 * - `background.scripts` instead of `service_worker` (more broadly compatible)
 * - No `@crxjs/vite-plugin`; manifest is static JSON generated at build time
 * - Content scripts built as IIFE via esbuild (Firefox loads them as classic scripts)
 *
 * Requires Firefox 112+ for MV3 background support.
 */
export default {
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
