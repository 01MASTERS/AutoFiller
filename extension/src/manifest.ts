import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AutoFiller',
  version: '0.0.1',
  description: 'Auto-fill Google Forms using AI-powered field matching',
  permissions: ['activeTab', 'storage', 'scripting'],
  host_permissions: ['<all_urls>'],
  action: {
    default_popup: 'src/popup/popup.html',
  },
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: [
        'https://docs.google.com/forms/*',
        'http://localhost:3456/*',
        'http://127.0.0.1:3456/*',
        '<all_urls>',
      ],
      js: ['src/content/contentScript.ts'],
    },
  ],
});
