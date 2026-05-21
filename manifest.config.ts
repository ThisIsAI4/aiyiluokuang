import { defineManifest, defineDynamicResource } from '@crxjs/vite-plugin';
import packageJson from './package.json';

const { version, description } = packageJson;

export default defineManifest({
  manifest_version: 3,
  name: 'ChatHub Replica',
  description,
  version,
  default_locale: 'en',
  homepage_url: 'https://github.com/yourname/chathub-replica',
  icons: {
    16: 'public/icons/logo-16.png',
    32: 'public/icons/logo-32.png',
    48: 'public/icons/logo-48.png',
    128: 'public/icons/logo-128.png',
  },
  action: {
    default_icon: 'public/icons/logo-48.png',
  },
  options_page: 'chatHub.html',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [],
  web_accessible_resources: [
    defineDynamicResource({
      matches: ['http://*/*', 'https://*/*'],
      use_dynamic_url: false,
    }),
  ],
  permissions: ['storage', 'declarativeNetRequest', 'scripting', 'tabs'],
  host_permissions: ['<all_urls>'],
});
